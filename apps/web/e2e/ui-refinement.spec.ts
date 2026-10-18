import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Optical flow cards, responsive themes and permission guidance", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Optical Share", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Send via Screen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Receive via Camera" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Optical sender" }),
  ).toBeHidden();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "Send via Screen" }).click();
      await expect(
        page.getByLabel("Optical text", { exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Parity per 8 data frames")).toBeHidden();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../../.flowdrop/ui-optical-send-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Receive via Camera" }).click();
      await expect(
        page.getByRole("button", { name: "Start camera", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/enable Camera in your browser/),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Recover Missing Frames",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Download reconstructed/ }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../../.flowdrop/ui-optical-receive-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
