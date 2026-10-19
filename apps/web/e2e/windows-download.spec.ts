import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Windows download preserves four primary modes and identifies the verified portable release", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".home-actions .home-card")).toHaveCount(4);
  const card = page.getByRole("region", {
    name: "FlowDrop for Windows",
    exact: true,
  });
  await expect(
    card.getByRole("link", { name: "Download for Windows" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/Ashish241/FlowDrop/releases/download/v0.4.2-preview.1/FlowDrop-windows.zip",
  );
  await card.getByRole("button", { name: "Learn More", exact: true }).click();
  await expect(page).toHaveURL(/#\/windows$/);
  await expect(page.locator(".windows-checksum")).toHaveText(
    "674c7109ad2e265e3c6106742cc9f53c0455f1b37bcb53fe57818e4c7258c70e",
  );
  await expect(
    page.getByText(
      /Clean-PC, phone LAN and physical camera acceptance remain unverified/,
    ),
  ).toBeVisible();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Back to Home", exact: true }).click();
  await expect(page.locator(".home-actions .home-card")).toHaveCount(4);
});
