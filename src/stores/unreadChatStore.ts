/**
 * Simple store for tracking unread chat messages.
 * Used to show badge indicator on the chat tab.
 */

type Listener = (count: number) => void;

let unreadCount = 0;
const listeners: Set<Listener> = new Set();

export function getUnreadCount(): number {
  return unreadCount;
}

export function setUnreadCount(count: number): void {
  unreadCount = Math.max(0, count);
  listeners.forEach((listener) => listener(unreadCount));
}

export function incrementUnread(count = 1): void {
  setUnreadCount(unreadCount + count);
}

export function clearUnread(): void {
  setUnreadCount(0);
}

export function subscribeToUnread(listener: Listener): () => void {
  listeners.add(listener);
  // Immediately call with current value
  listener(unreadCount);
  return () => {
    listeners.delete(listener);
  };
}
