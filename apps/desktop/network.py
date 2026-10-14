"""Windows adapter/route inventory and conservative offline interface selection."""

import ipaddress
import json
import os
import socket
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

import psutil


@dataclass(frozen=True)
class Adapter:
    name: str
    ipv4: str
    index: int = 0
    prefix: int = 24
    gateway: str = ""
    up: bool = True
    kind: str = "Unknown"
    profile: str = "Unknown"
    metric: int = 9999
    physical: bool = False
    virtual: bool = False
    local_route: bool = True
    guid: str = ""
    source: str = "Windows networking APIs"

    @property
    def identity(self):
        return self.guid or self.name

    @property
    def subnet(self):
        return str(ipaddress.IPv4Network(f"{self.ipv4}/{self.prefix}", strict=False))

    @property
    def usable(self):
        address = ipaddress.IPv4Address(self.ipv4)
        return (
            self.up
            and address.is_private
            and not (
                address.is_loopback or address.is_link_local or address.is_unspecified
            )
        )

    @property
    def label(self):
        suffix = " — manual / virtual" if self.virtual or not self.physical else ""
        return f"{self.name} — {self.ipv4} /{self.prefix} — {self.profile}{suffix}"


WINDOWS_QUERY = r"""
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$adapters=@(Get-NetAdapter -IncludeHidden)
$ips=@(Get-NetIPAddress -AddressFamily IPv4)
$routes=@(Get-NetRoute -AddressFamily IPv4)
$interfaces=@(Get-NetIPInterface -AddressFamily IPv4)
$profiles=@(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
$result=@(foreach($ip in $ips) {
 $a=$adapters | Where-Object ifIndex -eq $ip.InterfaceIndex | Select-Object -First 1
 if(-not $a) { continue }
 $r=$routes | Where-Object { $_.InterfaceIndex -eq $ip.InterfaceIndex -and $_.DestinationPrefix -eq '0.0.0.0/0' } | Sort-Object RouteMetric | Select-Object -First 1
 $i=$interfaces | Where-Object InterfaceIndex -eq $ip.InterfaceIndex | Select-Object -First 1
 $p=$profiles | Where-Object InterfaceIndex -eq $ip.InterfaceIndex | Select-Object -First 1
 [pscustomobject]@{
 name=$a.Name; ipv4=$ip.IPAddress; index=[int]$ip.InterfaceIndex; prefix=[int]$ip.PrefixLength
 gateway=$(if($r){$r.NextHop}else{''}); up=($a.Status -eq 'Up' -and $ip.AddressState -eq 'Preferred')
 kind=[string]$a.InterfaceType; profile=$(if($p){[string]$p.NetworkCategory}else{'Unknown'})
 metric=([int]$i.InterfaceMetric + $(if($r){[int]$r.RouteMetric}else{9999}))
 physical=([bool]$a.HardwareInterface -and -not [bool]$a.Virtual); virtual=[bool]$a.Virtual
 local_route=[bool]($routes | Where-Object { $_.InterfaceIndex -eq $ip.InterfaceIndex -and $_.DestinationPrefix -ne '0.0.0.0/0' })
 guid=[string]$a.InterfaceGuid
 }
})
ConvertTo-Json -InputObject $result -Compress
"""


def windows_inventory():
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_QUERY],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=12,
        check=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    return [Adapter(**value) for value in json.loads(result.stdout.lstrip("\ufeff"))]


def discover_adapters():
    if os.name == "nt":
        try:
            return sorted(
                windows_inventory(),
                key=lambda a: (
                    not a.physical,
                    not bool(a.gateway),
                    a.metric,
                    a.name,
                    a.ipv4,
                ),
            )
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    stats = psutil.net_if_stats()
    values = []
    for name, addresses in psutil.net_if_addrs().items():
        for entry in addresses:
            if entry.family != socket.AF_INET:
                continue
            virtual = any(
                word in name.lower()
                for word in (
                    "vethernet",
                    "hyper-v",
                    "wsl",
                    "docker",
                    "vmware",
                    "virtualbox",
                    "vpn",
                    "tun",
                    "tap",
                    "local area connection*",
                )
            )
            prefix = ipaddress.IPv4Network(
                f"0.0.0.0/{entry.netmask or '255.255.255.0'}"
            ).prefixlen
            values.append(
                Adapter(
                    name,
                    entry.address,
                    prefix=prefix,
                    up=bool(stats.get(name) and stats[name].isup),
                    physical=os.name != "nt" and not virtual,
                    virtual=virtual,
                    source="psutil fallback; Windows routing/profile unavailable",
                )
            )
    return sorted(values, key=lambda a: (a.virtual, a.name, a.ipv4))


def automatic_candidates(adapters):
    return [
        a
        for a in adapters
        if a.usable
        and a.physical
        and not a.virtual
        and a.local_route
        and not any(
            word in a.name.lower()
            for word in (
                "vethernet",
                "wsl",
                "hyper-v",
                "docker",
                "vmware",
                "virtualbox",
                "local area connection*",
            )
        )
    ]


def choose_adapter(adapters, identity=None):
    if identity:
        matches = [a for a in adapters if a.usable and a.identity == identity]
        if len(matches) == 1:
            return matches[0]
    candidates = automatic_candidates(adapters)
    if not candidates:
        raise ValueError(
            "No active physical LAN adapter with a local IPv4 route. Refresh networks or explicitly select a trusted adapter."
        )
    if len(candidates) != 1:
        raise ValueError(
            "Multiple physical networks are available. Select the network used by your phone: "
            + ", ".join(f"{a.name} ({a.ipv4})" for a in candidates)
        )
    return candidates[0]


def lan_adapters():
    return [(a.name, a.ipv4) for a in discover_adapters() if a.usable]


def startup_network(lan=False, bind=None):
    if bind is None and not lan:
        return "127.0.0.1", "127.0.0.1"
    if bind is not None:
        try:
            address = ipaddress.IPv4Address(bind)
        except ipaddress.AddressValueError as exc:
            raise ValueError(
                "Choose a local IPv4 address from --list-adapters"
            ) from exc
        if address.is_loopback:
            if lan:
                raise ValueError("--lan requires a LAN adapter, not loopback")
            return bind, bind
        if address.is_unspecified and not lan:
            raise ValueError("Binding 0.0.0.0 requires --lan")
    adapters = discover_adapters()
    if bind is None or bind == "0.0.0.0":
        selected = choose_adapter(adapters)
        if bind is None and selected.profile != "Private":
            raise ValueError(
                f"The automatic adapter has a {selected.profile} profile, not Private. Verify this is a trusted network; explicitly choose --bind <IPv4> or use the desktop confirmation. No profile was changed."
            )
        return bind or selected.ipv4, selected.ipv4
    if not any(a.usable and a.ipv4 == bind for a in adapters):
        raise ValueError(
            "Adapter disconnected or IPv4 changed. Refresh --list-adapters and select an active private IPv4 address."
        )
    return bind, bind


def preference_path():
    return (
        Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "FlowDrop" / "network.json"
    )


def load_preference(path=None):
    try:
        return json.loads((path or preference_path()).read_text(encoding="utf-8")).get(
            "adapter"
        )
    except (OSError, ValueError, AttributeError):
        return None


def save_preference(adapter, path=None):
    target = path or preference_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"adapter": adapter.identity}), encoding="utf-8")


def inventory_json():
    return [dict(asdict(a), subnet=a.subnet) for a in discover_adapters()]
