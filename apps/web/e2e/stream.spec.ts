import { test, expect } from "@playwright/test";
test("download worker activates on the locally served interface", async ({
  page,
  context,
}) => {
  page.on("console", (message) => {
    if (message.type() === "error") console.log(message.text());
  });
  context.on("serviceworker", (worker) =>
    console.log("worker observed:", worker.url()),
  );
  await page.goto("/");
  const state = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.register("/stream-sw.js", {
      scope: "/",
    });
    return {
      scope: r.scope,
      active: r.active?.state,
      installing: r.installing?.state,
      waiting: r.waiting?.state,
      controller: navigator.serviceWorker.controller?.state,
    };
  });
  console.log("registration state:", state);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const r = await navigator.serviceWorker.getRegistration();
          return r?.active?.state;
        }),
      { timeout: 15000 },
    )
    .toBe("activated");
});
