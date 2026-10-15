import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
test("paired devices expose bidirectional file controls and transfer real bytes both ways", async ({
  browser,
}, info) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    for (const context of [ac, bc])
      await context.addInitScript(() => {
        const state = {
          peers: [] as RTCPeerConnection[],
          channels: [] as RTCDataChannel[],
          sockets: [] as WebSocket[],
        };
        Object.assign(window, { flowdropProbe: state });
        const Peer = RTCPeerConnection,
          Socket = WebSocket;
        window.RTCPeerConnection = class extends Peer {
          constructor(config?: RTCConfiguration) {
            super(config);
            state.peers.push(this);
            this.addEventListener("datachannel", (e) =>
              state.channels.push(e.channel),
            );
          }
          createDataChannel(label: string, options?: RTCDataChannelInit) {
            const dc = super.createDataChannel(label, options);
            state.channels.push(dc);
            return dc;
          }
        };
        window.WebSocket = class extends Socket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            state.sockets.push(this);
          }
        };
      });
    const a = await ac.newPage(),
      b = await bc.newPage();
    const errors: string[] = [];
    for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
    await a.goto("/");
    await b.goto("/");
    await a.getByRole("button", { name: "Send Files", exact: true }).click();
    const left = a.getByRole("region", { name: "File sharing" }),
      right = b.getByRole("region", { name: "File sharing" });
    await a.getByLabel("Browse Files", { exact: true }).setInputFiles({
      name: "a-to-b.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(1048583, 41),
    });
    await left.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(left.locator(".code")).toHaveText(/\d{3} \d{3}/);
    await b.getByRole("button", { name: "Receive Files", exact: true }).click();
    await b
      .getByLabel("Pairing code", { exact: true })
      .fill((await left.locator(".code").innerText()).replace(/\s/g, ""));
    await right.getByRole("button", { name: "Join", exact: true }).click();
    await left
      .getByRole("button", { name: "Approve receiver", exact: true })
      .click();
    for (const p of [a, b])
      await expect
        .poll(() =>
          p.evaluate(() =>
            (
              window as unknown as {
                flowdropProbe: { channels: RTCDataChannel[] };
              }
            ).flowdropProbe.channels.some((c) => c.readyState === "open"),
          ),
        )
        .toBe(true);
    const snapshots = [];
    for (const p of [a, b])
      snapshots.push(
        await p.evaluate(() => {
          const s = (
            window as unknown as {
              flowdropProbe: {
                peers: RTCPeerConnection[];
                channels: RTCDataChannel[];
                sockets: WebSocket[];
              };
            }
          ).flowdropProbe;
          return {
            peers: s.peers.map((p) => ({
              connection: p.connectionState,
              ice: p.iceConnectionState,
            })),
            channels: s.channels.map((c) => c.readyState),
            websockets: s.sockets.map((w) => w.readyState),
            ui: document.querySelector(".flow-state")?.textContent,
            phase: document.querySelector<HTMLElement>(".share-flow")?.dataset.connectionPhase,
            membership: document.querySelector<HTMLElement>(".share-flow")?.dataset.member,
            selected: [...document.querySelectorAll(".selected-files li")].map(
              (n) => n.textContent,
            ),
          };
        }),
      );
    await writeFile(resolve(process.cwd(), "../../.flowdrop/post-connection-state.json"), JSON.stringify({website:info.project.use.baseURL, snapshots},null,2));
    await info.attach("post-connection-state", {
      body: JSON.stringify(snapshots, null, 2),
      contentType: "application/json",
    });
    for (const panel of [left, right]) {
      await expect(
        panel.getByRole("button", { name: "Send Files", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Send Files", exact: true }),
      ).toBeEnabled();
      await expect(
        panel.getByText("Share Text", { exact: true }),
      ).toBeVisible();
    }
    await left.getByRole("button", { name: "Send", exact: true }).click();
    let download = b.waitForEvent("download");
    await right
      .getByRole("button", { name: "Accept file", exact: true })
      .click();
    expect(await readFile((await (await download).path())!)).toEqual(
      Buffer.alloc(1048583, 41),
    );
    await expect(left.getByRole("status")).toHaveText("Completed");
    await b.getByLabel("Browse Files", { exact: true }).setInputFiles({
      name: "b-to-a.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0, 255, 1, 2, 13, 10, 99]),
    });
    await right.getByRole("button", { name: "Send", exact: true }).click();
    download = a.waitForEvent("download");
    await left
      .getByRole("button", { name: "Accept file", exact: true })
      .click();
    expect(await readFile((await (await download).path())!)).toEqual(
      Buffer.from([0, 255, 1, 2, 13, 10, 99]),
    );
    for (const [sender, receiver] of [
      [left, right],
      [right, left],
    ]) {
      if ((await sender.locator(".text-share").getAttribute("open")) === null)
        await sender.getByText("Share Text", { exact: true }).click();
      await sender
        .getByLabel("Message", { exact: true })
        .fill("<script>not executable</script> https://example.org");
      await sender
        .getByRole("button", { name: "Send text", exact: true })
        .click();
      if ((await receiver.locator(".text-share").getAttribute("open")) === null)
        await receiver.getByText("Share Text", { exact: true }).click();
      await expect(receiver.locator(".text-share pre").last()).toContainText(
        "<script>not executable</script>",
      );
    }
    await b.setViewportSize({ width: 390, height: 844 });
    await expect(
      right.getByRole("button", { name: "Send Files", exact: true }),
    ).toBeVisible();
    expect(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await left.getByRole("button", { name: "End share", exact: true }).click();
    await expect(left.getByRole("status")).toHaveText("Ready to share");
  } finally {
    await ac.close();
    await bc.close();
  }
});
