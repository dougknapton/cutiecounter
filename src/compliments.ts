/**
 * The compliment list shown on screen 1. The last list fetched from the Sheet
 * is cached so the screen works offline; counts include entries that are
 * still waiting in the queue.
 */
import { fetchCompliments, type ServerCompliment } from './api';
import { seedCompliments } from './labels';
import { getQueue } from './queue';
import { readJson, writeJson } from './storage';

const KEY = 'compliments';

export type Compliment = { name: string; count: number };

const norm = (s: string) => s.trim().toLocaleLowerCase();

function cached(): ServerCompliment[] {
  return readJson<ServerCompliment[] | null>(KEY, null) ?? seedCompliments.map((name) => ({ name, count: 0 }));
}

/** Server list + anything added/submitted locally that hasn't synced yet. */
export function currentCompliments(): Compliment[] {
  const byKey = new Map<string, Compliment>();
  for (const c of cached()) byKey.set(norm(c.name), { ...c });
  for (const item of getQueue()) {
    const name = item.action === 'addEntry' ? item.entry.compliment : item.name;
    const key = norm(name);
    const existing = byKey.get(key) ?? { name, count: 0 };
    if (item.action === 'addEntry') existing.count++;
    byKey.set(key, existing);
  }
  return [...byKey.values()];
}

/** Fetch the list from the Sheet. Returns false (and keeps the cache) on failure. */
export async function refreshCompliments(): Promise<boolean> {
  try {
    const list = await fetchCompliments();
    writeJson(KEY, list);
    return true;
  } catch {
    return false;
  }
}

export function findCompliment(list: Compliment[], name: string): Compliment | undefined {
  return list.find((c) => norm(c.name) === norm(name));
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function sortAlpha(list: Compliment[]): Compliment[] {
  return [...list].sort((a, b) => collator.compare(a.name, b.name));
}

export function sortFrequent(list: Compliment[]): Compliment[] {
  return [...list].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
}
