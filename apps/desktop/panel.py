"""Native desktop lifecycle, network selection and diagnostics controls."""

import json
import queue
import sys
import tempfile
import threading
import time
import tkinter as tk
import webbrowser
from dataclasses import replace
from pathlib import Path
from tkinter import messagebox, ttk

import qrcode
from websockets.exceptions import WebSocketException

from apps.desktop.diagnostics import readiness, run_diagnostics
from apps.desktop.firewall import inspect_firewall, request_private_rule
from apps.desktop.network import (
    choose_adapter,
    discover_adapters,
    load_preference,
    save_preference,
)
from services.version import BUILD_ID, VERSION


class DesktopPanel:
    def __init__(
        self,
        root,
        *,
        browser=webbrowser.open,
        confirm=messagebox.askyesno,
        preference_file=None,
        auto_start=True,
    ):
        self.root, self.browser, self.confirm = root, browser, confirm
        self.preference_file = preference_file
        self.events = queue.Queue()
        self.thread = self.server = self.app = None
        self.current_adapter = None
        self.current_lan = False
        self.last_port = 8000
        self.closing = self.pending_restart = self.refreshing = self.probing = False
        self.stop_requested = threading.Event()
        self.adapters = []
        self.adapter_map = {}
        self.opened = False
        self.last_error = ""
        self.last_diagnostics = None
        self.qr_payload = ""
        self.qr_image = None
        root.title(f"FlowDrop {VERSION} — {BUILD_ID}")
        root.geometry("850x780")
        root.minsize(760, 720)
        frame = ttk.Frame(root, padding=18)
        frame.pack(fill="both", expand=True)
        ttk.Label(
            frame,
            text=f"FlowDrop {VERSION}  /  {BUILD_ID}",
            font=("Segoe UI", 19, "bold"),
        ).pack(anchor="w")
        self.status = tk.StringVar(value="Stopped")
        ttk.Label(frame, textvariable=self.status, font=("Segoe UI", 12, "bold")).pack(
            anchor="w", pady=6
        )
        self.lan = tk.BooleanVar(value=False)
        self.lan_toggle = ttk.Checkbutton(
            frame,
            text="Enable Offline LAN Sharing (trusted network only)",
            variable=self.lan,
            command=self.mode_changed,
        )
        self.lan_toggle.pack(anchor="w")
        self.selected = tk.StringVar()
        self.adapter_box = ttk.Combobox(
            frame, textvariable=self.selected, state="disabled"
        )
        self.adapter_box.pack(fill="x", pady=4)
        self.adapter_box.bind("<<ComboboxSelected>>", lambda _: self.mode_changed())
        self.network = tk.StringVar(
            value="Discovering Windows adapters, routes and profiles…"
        )
        ttk.Label(frame, textvariable=self.network, wraplength=790).pack(anchor="w")
        self.details = tk.StringVar(value="Sharing mode: This PC Only")
        ttk.Label(frame, textvariable=self.details, wraplength=790).pack(
            anchor="w", pady=4
        )
        self.host_url, self.phone_url = tk.StringVar(), tk.StringVar()
        for title, variable in (
            ("Host Dashboard URL", self.host_url),
            ("Phone / LAN Connection URL", self.phone_url),
        ):
            ttk.Label(frame, text=title).pack(anchor="w")
            ttk.Entry(frame, textvariable=variable, state="readonly").pack(
                fill="x", pady=(0, 4)
            )
        controls = ttk.Frame(frame)
        controls.pack(anchor="w", pady=6)
        self.start_button = ttk.Button(controls, text="Start", command=self.start)
        self.stop_button = ttk.Button(
            controls, text="Stop", command=self.stop, state="disabled"
        )
        self.restart_button = ttk.Button(
            controls, text="Restart / Rebind", command=self.restart
        )
        self.open_button = ttk.Button(
            controls,
            text="Open Dashboard",
            command=self.open_dashboard,
            state="disabled",
        )
        for button in (
            self.start_button,
            self.stop_button,
            self.restart_button,
            self.open_button,
        ):
            button.pack(side="left", padx=(0, 6))
        ttk.Button(controls, text="Copy Phone URL", command=self.copy_url).pack(
            side="left"
        )
        self.pairing = tk.StringVar(value="Phone connectivity: NOT VERIFIED")
        ttk.Label(frame, textvariable=self.pairing).pack(anchor="w")
        self.qr_label = ttk.Label(
            frame, text="Enable Offline LAN to display a phone pairing QR."
        )
        self.qr_label.pack(anchor="w", pady=4)
        tools = ttk.Frame(frame)
        tools.pack(anchor="w", pady=4)
        ttk.Button(tools, text="Refresh Networks", command=self.refresh_networks).pack(
            side="left", padx=(0, 6)
        )
        self.diagnostics_button = ttk.Button(
            tools, text="Run Diagnostics", command=self.diagnostics
        )
        self.diagnostics_button.pack(side="left", padx=(0, 6))
        ttk.Button(tools, text="Allow Private LAN…", command=self.firewall).pack(
            side="left"
        )
        self.output = tk.Text(frame, height=6, wrap="word", state="disabled")
        self.output.pack(fill="both", expand=True, pady=4)
        ttk.Label(
            frame,
            text="HTTP requires a trusted LAN. Firewall changes require approval and UAC; Private/LocalSubnet only.\nPhone reachability requires a real device test; hotspot/router client isolation cannot be bypassed.",
            wraplength=790,
        ).pack(anchor="w")
        root.protocol("WM_DELETE_WINDOW", self.close)
        root.after(50, self.drain)
        root.after(100, self.refresh_networks)
        root.after(1000, self.tick)
        if auto_start:
            root.after(200, self.start)

    def post(self, function, *args):
        self.events.put((function, args))

    def drain(self):
        while not self.events.empty():
            function, args = self.events.get_nowait()
            function(*args)
            if self.closing and not self.thread:
                return
        self.root.after(50, self.drain)

    def show_output(self, text):
        self.output.config(state="normal")
        self.output.delete("1.0", "end")
        self.output.insert("1.0", text)
        self.output.config(state="disabled")

    def mode_changed(self):
        self.adapter_box.config(state="readonly" if self.lan.get() else "disabled")
        if self.lan.get() and not self.selected.get():
            self.show_output(
                "Select the network shared with your phone. Multiple physical adapters require an explicit choice; virtual adapters are manual only."
            )
            self.adapter_box.focus_set()
            messagebox.showinfo(
                "Select phone network",
                "Choose the network shared with your phone from the adapter list. Multiple physical networks require an explicit selection.",
                parent=self.root,
            )
        if self.thread:
            self.network.set(
                "Sharing settings changed. Click Restart / Rebind to apply."
            )

    def refresh_networks(self):
        if self.refreshing or self.closing:
            return
        self.refreshing = True

        def work():
            try:
                values = discover_adapters()
                self.post(self.networks_received, values)
            except (
                OSError,
                RuntimeError,
                ValueError,
                KeyError,
                AssertionError,
                WebSocketException,
            ) as exc:
                self.post(self.network_failure, str(exc))

        threading.Thread(target=work, daemon=True).start()

    def network_failure(self, error):
        self.refreshing = False
        self.network.set(
            "Network discovery failed: " + error + ". Refresh Networks to retry."
        )

    def networks_received(self, values):
        self.refreshing = False
        previous = self.adapter_map.get(self.selected.get())
        self.adapters = values
        self.adapter_map = {a.label: a for a in values if a.usable}
        self.adapter_box.config(values=list(self.adapter_map))
        identity = (
            previous.identity if previous else load_preference(self.preference_file)
        )
        try:
            choice = choose_adapter(values, identity)
            self.selected.set(choice.label)
            self.network.set(
                f"Selected: {choice.name} / {choice.ipv4}; gateway {choice.gateway or 'none'}; profile {choice.profile}; metric {choice.metric}."
            )
        except ValueError as exc:
            self.selected.set("")
            self.network.set(str(exc))
        if self.current_adapter and not any(
            a.usable
            and a.identity == self.current_adapter.identity
            and a.ipv4 == self.current_adapter.ipv4
            and a.profile == self.current_adapter.profile
            for a in values
        ):
            self.network.set(
                "Network disconnected, profile changed or DHCP address changed. Select the current network and click Restart / Rebind. LAN URL may be stale."
            )
        if values and values[0].source != "Windows networking APIs":
            self.show_output(
                values[0].source
                + ". Automatic Windows selection is disabled; choose an adapter explicitly."
            )

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        lan = self.lan.get()
        selected = self.adapter_map.get(self.selected.get()) if lan else None
        if lan and selected is None:
            self.status.set("Error — select a network first")
            self.adapter_box.focus_set()
            return
        public_approved = False
        if selected and selected.profile != "Private":
            public_approved = self.confirm(
                "Confirm trusted network",
                f"{selected.name} is {selected.profile}, not Private. Confirm you trust this LAN before exposing the listener. Private-only firewall rules will not permit Public traffic. FlowDrop will not change the profile. Continue?",
            )
            if not public_approved:
                self.status.set("Stopped — LAN not enabled on unconfirmed network")
                return
        self.stop_requested.clear()
        self.last_error = ""
        self.opened = False
        self.last_diagnostics = None
        self.started_at = time.monotonic()
        self.status.set("Starting")
        self.start_button.config(state="disabled")
        self.stop_button.config(state="normal")
        self.open_button.config(state="disabled")
        self.host_url.set("")
        self.phone_url.set("")
        self.clear_qr()

        def launch():
            from apps.desktop.launcher import main

            try:
                fresh = None
                if selected:
                    fresh = next(
                        (
                            a
                            for a in discover_adapters()
                            if a.identity == selected.identity and a.usable
                        ),
                        None,
                    )
                    if fresh is None:
                        raise ValueError(
                            "Selected adapter disconnected. Refresh Networks and restart with a current adapter."
                        )
                    if fresh.profile != "Private" and not public_approved:
                        raise ValueError(
                            "Network profile changed; refresh and explicitly confirm this trusted network before starting LAN."
                        )

                def prepared(app, server, base):
                    if self.stop_requested.is_set():
                        server.should_exit = True
                    self.post(self.prepared, app, server, fresh)

                argv = [
                    "--bind",
                    fresh.ipv4 if fresh else "127.0.0.1",
                    "--port",
                    str(self.last_port),
                    "--no-browser",
                ]
                if fresh:
                    argv.append("--lan")
                main(argv, on_ready=prepared)
            except (OSError, RuntimeError, ValueError, SystemExit) as exc:
                self.last_error = str(exc)
            finally:
                self.post(self.stopped)

        self.current_lan = lan
        self.thread = threading.Thread(target=launch, daemon=True)
        self.thread.start()

    def prepared(self, app, server, adapter):
        self.app, self.server, self.current_adapter = app, server, adapter
        self.last_port = app.state.port
        if self.stop_requested.is_set():
            server.should_exit = True
        self.host_url.set(app.state.host_dashboard_url)
        self.phone_url.set(app.state.connection_url or "Disabled — This PC Only")
        self.details.set(
            f"Sharing mode: {'Offline LAN' if adapter else 'This PC Only'} | Adapter: {adapter.name if adapter else 'Loopback'} | IPv4: {app.state.bind_address} | Port: {app.state.port}"
        )
        if adapter:
            try:
                save_preference(adapter, self.preference_file)
            except OSError as exc:
                self.show_output("Adapter could not be remembered: " + str(exc))

    def stopped(self):
        unexpected = not self.stop_requested.is_set()
        self.thread = self.server = self.app = None
        self.open_button.config(state="disabled")
        self.stop_button.config(state="disabled")
        self.start_button.config(state="normal")
        self.clear_qr()
        self.host_url.set("")
        self.phone_url.set("")
        if self.last_error or unexpected:
            self.status.set("Error")
            self.show_output(
                self.last_error
                or "Server exited unexpectedly. Run Diagnostics, inspect startup logs or refresh networks, then Start to retry."
            )
        else:
            self.status.set("Stopped")
        if self.closing:
            self.root.destroy()
        elif self.pending_restart:
            self.pending_restart = False
            self.root.after(100, self.start)

    def stop(self):
        self.stop_requested.set()
        if self.server:
            self.server.should_exit = True
        if self.thread:
            self.status.set("Stopping")
        else:
            self.status.set("Stopped")

    def restart(self):
        if self.thread:
            self.pending_restart = True
            self.stop()
        else:
            self.start()

    def open_dashboard(self):
        if self.app and self.status.get() == "Running":
            self.browser(self.host_url.get() + "/#host=" + self.app.state.host_token)

    def copy_url(self):
        if self.app and self.app.state.connection_url:
            self.root.clipboard_clear()
            self.root.clipboard_append(self.app.state.connection_url)

    def clear_qr(self):
        self.qr_payload = ""
        self.qr_image = None
        self.qr_label.config(
            image="", text="Enable Offline LAN to display a phone pairing QR."
        )
        self.pairing.set("Phone connectivity: NOT VERIFIED")

    def update_qr(self):
        if not self.app or not self.app.state.connection_url:
            return
        payload = (
            self.app.state.connection_url + "/#code=" + self.app.state.pairing_code
        )
        if payload == self.qr_payload:
            return
        qr = qrcode.QRCode(border=4)
        qr.add_data(payload)
        qr.make(fit=True)
        matrix = qr.get_matrix()
        scale = max(1, 150 // len(matrix))
        image = tk.PhotoImage(width=len(matrix) * scale, height=len(matrix) * scale)
        rows = [
            "{"
            + " ".join(
                ("#000000" if pixel else "#ffffff")
                for pixel in row
                for _ in range(scale)
            )
            + "}"
            for row in matrix
            for _ in range(scale)
        ]
        image.put(" ".join(rows))
        self.qr_image, self.qr_payload = image, payload
        self.qr_label.config(image=image, text="")
        self.pairing.set(
            "Pairing code: "
            + self.app.state.pairing_code
            + " | Phone connectivity: NOT VERIFIED (device identity is not inferred)"
        )

    def tick(self):
        if self.closing:
            return
        if self.status.get() == "Starting" and time.monotonic() - self.started_at > 30:
            self.status.set("Error — startup timed out")
            self.show_output(
                "Server did not pass startup within 30 seconds. Stop, Refresh Networks and restart; no browser was opened."
            )
        if (
            self.app
            and self.server
            and self.server.started
            and not self.probing
            and not self.stop_requested.is_set()
        ):
            self.probing = True
            app = self.app

            def probe():
                try:
                    readiness(app.state.host_dashboard_url, app.state.host_token)
                    self.post(self.probed, app, None)
                except (
                    OSError,
                    RuntimeError,
                    ValueError,
                    KeyError,
                    AssertionError,
                    WebSocketException,
                ) as exc:
                    self.post(self.probed, app, str(exc))

            threading.Thread(target=probe, daemon=True).start()
        self.root.after(1000, self.tick)
        if not self.refreshing and int(time.monotonic()) % 10 == 0:
            self.refresh_networks()

    def probed(self, app, error):
        self.probing = False
        if self.app is not app or self.stop_requested.is_set():
            return
        if error:
            self.status.set("Error — readiness failed")
            self.open_button.config(state="disabled")
            self.show_output(
                error
                + ". Click Run Diagnostics or Restart / Rebind; no browser was opened."
            )
        else:
            self.status.set("Running")
            self.open_button.config(state="normal")
            self.update_qr()
            if not self.opened:
                self.opened = True
                self.open_dashboard()
                if self.current_adapter:
                    self.show_output(
                        f"Profile: {self.current_adapter.profile}. Phone connectivity NOT VERIFIED. Run Diagnostics for local checks and firewall guidance."
                    )

    def diagnostics(self):
        if not self.app:
            self.show_output(
                "Server stopped. Refresh Networks, choose a valid adapter and Start. Check the Error details if startup failed."
            )
            return
        self.diagnostics_button.config(state="disabled")
        app, adapter = self.app, self.current_adapter

        def work():
            try:
                result = run_diagnostics(
                    app.state.host_dashboard_url,
                    app.state.connection_url,
                    app.state.host_token,
                    app.state.bind_address,
                    app.state.port,
                )
                if adapter:
                    fresh = next(
                        (
                            a
                            for a in discover_adapters()
                            if a.identity == adapter.identity
                            and a.ipv4 == adapter.ipv4
                            and a.usable
                        ),
                        None,
                    )
                    result["Current network state"] = (
                        "Connected"
                        if fresh
                        else "Disconnected / DHCP changed — restart required"
                    )
                    adapter_profile = fresh.profile if fresh else "Disconnected"
                    result.update(
                        {
                            "Selected adapter": adapter.name,
                            "LAN IPv4 / subnet": f"{adapter.ipv4} / {adapter.subnet}",
                            "Gateway": adapter.gateway or "none",
                            "Firewall profile": adapter_profile,
                            "Adapter source": adapter.source,
                        }
                    )
                    result["Firewall policy"] = inspect_firewall(
                        sys.executable, app.state.port, adapter.ipv4
                    )
                self.post(self.diagnostics_received, app, result)
            except (
                OSError,
                RuntimeError,
                ValueError,
                KeyError,
                AssertionError,
                WebSocketException,
            ) as exc:
                self.post(
                    self.diagnostics_received, app, {"Diagnostics error": str(exc)}
                )

        threading.Thread(target=work, daemon=True).start()

    def diagnostics_received(self, app, result):
        self.diagnostics_button.config(state="normal")
        if self.app is app:
            self.last_diagnostics = result
            self.show_output(
                "\n".join(f"{key}: {value}" for key, value in result.items())
            )

    def firewall(self):
        if (
            not self.app
            or not self.current_adapter
            or not getattr(sys, "frozen", False)
        ):
            self.show_output(
                "Start Offline LAN in the packaged Windows executable first. See docs/OFFLINE_LAN_GUIDE.md for manual firewall instructions."
            )
            return
        adapter, app = self.current_adapter, self.app
        if adapter.profile != "Private":
            self.show_output(
                "This network is not Private. Confirm it is trusted and change this network's profile yourself in Windows Settings, then Refresh Networks and Restart. FlowDrop will not change it or allow Public traffic."
            )
            return
        if not self.confirm(
            "Allow trusted Private LAN?",
            f"Request administrator approval for TCP {app.state.port}, {sys.executable}, local address {adapter.ipv4}, Private profile, LocalSubnet only? No unrelated rules or profiles will be changed.",
        ):
            return

        def work():
            try:
                result = request_private_rule(
                    sys.executable, app.state.port, adapter.ipv4
                )
            except (
                OSError,
                RuntimeError,
                ValueError,
                KeyError,
                AssertionError,
                WebSocketException,
            ) as exc:
                result = str(exc)
            self.post(self.show_output, result)

        threading.Thread(target=work, daemon=True).start()

    def close(self):
        self.closing = True
        self.pending_restart = False
        self.stop()
        if not self.thread:
            self.root.destroy()


def run_panel():
    root = tk.Tk()
    DesktopPanel(root, auto_start=False)
    root.mainloop()


def panel_smoke():
    """Exercise actual native widgets and lifecycle hidden; no human/phone claim."""
    with tempfile.TemporaryDirectory(prefix="flowdrop-panel-") as directory:
        import os

        old_storage = os.environ.get("FLOWDROP_STORAGE")
        os.environ["FLOWDROP_STORAGE"] = directory
        root = tk.Tk()
        root.withdraw()
        opened = []
        panel = DesktopPanel(
            root,
            browser=opened.append,
            confirm=lambda *_: True,
            preference_file=Path(directory) / "network.json",
        )
        started, phase = time.monotonic(), 0
        result = {}
        error = []

        def check():
            nonlocal phase
            try:
                if time.monotonic() - started > 100:
                    raise RuntimeError(
                        f"Panel smoke timeout at phase {phase}: {panel.status.get()}"
                    )
                if phase == 0 and panel.status.get() == "Running" and panel.adapters:
                    assert panel.host_url.get().startswith("http://127.0.0.1:")
                    assert not panel.qr_payload
                    chosen = choose_adapter(panel.adapters)
                    panel.lan.set(True)
                    panel.selected.set(chosen.label)
                    panel.mode_changed()
                    panel.restart_button.invoke()
                    phase = 1
                elif (
                    phase == 1 and panel.status.get() == "Running" and panel.current_lan
                ):
                    assert (
                        panel.current_adapter.physical
                        and not panel.current_adapter.virtual
                    )
                    assert panel.host_url.get().startswith("http://127.0.0.1:")
                    assert panel.qr_payload.startswith(
                        panel.phone_url.get() + "/#code="
                    )
                    assert panel.app.state.host_token not in panel.qr_payload
                    assert len(opened) == 2
                    result.update(
                        build=BUILD_ID,
                        adapter=panel.current_adapter.name,
                        lan=panel.phone_url.get(),
                        host=panel.host_url.get(),
                        native_qr=True,
                    )
                    from apps.desktop.smoke_acceptance import verify_lan_transfer

                    result["authenticated_transfer"] = verify_lan_transfer(
                        panel.app, panel.host_url.get(), panel.phone_url.get()
                    )
                    panel.diagnostics_button.invoke()
                    phase = 2
                elif phase == 2 and panel.last_diagnostics:
                    assert (
                        panel.last_diagnostics.get(
                            "Local HTTP / frontend / authorization"
                        )
                        == "Passed"
                    ), panel.last_diagnostics
                    assert panel.last_diagnostics.get("Socket check") == "Passed", (
                        panel.last_diagnostics
                    )
                    assert (
                        panel.last_diagnostics.get("WebSocket authorization")
                        == "Passed: denied (1008)"
                    ), panel.last_diagnostics
                    result["diagnostics"] = panel.last_diagnostics
                    panel.current_adapter = replace(
                        panel.current_adapter, ipv4="192.0.2.1"
                    )
                    panel.networks_received(panel.adapters)
                    assert "DHCP" in panel.network.get()
                    result["network_change"] = (
                        "mocked DHCP notification detected; rebind requested"
                    )
                    panel.restart_button.invoke()
                    phase = 3
                elif (
                    phase == 3 and panel.status.get() == "Running" and len(opened) == 3
                ):
                    result["restart"] = "passed"
                    panel.stop_button.invoke()
                    phase = 4
                elif phase == 4 and panel.status.get() == "Stopped":
                    result["shutdown"] = "passed"
                    panel.close()
                    return
                if panel.last_error:
                    raise RuntimeError(panel.last_error)
            except (
                OSError,
                RuntimeError,
                ValueError,
                KeyError,
                AssertionError,
                WebSocketException,
            ) as exc:
                error.append(str(exc))
                panel.close()
                return
            root.after(100, check)

        root.after(100, check)
        root.mainloop()
        if old_storage is None:
            os.environ.pop("FLOWDROP_STORAGE", None)
        else:
            os.environ["FLOWDROP_STORAGE"] = old_storage
        if error:
            raise RuntimeError(error[0])
        print(json.dumps(result), flush=True)
