/**
 * Persistent outbox. Everything the user submits is written here first and
 * only removed after Apps Script answers {ok: true}. Retries happen on app
 * start, when the device comes back online, when the app is brought to the
 * foreground, and on a timer while anything is still pending.
 */
import { NetworkError, sendCompliment, sendEntry, type Entry } from './api';
import { config } from './config';
import { readJson, writeJson } from './storage';

export type QueueItem =
  | { id: string; action: 'addEntry'; entry: Entry }
  | { id: string; action: 'addCompliment'; name: string };

const KEY = 'queue';
const listeners = new Set<() => void>();
let flushing: Promise<number> | null = null;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getQueue(): QueueItem[] {
  return readJson<QueueItem[]>(KEY, []);
}

function setQueue(items: QueueItem[]): boolean {
  const ok = writeJson(KEY, items);
  listeners.forEach((l) => l());
  return ok;
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns false only if the item could not be persisted locally. */
export function enqueue(item: QueueItem): boolean {
  return setQueue([...getQueue(), item]);
}

function remove(id: string) {
  // Re-read so items enqueued while a request was in flight are kept.
  setQueue(getQueue().filter((i) => i.id !== id));
}

async function send(item: QueueItem) {
  if (item.action === 'addEntry') await sendEntry(item.entry);
  else await sendCompliment(item.name);
}

/**
 * Sends queued items in order. Resolves to the number delivered.
 * A network failure stops the pass (everything else would fail too); a
 * server-side rejection skips just that item so it can't block the others.
 */
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let delivered = 0;
    for (const item of getQueue()) {
      try {
        await send(item);
        remove(item.id);
        delivered++;
      } catch (e) {
        if (e instanceof NetworkError) break;
        console.warn('Queued item rejected; will retry later', item.id, e);
      }
    }
    return delivered;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Wire up automatic retries. Returns a function that stops them. */
export function startAutoRetry(onDelivered: () => void): () => void {
  const run = () => {
    void flushQueue().then((n) => n > 0 && onDelivered());
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => {
    if (getQueue().length > 0) run();
  }, config.retryIntervalMs);
  run();
  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}
