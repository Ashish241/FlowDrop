export type ChatMessage = {
  id: string;
  from: string;
  text: string;
  recipients?: string[];
  acknowledged?: string[];
};
/** Arrival order is authoritative; receipts update messages in place. */
export function appendMessage(
  messages: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  return messages.some((item) => item.id === message.id)
    ? messages
    : [...messages, message].slice(-30);
}
