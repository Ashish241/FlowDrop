import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const fallback of [false, true])
  test(`consumer retains preconnection files and transfers after approval (memory fallback: ${fallback})`, async ({
    browser,
  }) => {
    const l = await browser.newContext(),
      r = await browser.newContext();
    try {
      if (fallback)
        await r.addInitScript(() => {
          Object.defineProperty(navigator.serviceWorker, "register", {
            value: async () => {
              throw new Error("Registration denied");
            },
          });
        });
      const a = await l.newPage(),
        b = await r.newPage();
      await a.goto("/");
      await b.goto("/");
      await a.getByRole("button", { name: "Send Files", exact: true }).click();
      const left = a.getByRole("region", { name: "File sharing" });
      await expect(
        left.getByRole("button", { name: "Continue", exact: true }),
      ).toBeDisabled();
      const payloads = [
        Buffer.alloc(2 * 1048576 + 3, 37),
        Buffer.from("second file retained before connection"),
      ];
      await a.getByLabel("Browse Files", { exact: true }).setInputFiles(
        payloads.map((buffer, i) => ({
          name: `queued-${i}.bin`,
          mimeType: "application/octet-stream",
          buffer,
        })),
      );
      await expect(
        left.getByRole("list", { name: "Selected files" }),
      ).toContainText("queued-0.bin");
      await expect(
        left.getByRole("button", { name: "Cancel transfer", exact: true }),
      ).not.toBeVisible();
      await expect(
        left.getByText("Relay-only test", { exact: false }),
      ).not.toBeVisible();
      await left.getByRole("button", { name: "Continue", exact: true }).click();
      const code = left.locator(".code");
      await expect(code).toHaveText(/\d{3} \d{3}/);
      await b
        .getByRole("button", { name: "Receive Files", exact: true })
        .click();
      await b
        .getByLabel("Pairing code", { exact: true })
        .fill((await code.innerText()).replace(/\s/g, ""));
      const right = b.getByRole("region", { name: "File sharing" });
      await right.getByRole("button", { name: "Join", exact: true }).click();
      await expect(right.getByRole("status")).toContainText(
        "Waiting for approval",
      );
      await left
        .getByRole("button", { name: "Approve receiver", exact: true })
        .click();
      await left.getByRole("button", { name: "Send", exact: true }).click();
      for (const [i, bytes] of payloads.entries()) {
        await expect(right.locator(".incoming")).toContainText(
          `queued-${i}.bin`,
        );
        if (i === 0)
          await left
            .getByRole("button", { name: "Pause transfer", exact: true })
            .click();
        const download = b.waitForEvent("download");
        await right
          .getByRole("button", { name: "Accept file", exact: true })
          .click();
        if (i === 0) {
          await expect(left.getByRole("status")).toHaveText("Paused");
          await left
            .getByRole("button", { name: "Resume transfer", exact: true })
            .click();
        }
        if (fallback)
          await right
            .getByRole("button", { name: `Save queued-${i}.bin`, exact: true })
            .click();
        expect(await readFile((await (await download).path())!)).toEqual(bytes);
      }
      await expect(left.getByRole("status")).toHaveText("Completed");
      await expect(right.getByRole("status")).toHaveText("Completed");
      await left.getByText("Share Text", { exact: true }).click();
      await left
        .getByLabel("Message", { exact: true })
        .fill("Consumer text after queued files");
      await left
        .getByRole("button", { name: "Send text", exact: true })
        .click();
      await right.getByText("Share Text", { exact: true }).click();
      await expect(right.locator(".text-share pre")).toContainText(
        "Consumer text after queued files",
      );
      await a.setViewportSize({ width: 390, height: 844 });
      expect(
        await a.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await left
        .getByRole("button", { name: "End share", exact: true })
        .click();
    } finally {
      await l.close();
      await r.close();
    }
  });

test("consumer invalid pairing has a useful error and retained selection can start again", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Receive Files", exact: true })
    .click();
  await page.getByLabel("Pairing code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.locator(".flow-error")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry connection", exact: true }),
  ).toBeVisible();
});
