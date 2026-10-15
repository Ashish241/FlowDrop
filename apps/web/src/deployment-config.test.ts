import { expect, it } from "vitest";
import { productionSignalingEndpoint } from "./deployment-config";
it("rejects missing, local, insecure and placeholder Pages endpoints", () => {
  for (const value of [
    undefined,
    "",
    "/signal",
    "http://site.onrender.com/signal",
    "https://localhost/signal",
    "https://127.0.0.1/signal",
    "https://192.168.1.7/signal",
    "https://host.local/signal",
    "https://example.com/signal",
    "https://site.invalid/signal",
    "https://user:secret@site.onrender.com/signal",
    "https://site.onrender.com/signal?token=secret",
    "https://site.onrender.com/wrong",
  ]) {
    expect(() => productionSignalingEndpoint(value)).toThrow();
  }
});
it("normalizes a public Render endpoint without inventing a deployed service", () => {
  expect(
    productionSignalingEndpoint(
      "https://unit-test-signaling.onrender.com/signal/",
    ),
  ).toBe("https://unit-test-signaling.onrender.com/signal");
});
