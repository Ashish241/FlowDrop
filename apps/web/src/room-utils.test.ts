import { describe, it, expect } from "vitest";
import { formatSize, mergeAttachments, invitationCode } from "./room-utils";
describe("Online attachment utilities", () => {
  it("formats decimal sizes consistently", () => {
    expect(
      [0, 850, 24600, 3200000, 1400000000, 2200000000000].map(formatSize),
    ).toEqual(["0 B", "850 B", "24.6 KB", "3.2 MB", "1.4 GB", "2.2 TB"]);
  });
  it("keeps original File references while adding, deduplicating, and removing attachments", () => {
    const a = new File(["a"], "a.txt", { lastModified: 1 }),
      b = new File(["b"], "b.txt", { lastModified: 2 });
    const files = mergeAttachments([a], [a, b]);
    expect(files).toHaveLength(2);
    expect(files[0]).toBe(a);
    expect(files[1]).toBe(b);
  });
  it("only decodes same-site room invitations", () => {
    expect(
      invitationCode(
        "https://share.example/#room=123456",
        "https://share.example",
      ),
    ).toBe("123456");
    for (const url of [
      "https://evil.example/#room=123456",
      "https://share.example/#room=abcdef",
      "https://share.example/?token=secret#room=123456",
      "https://share.example/#room=123456&token=secret",
    ])
      expect(() => invitationCode(url, "https://share.example")).toThrow();
  });
});
