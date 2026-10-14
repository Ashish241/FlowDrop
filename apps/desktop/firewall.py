"""Inspect firewall policy; create only an explicitly approved private/local rule."""

import base64
import hashlib
import os
import subprocess


def rule_name(executable, port, address):
    identity = f"{os.path.abspath(executable).lower()}:{port}:{address}"
    return "FlowDrop-" + hashlib.sha256(identity.encode()).hexdigest()[:20]


def ps_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def rule_script(executable, port, address):
    name = rule_name(executable, port, address)
    return f"""$ErrorActionPreference='Stop'
$name={ps_literal(name)}
$existing=Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
if($existing) {{
 $p=$existing | Get-NetFirewallPortFilter
 $a=$existing | Get-NetFirewallApplicationFilter
 $s=$existing | Get-NetFirewallAddressFilter
 if($existing.Enabled -ne 'True' -or $existing.Action -ne 'Allow' -or $existing.Direction -ne 'Inbound' -or [string]$existing.Profile -ne 'Private' -or [string]$p.LocalPort -ne '{int(port)}' -or [string]$p.Protocol -ne 'TCP' -or $a.Program -ne {ps_literal(os.path.abspath(executable))} -or [string]$s.RemoteAddress -ne 'LocalSubnet' -or [string]$s.LocalAddress -ne {ps_literal(address)}) {{ throw 'Conflicting named rule: review it in Windows Firewall instead of overwriting it.' }}
}} else {{
 New-NetFirewallRule -Name $name -DisplayName ('FlowDrop Offline LAN ' + '{int(port)}') -Direction Inbound -Action Allow -Enabled True -Program {ps_literal(os.path.abspath(executable))} -Protocol TCP -LocalPort {int(port)} -LocalAddress {ps_literal(address)} -Profile Private -RemoteAddress LocalSubnet | Out-Null
}}
"""


def inspect_firewall(executable, port, address):
    if os.name != "nt":
        return "Windows firewall inspection unavailable on this platform"
    name = rule_name(executable, port, address)
    script = f"""$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$p=Get-NetFirewallProfile -PolicyStore ActiveStore
$r=Get-NetFirewallRule -Name {ps_literal(name)} -ErrorAction SilentlyContinue
$p | ForEach-Object {{ $_.Name + ' firewall enabled: ' + $_.Enabled + '; default inbound: ' + $_.DefaultInboundAction }}
if($r) {{ 'FlowDrop scoped rule exists: ' + $r.Enabled }} else {{ 'No FlowDrop managed rule for this executable/IP/port. Inbound may be blocked; other rules and policy require review.' }}
"""
    try:
        done = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=12,
            check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return done.stdout.strip()
    except (OSError, subprocess.SubprocessError) as exc:
        return (
            "Firewall policy inspection unavailable (permission/policy/tool error): "
            + str(exc)
        )


def request_private_rule(executable, port, address):
    if os.name != "nt" or not executable.lower().endswith(".exe"):
        raise RuntimeError(
            "Firewall setup is available in the packaged Windows executable; use the guide for source mode"
        )
    encoded = base64.b64encode(
        rule_script(executable, port, address).encode("utf-16le")
    ).decode("ascii")
    # UAC requests elevation only after the panel's explicit approval dialog.
    wrapper = f"$ErrorActionPreference='Stop'; $p=Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand','{encoded}') -Wait -PassThru -WindowStyle Hidden; exit $p.ExitCode"
    try:
        subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", wrapper],
            check=True,
            capture_output=True,
            timeout=120,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError(
            "Firewall rule was not confirmed. UAC may have been cancelled or policy denied access. Run Diagnostics or use the administrator instructions."
        ) from exc
    return "Private/LocalSubnet rule confirmed; Public-profile traffic remains blocked. Run Diagnostics after network changes."
