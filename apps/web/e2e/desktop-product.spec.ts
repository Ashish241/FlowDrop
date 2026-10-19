import { test, expect } from "@playwright/test";
test("LAN bytes do not imply integrity-verified completion", async ({
  page,
}) => {
  await page.route("**/api/transfers", (route) =>
    route.fulfill({
      json: [
        {
          id: "a".repeat(32),
          name: "pending-hash.zip",
          size: 1024,
          received: 1024,
          sender: "host",
          recipient: "peer",
          state: "PAUSED",
          sha256: "b".repeat(64),
        },
      ],
    }),
  );
  await page.goto("/#host=e2e-host-only");
  await expect(
    page.getByText("pending-hash.zip", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("article.transfer progress")).toHaveAttribute(
    "value",
    "99.9",
  );
  await expect(page.locator("article.transfer")).not.toContainText("100%");
  await expect(page.locator("article.transfer")).not.toContainText(
    "SHA-256 verified",
  );
});
test("offline desktop omits online controls, endpoints and resources", async ({
  page,
  request,
}) => {
  const external: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).origin !== "http://127.0.0.1:8771")
      external.push(req.url());
  });
  await page.goto("/#host=e2e-host-only");
  await expect(
    page.getByRole("button", { name: "Online Share", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Send Later", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Send something good" }),
  ).toBeVisible();
  expect((await request.get("/signal/health")).status()).toBe(404);
  expect((await request.get("/api/online/config")).status()).toBe(404);
  expect(external).toEqual([]);
});

test("LAN cancellation confirms, waits for acknowledgement and retries inline", async ({
  page,
}) => {
  let present = true,
    deletes = 0;
  const id = "c".repeat(32);
  await page.route("**/api/transfers", (route) =>
    route.fulfill({
      json: present
        ? [
            {
              id,
              name: "cancel-me.bin",
              size: 10,
              received: 0,
              sender: "host",
              recipient: "peer",
              state: "PAUSED",
              sha256: "d".repeat(64),
            },
          ]
        : [],
    }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/transfers/${id}`, async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.continue();
      return;
    }
    deletes++;
    if (deletes === 1) {
      await gate;
      await route.fulfill({
        status: 503,
        json: { detail: "Temporary cancellation outage" },
      });
    } else {
      present = false;
      await route.fulfill({ json: { status: "cancelled" } });
    }
  });
  await page.goto("/#host=e2e-host-only");
  await page
    .getByRole("button", { name: "Cancel / delete", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Cancel transfer?" });
  await page.screenshot({
    path: "../../.flowdrop/ui-consistency-lan-cancel.png",
    fullPage: true,
  });
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(deletes).toBe(0);
  await page
    .getByRole("button", { name: "Cancel / delete", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Cancel transfer", exact: true })
    .click();
  await expect(
    modal.getByRole("button", { name: "Cancelling transfer…" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  await expect(page.locator("article.transfer")).toContainText("cancel-me.bin");
  release();
  await expect(modal.getByRole("alert")).toContainText(
    "Temporary cancellation outage",
  );
  await modal
    .getByRole("button", { name: "Cancel transfer", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator("article.transfer")).toHaveCount(0);
  expect(deletes).toBe(2);
});
