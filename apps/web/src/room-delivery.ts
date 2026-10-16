export type DeliveryState =
  | "Preparing"
  | "Request sent"
  | "Waiting for approval"
  | "Accepted"
  | "Sending"
  | "Paused"
  | "Verifying"
  | "Verified"
  | "Declined"
  | "Failed"
  | "Cancelled";
export type Delivery = {
  attempt: string;
  state: DeliveryState;
  progress: number;
  hidden?: boolean;
  name?: string;
};
export type AttachmentTransfer = {
  id: string;
  file: File;
  recipients: Record<string, Delivery>;
};
export type DeliveryUpdate = {
  attachment: string;
  attempt: string;
  state: DeliveryState;
  progress: number;
};
export const terminal = (state: DeliveryState) =>
  ["Verified", "Declined", "Failed", "Cancelled"].includes(state);
export function updateDelivery(
  rows: AttachmentTransfer[],
  recipient: string,
  update: DeliveryUpdate,
): AttachmentTransfer[] {
  return rows.map((row) => {
    const before = row.recipients[recipient];
    if (
      row.id !== update.attachment ||
      !before ||
      before.attempt !== update.attempt ||
      terminal(before.state)
    )
      return row;
    return {
      ...row,
      recipients: {
        ...row.recipients,
        [recipient]: {
          ...before,
          state: update.state,
          progress:
            update.state === "Verified" ? 100 : Math.min(99.9, update.progress),
        },
      },
    };
  });
}
export function allVerified(row: AttachmentTransfer) {
  const values = Object.values(row.recipients);
  return (
    values.length > 0 && values.every((value) => value.state === "Verified")
  );
}
export function selectNewMembers(
  selected: string[],
  seen: Set<string>,
  members: Array<{ id: string; online: boolean }>,
  self: string,
) {
  const available = new Set(
    members.filter((member) => member.id !== self).map((member) => member.id),
  );
  const next = selected.filter((id) => available.has(id));
  for (const member of members)
    if (member.id !== self && member.online && !seen.has(member.id)) {
      seen.add(member.id);
      if (!next.includes(member.id)) next.push(member.id);
    }
  return next;
}
