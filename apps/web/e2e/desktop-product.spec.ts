import { test, expect } from "@playwright/test";
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
