import { Monitor, Download } from "lucide-react";
import { BackNavigation } from "./ui/shared";
import "./windows-download.css";

export const windowsRelease = {
  version: "0.4.2-preview.1",
  bytes: 25389518,
  sha256: "674c7109ad2e265e3c6106742cc9f53c0455f1b37bcb53fe57818e4c7258c70e",
  url: "https://github.com/Ashish241/FlowDrop/releases/download/v0.4.2-preview.1/FlowDrop-windows.zip",
  notes: "https://github.com/Ashish241/FlowDrop/releases/tag/v0.4.2-preview.1",
};

export function DownloadCard({ onLearnMore }: { onLearnMore?: () => void }) {
  return (
    <section
      className="windows-download-card"
      aria-label="FlowDrop for Windows"
    >
      <Monitor size={34} aria-hidden="true" />
      <div>
        <span className="eyebrow">OFFLINE LAN · WINDOWS x64</span>
        <h2>FlowDrop for Windows</h2>
        <p>Share files without internet using your local network.</p>
        <small>
          Portable ZIP · v{windowsRelease.version} ·{" "}
          {(windowsRelease.bytes / 1048576).toFixed(1)} MiB · unsigned preview
        </small>
      </div>
      <div className="windows-download-actions">
        {onLearnMore && <button onClick={onLearnMore}>Learn More</button>}
        <a className="windows-download-link" href={windowsRelease.url}>
          <Download size={18} aria-hidden="true" />
          Download for Windows
        </a>
      </div>
    </section>
  );
}

export function WindowsDownloadPage({ onHome }: { onHome: () => void }) {
  const steps = [
    "Download and extract the entire portable ZIP. Keep FlowDrop.exe beside the _internal folder.",
    "Launch FlowDrop. Sharing starts stopped, with LAN disabled.",
    "Connect all devices to the same accessible Wi-Fi, Ethernet network or hotspot.",
    "Enable Offline LAN Sharing and confirm the physical Wi-Fi/Ethernet adapter.",
    "Press Start, then open the displayed LAN address or pairing QR on the other device.",
    "Enter the pairing code and approve the device in the host dashboard.",
    "Choose recipients, offer files and accept them on the receiver. Keep the host running.",
  ];
  return (
    <section className="windows-download-page">
      <BackNavigation onBack={onHome} />
      <h1>Your devices. Your local network.</h1>
      <p>
        FlowDrop Offline is a Windows sharing host. Other devices connect
        through their browser; internet is not needed for local file
        transmission.
      </p>
      <DownloadCard />
      <div className="windows-guide-grid">
        <section className="panel">
          <h2>Set up local sharing</h2>
          <ol>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <aside className="panel">
          <h2>Before you connect</h2>
          <p>
            Supports PC ↔ PC, PC ↔ mobile, and mobile ↔ mobile through an
            available Windows host. Every device needs the same accessible local
            network.
          </p>
          <h3>Trusted Private networks only</h3>
          <p>
            If Windows blocks inbound access, allow FlowDrop on your trusted
            Private network, limited to the local subnet. The app offers an
            explicit Private LAN firewall helper that requires your approval.
            Keep the firewall enabled; avoid Public network allowances.
          </p>
          <p>
            LAN HTTP is unencrypted. Guest networks and hotspot client isolation
            can block devices from reaching each other.
          </p>
          <h3>Preview verification</h3>
          <p>
            Packaged startup, start/stop, pairing authorization and hash-matched
            local transfers were tested on Windows. Clean-PC, phone LAN and
            physical camera acceptance remain unverified. This is an unsigned
            portable preview, not an installer.
          </p>
        </aside>
      </div>
      <section className="panel">
        <h2>Release details</h2>
        <p>
          Windows x64 · {windowsRelease.bytes.toLocaleString()} bytes ·{" "}
          <a href={windowsRelease.notes}>Release notes and verification</a>
        </p>
        <p>SHA-256 of FlowDrop-windows.zip</p>
        <code className="windows-checksum">{windowsRelease.sha256}</code>
        <p>
          Extract the complete archive. Downloading the EXE alone would omit
          required runtime files. Never add hosting credentials to the package.
        </p>
      </section>
    </section>
  );
}
