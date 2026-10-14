import { test, expect } from "@playwright/test";

test("pairing QR uses the selected LAN address even on a loopback dashboard", async ({
  page,
}) => {
  const connection = "http://192.168.43.105:8000";
  let code = "";
  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    const session = await response.json();
    code = session.pairing_code;
    await route.fulfill({
      response,
      json: { ...session, connection_url: connection },
    });
  });
  await page.goto("/#host=e2e-host-only");
  await page.getByRole("button", { name: "Offline LAN", exact: true }).click();
  await expect(
    page.getByText("Connection URL: " + connection, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Scan to connect to this LAN host"),
  ).toHaveAttribute("src", /^data:image/);
  await page.route("**/__test_jsqr.js", (route) =>
    route.fulfill({
      path: "node_modules/jsqr/dist/jsQR.js",
      contentType: "application/javascript",
    }),
  );
  await page.addScriptTag({ url: "/__test_jsqr.js" });
  const decoded = await page
    .getByAltText("Scan to connect to this LAN host")
    .evaluate((element) => {
      const image = element as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const decoder = (
        window as unknown as {
          jsQR: (
            data: Uint8ClampedArray,
            width: number,
            height: number,
          ) => { data: string } | null;
        }
      ).jsQR;
      return decoder(pixels.data, pixels.width, pixels.height)?.data;
    });
  expect(decoded).toBe(connection + "/#code=" + code);
});
