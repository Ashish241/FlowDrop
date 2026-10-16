import { describe, expect, it } from "vitest";
import {
  allVerified,
  selectNewMembers,
  updateDelivery,
  type AttachmentTransfer,
} from "./room-delivery";
describe("room deliveries", () => {
  it("retains partial success and rejects stale attempts and terminal downgrades", () => {
    const file = new File(["bytes"], "a.txt");
    const rows: AttachmentTransfer[] = [
      {
        id: "file",
        file,
        recipients: {
          a: { attempt: "a1", state: "Sending", progress: 40 },
          b: { attempt: "b1", state: "Waiting for approval", progress: 0 },
        },
      },
    ];
    let next = updateDelivery(rows, "a", {
      attachment: "file",
      attempt: "a1",
      state: "Verified",
      progress: 100,
    });
    expect(allVerified(next[0])).toBe(false);
    next = updateDelivery(next, "b", {
      attachment: "file",
      attempt: "old",
      state: "Verified",
      progress: 100,
    });
    expect(next[0].recipients.b.state).toBe("Waiting for approval");
    next = updateDelivery(next, "b", {
      attachment: "file",
      attempt: "b1",
      state: "Declined",
      progress: 0,
    });
    expect(next[0].file).toBe(file);
    expect(allVerified(next[0])).toBe(false);
    next = updateDelivery(next, "a", {
      attachment: "file",
      attempt: "a1",
      state: "Failed",
      progress: 0,
    });
    expect(next[0].recipients.a.state).toBe("Verified");
    next[0] = {
      ...next[0],
      recipients: {
        ...next[0].recipients,
        b: { attempt: "b2", state: "Sending", progress: 20 },
      },
    };
    next = updateDelivery(next, "b", {
      attachment: "file",
      attempt: "b1",
      state: "Failed",
      progress: 0,
    });
    expect(next[0].recipients.b.state).toBe("Sending");
    next = updateDelivery(next, "b", {
      attachment: "file",
      attempt: "b2",
      state: "Verified",
      progress: 100,
    });
    expect(allVerified(next[0])).toBe(true);
  });
  it("selects new identities once and preserves deliberate deselection", () => {
    const seen = new Set<string>();
    const members = [
      { id: "self", online: true },
      { id: "phone", online: true },
      { id: "tablet", online: false },
    ];
    expect(selectNewMembers([], seen, members, "self")).toEqual(["phone"]);
    expect(selectNewMembers([], seen, members, "self")).toEqual([]);
    expect(
      selectNewMembers(
        [],
        seen,
        members.map((m) => ({ ...m, online: true })),
        "self",
      ),
    ).toEqual(["tablet"]);
    expect(selectNewMembers(["phone"], seen, [members[0]], "self")).toEqual([]);
    expect(
      selectNewMembers(
        [],
        seen,
        [...members, { id: "phone-new", online: true }],
        "self",
      ),
    ).toEqual(["phone-new"]);
  });
});
