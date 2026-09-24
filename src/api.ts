import { config, isBackendConfigured } from './config';

export type Entry = {
  id: string;
  timestamp: string;
  latitude: number | '';
  longitude: number | '';
  compliment: string;
  gender: string;
  race: string;
  ageRange: string;
};

export type ServerCompliment = { name: string; count: number };

/** Network failure / timeout / non-JSON: worth retrying later. */
export class NetworkError extends Error {}
/** The server answered but refused the request (bad token, bad input…). */
export class ServerError extends Error {}

async function request(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  if (!isBackendConfigured()) throw new NetworkError('Backend URL/token not configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.requestTimeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store', redirect: 'follow' });
  } catch (e) {
    throw new NetworkError(String(e));
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // Apps Script returns an HTML error page when the script itself crashes.
    throw new NetworkError('Response was not JSON');
  }
  if (!body || typeof body !== 'object') throw new NetworkError('Empty response');
  const json = body as Record<string, unknown>;
  if (json.ok !== true) throw new ServerError(String(json.error ?? 'Request rejected'));
  return json;
}

/**
 * POST with Content-Type text/plain so the browser treats it as a "simple"
 * request and skips the CORS preflight, which Apps Script can't answer.
 */
function post(action: string, data: Record<string, unknown>) {
  return request(config.appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: config.token, ...data }),
  });
}

export async function sendEntry(entry: Entry): Promise<void> {
  await post('addEntry', { entry });
}

export async function sendCompliment(name: string): Promise<void> {
  await post('addCompliment', { name });
}

export async function fetchCompliments(): Promise<ServerCompliment[]> {
  const url = new URL(config.appsScriptUrl);
  url.searchParams.set('action', 'list');
  url.searchParams.set('token', config.token);
  const json = await request(url.toString());
  const list = Array.isArray(json.compliments) ? json.compliments : [];
  return list
    .filter((c): c is ServerCompliment => !!c && typeof c.name === 'string' && c.name.trim() !== '')
    .map((c) => ({ name: c.name.trim(), count: Number(c.count) || 0 }));
}
