import { expect, test } from "vitest";
import { FairScheduler } from "./queue";

test("round robin admits later transfers before draining a large queued transfer", async () => {
  const scheduler = new FairScheduler(1);
  const order: string[] = [];
  let release!: () => void;
  const first = scheduler.run("large", async () => {
    order.push("large");
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  await Promise.resolve();
  const large = Array.from({ length: 5 }, () =>
    scheduler.run("large", async () => {
      order.push("large");
    }),
  );
  const small = scheduler.run("small", async () => {
    order.push("small");
  });
  release();
  await Promise.all([first, ...large, small]);
  expect(order.indexOf("small")).toBe(1);
});

test("failed work releases capacity and never runs two requests for one transfer", async () => {
  const scheduler = new FairScheduler(2);
  const active = new Set<string>();
  let maximum = 0;
  const jobs = ["a", "a", "b", "c"].map((id, index) =>
    scheduler.run(id, async () => {
      expect(active.has(id)).toBe(false);
      active.add(id);
      maximum = Math.max(maximum, active.size);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active.delete(id);
      if (index === 0) throw new Error("network interruption");
    }),
  );
  const results = await Promise.allSettled(jobs);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
  expect(maximum).toBe(2);
  expect(active.size).toBe(0);
});
