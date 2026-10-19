import { expect, test } from "vitest";
import { appendMessage } from "./chat";
test("rapid arrivals keep chronological order and replay does not reorder receipts", () => {
  const first = {
    id: "sender:a",
    from: "Phone",
    text: "first",
    acknowledged: ["peer"],
  };
  const messages = appendMessage([first], {
    id: "sender:b",
    from: "Phone",
    text: "second",
  });
  expect(messages.map((item) => item.text)).toEqual(["first", "second"]);
  expect(appendMessage(messages, first)).toBe(messages);
  expect(messages[0].acknowledged).toEqual(["peer"]);
});
test("history retains the latest thirty in arrival order", () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    from: "You",
    text: String(index),
  }));
  expect(
    appendMessage(messages, { id: "30", from: "You", text: "30" }).map(
      (item) => item.id,
    ),
  ).toEqual(Array.from({ length: 30 }, (_, index) => String(index + 1)));
});
