"""Native host controls; browser remains the main sharing interface."""

import ipaddress
import json
import socket
import threading
import tkinter as tk
import urllib.request
import webbrowser
from tkinter import ttk

import psutil


def run_panel():
    from apps.desktop.launcher import main

    root = tk.Tk()
    root.title("FlowDrop Desktop")
    root.geometry("620x430")
    root.minsize(540, 380)
    adapter_map = {}
    for interface, addresses in psutil.net_if_addrs().items():
        if (
            not psutil.net_if_stats().get(interface)
            or not psutil.net_if_stats()[interface].isup
        ):
            continue
        for address in addresses:
            if (
                address.family == socket.AF_INET
                and ipaddress.ip_address(address.address).is_private
                and not ipaddress.ip_address(address.address).is_loopback
            ):
                adapter_map[f"{interface} — {address.address}"] = address.address
    adapter_map["This PC only — 127.0.0.1"] = "127.0.0.1"
    state = {
        "thread": None,
        "server": None,
        "app": None,
        "base": None,
        "closing": False,
        "opened": False,
    }
    frame = ttk.Frame(root, padding=24)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="FlowDrop", font=("Segoe UI", 24, "bold")).pack(anchor="w")
    ttk.Label(frame, text="Share anything. Anywhere. Even offline.").pack(
        anchor="w", pady=(2, 18)
    )
    ttk.Label(frame, text="Network adapter").pack(anchor="w")
    selected = tk.StringVar(value=next(iter(adapter_map)))
    adapter = ttk.Combobox(
        frame, textvariable=selected, values=list(adapter_map), state="readonly"
    )
    adapter.pack(fill="x", pady=6)
    status = tk.StringVar(value="Starting the local host…")
    ttk.Label(frame, textvariable=status, wraplength=550).pack(anchor="w", pady=10)
    url = tk.StringVar()
    ttk.Entry(frame, textvariable=url, state="readonly").pack(fill="x")
    pairing = tk.StringVar()
    ttk.Label(frame, textvariable=pairing, font=("Segoe UI", 14, "bold")).pack(
        anchor="w", pady=10
    )
    devices = tk.StringVar(value="Connected devices appear here after approval.")
    ttk.Label(frame, textvariable=devices, wraplength=550).pack(anchor="w")
    controls = ttk.Frame(frame)
    controls.pack(anchor="w", pady=16)

    def ready(app, server, base):
        if state["closing"]:
            server.should_exit = True

        def update():
            state.update(app=app, server=server, base=base)
            url.set(base)
            pairing.set("Pairing code: " + app.state.pairing_code)
            status.set("Waiting for the host to become reachable…")
            stop_button.config(state="normal")

        root.after(0, update)

    def start():
        thread = state["thread"]
        if thread and thread.is_alive():
            return
        start_button.config(state="disabled")
        adapter.config(state="disabled")
        status.set("Starting…")
        state["opened"] = False
        bind_address = adapter_map[selected.get()]

        def launch():
            try:
                main(
                    ["--bind", bind_address, "--port", "0", "--no-browser"],
                    on_ready=ready,
                )
            except (OSError, RuntimeError, SystemExit) as exc:
                root.after(
                    0,
                    lambda error=str(exc): status.set("Host startup failed: " + error),
                )
            finally:

                def stopped():
                    state.update(server=None, app=None, base=None)
                    start_button.config(state="normal")
                    stop_button.config(state="disabled")
                    open_button.config(state="disabled")
                    adapter.config(state="readonly")
                    url.set("")
                    pairing.set("")
                    devices.set("Host stopped.")
                    if state["closing"]:
                        root.destroy()

                root.after(0, stopped)

        thread = threading.Thread(target=launch, daemon=True)
        state["thread"] = thread
        thread.start()

    def stop():
        server = state["server"]
        if server:
            server.should_exit = True
            status.set("Stopping gracefully…")
            stop_button.config(state="disabled")

    def open_dashboard():
        if state["app"]:
            webbrowser.open(state["base"] + "/#host=" + state["app"].state.host_token)

    def poll():
        if state["app"]:
            try:
                request = urllib.request.Request(
                    state["base"] + "/api/devices",
                    headers={
                        "Authorization": "Bearer " + state["app"].state.host_token
                    },
                )
                with urllib.request.urlopen(request, timeout=0.5) as response:
                    values = json.load(response)
                pairing.set("Pairing code: " + state["app"].state.pairing_code)
                if not state["opened"] and not state["closing"]:
                    state["opened"] = True
                    status.set("Host running. Approve devices in the dashboard.")
                    open_button.config(state="normal")
                    open_dashboard()
                devices.set(
                    "Devices: "
                    + ", ".join(
                        v["name"] + (" (pending)" if not v["approved"] else "")
                        for v in values
                    )
                )
            except (OSError, ValueError):
                pass
        if not state["closing"]:
            root.after(2000, poll)

    def close():
        state["closing"] = True
        if state["thread"] and state["thread"].is_alive():
            stop()
        else:
            root.destroy()

    start_button = ttk.Button(controls, text="Start host", command=start)
    start_button.pack(side="left", padx=(0, 8))
    stop_button = ttk.Button(controls, text="Stop host", command=stop, state="disabled")
    stop_button.pack(side="left", padx=(0, 8))
    open_button = ttk.Button(
        controls, text="Open dashboard", command=open_dashboard, state="disabled"
    )
    open_button.pack(side="left")
    ttk.Label(
        frame,
        text="HTTP LAN traffic is not encrypted. Use a trusted private network.\nFor untrusted networks, use the CLI with trusted TLS certificates.",
        wraplength=550,
    ).pack(anchor="w")
    root.protocol("WM_DELETE_WINDOW", close)
    root.after(200, start)
    root.after(2000, poll)
    root.mainloop()
