"""Choose an explicit local IPv4 interface without relying on Internet access."""

import ipaddress
import socket

import psutil


def lan_adapters():
    stats = psutil.net_if_stats()
    result = []
    for name, addresses in psutil.net_if_addrs().items():
        if name not in stats or not stats[name].isup:
            continue
        for entry in addresses:
            if entry.family != socket.AF_INET:
                continue
            address = ipaddress.IPv4Address(entry.address)
            if (
                address.is_private
                and not address.is_loopback
                and not address.is_link_local
                and not address.is_unspecified
            ):
                result.append((name, str(address)))

    def priority(item):
        name = item[0].lower()
        virtual = any(
            word in name
            for word in (
                "vethernet",
                "wsl",
                "docker",
                "vmware",
                "virtualbox",
                "vpn",
                "tun",
                "tap",
            )
        )
        physical = any(
            word in name for word in ("wi-fi", "wifi", "wlan", "ethernet", "eth", "en0")
        )
        return (virtual, not physical, name, item[1])

    return sorted(result, key=priority)


def startup_network(lan=False, bind=None):
    """Return bind address and advertised address; a private --bind is explicit LAN consent."""
    adapters = lan_adapters()
    addresses = {address for _, address in adapters}
    if bind is None:
        if not lan:
            return "127.0.0.1", "127.0.0.1"
        if not adapters:
            raise ValueError(
                "No active private IPv4 adapter. Connect Wi-Fi/Ethernet and use --list-adapters."
            )
        bind = adapters[0][1]
    try:
        address = ipaddress.IPv4Address(bind)
    except ipaddress.AddressValueError as exc:
        raise ValueError("Choose a local IPv4 address from --list-adapters") from exc
    if address.is_unspecified:
        if not lan:
            raise ValueError("Binding 0.0.0.0 requires --lan")
        if not adapters:
            raise ValueError("No active private IPv4 adapter to advertise")
        return bind, adapters[0][1]
    if address.is_loopback:
        if lan:
            raise ValueError("--lan requires a LAN adapter, not loopback")
        return bind, bind
    if bind not in addresses:
        raise ValueError("Choose an active private IPv4 adapter from --list-adapters")
    return bind, bind
