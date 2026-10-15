import { test, expect, chromium } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

for (const relay of [false, true]) {
  test(
    relay
      ? "relay-only file transfer through local authenticated coturn TCP"
      : "online file and URL sharing across separate browser processes",
    async ({ request }) => {
      test.setTimeout(90000);
      test.skip(
        relay && !process.env.FLOWDROP_BROWSER_TURN_CONFIG,
        "Disposable local browser TURN fixture not configured",
      );
      const port = relay ? 8769 : 8768;
      const base = `http://127.0.0.1:${port}`;
      const environment = {
        ...process.env,
        FLOWDROP_E2E_PORT: String(port),
        FLOWDROP_E2E_INFRA: "0",
        PYTHONUTF8: "1",
      };
      delete environment.REDIS_URL;
      if (relay) {
        const credentials = JSON.parse(
          await readFile(process.env.FLOWDROP_BROWSER_TURN_CONFIG!, "utf8"),
        );
        Object.assign(environment, {
          FLOWDROP_TURN_SECRET: credentials.secret,
          FLOWDROP_TURN_URL: "turn:127.0.0.1:53579?transport=tcp",
          FLOWDROP_TURN_URLS: "",
          FLOWDROP_ICE_POLICY: "relay",
        });
      }
      const server = spawn("python", ["-m", "scripts.e2e_host"], {
        cwd: path.resolve("../.."),
        env: environment,
        windowsHide: true,
        stdio: "ignore",
      });
      let desktop: ChildProcess | undefined;
      let desktopFolder: string | undefined;
      const left = await chromium.launch(),
        right = await chromium.launch();
      try {
        await expect
          .poll(
            async () => {
              try {
                return (
                  await request.get(base + "/api/health", { timeout: 1000 })
                ).status();
              } catch {
                return 0;
              }
            },
            { timeout: 20000 },
          )
          .toBe(200);
        let a = await left.newPage();
        const b = await right.newPage();
        if (!relay && process.env.FLOWDROP_DESKTOP_EXE) {
          desktopFolder = await mkdtemp(
            path.join(os.tmpdir(), "flowdrop-online-"),
          );
          desktop = spawn(
            process.env.FLOWDROP_DESKTOP_EXE,
            [
              "--no-browser",
              "--port",
              "0",
              "--online-dev",
              "--online-url",
              base,
              "--signal-url",
              base + "/signal",
            ],
            {
              cwd: desktopFolder,
              env: {
                ...process.env,
                FLOWDROP_STORAGE: desktopFolder,
                FLOWDROP_ONLINE_CONFIG: path.join(desktopFolder, "online.json"),
              },
              windowsHide: true,
              stdio: ["ignore", "pipe", "ignore"],
            },
          );
          let output = "";
          desktop.stdout?.on("data", (data) => {
            output += data.toString();
          });
          await expect
            .poll(
              () =>
                output.match(
                  /Host Dashboard URL: (http:\/\/127\.0\.0\.1:\d+)/,
                )?.[1],
              { timeout: 20000 },
            )
            .toBeTruthy();
          const dashboard = output.match(
            /Host Dashboard URL: (http:\/\/127\.0\.0\.1:\d+)/,
          )![1];
          await a.goto(dashboard + "/#online=1");
          const opened = a.waitForEvent("popup");
          await a
            .getByRole("link", { name: "Open hosted Online Share" })
            .click();
          a = await opened;
          await expect(a).toHaveURL(base + "/#online=1");
        } else await a.goto(base + "/#online=1");
        if (relay)
          await a.getByRole("checkbox", { name: /Relay-only/ }).check();
        await a
          .getByRole("button", { name: "Create room", exact: true })
          .click();
        await expect(a.getByLabel("Room invitation")).toHaveValue(
          /[a-f0-9]{32}/,
        );
        const invitation = await a
          .getByRole("link", { name: /#online-room=/ })
          .getAttribute("href");
        await b.goto(invitation!);
        if (relay)
          await b.getByRole("checkbox", { name: /Relay-only/ }).check();
        await b.getByRole("button", { name: "Join room", exact: true }).click();
        await a
          .getByRole("button", { name: "Approve receiver", exact: true })
          .click();
        await expect(a.getByRole("status")).toContainText("Connected.", {
          timeout: 30000,
        });
        await expect(b.getByRole("status")).toContainText("Connected.");
        if (relay)
          await expect(a.getByRole("status")).toContainText("TURN relay");
        await b
          .getByPlaceholder("Share text with your peer")
          .fill("https://example.com/online-process-test");
        await b.getByRole("button", { name: "Send text", exact: true }).click();
        await expect(a.locator("pre")).toContainText(
          "https://example.com/online-process-test",
        );
        const bytes = Buffer.alloc(relay ? 262161 : 16 * 1048576 + 17, 83);
        await a.locator("input[type=file]").setInputFiles({
          name: relay ? "relayed.bin" : "separate-process.bin",
          mimeType: "application/octet-stream",
          buffer: bytes,
        });
        const downloading = b.waitForEvent("download");
        await b
          .getByRole("button", { name: "Accept file", exact: true })
          .click();
        expect(await readFile((await (await downloading).path())!)).toEqual(
          bytes,
        );
        await expect(b.getByRole("status")).toContainText("SHA-256 verified");
        await a.getByRole("button", { name: "End room", exact: true }).click();
      } finally {
        const processes = [server, desktop].filter(
          (item): item is ChildProcess => !!item,
        );
        const stopped = processes.map((item) =>
          item.exitCode !== null || item.signalCode !== null
            ? Promise.resolve()
            : new Promise<void>((resolve) =>
                item.once("exit", () => resolve()),
              ),
        );
        for (const item of processes) item.kill();
        await Promise.all([left.close(), right.close(), ...stopped]);
        if (
          desktopFolder &&
          path
            .resolve(desktopFolder)
            .startsWith(path.join(os.tmpdir(), "flowdrop-online-"))
        )
          await rm(desktopFolder, { recursive: true, force: true });
      }
    },
  );
}
