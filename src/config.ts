export const config = {
  /** Apps Script web app URL (ends in /exec). Set via VITE_APPS_SCRIPT_URL. */
  appsScriptUrl: (import.meta.env.VITE_APPS_SCRIPT_URL ?? '').trim(),
  /** Shared secret; must match SHARED_TOKEN in Apps Script. Set via VITE_APPS_SCRIPT_TOKEN. */
  token: (import.meta.env.VITE_APPS_SCRIPT_TOKEN ?? '').trim(),

  /** Round latitude/longitude before sending. 3 decimals ≈ 110 m. */
  roundCoordinates: true,
  coordinateDecimals: 3,

  /** How long Submit waits for a location fix before saving without one. */
  locationWaitMs: 4000,
  /** A fix younger than this is reused instead of asking the GPS again. */
  locationMaxAgeMs: 2 * 60 * 1000,

  /** Network timeout for a single request to Apps Script. */
  requestTimeoutMs: 20000,
  /** While anything is queued, retry this often (plus on reconnect / app focus). */
  retryIntervalMs: 60000,

  toastMs: 1800,
};

export const isBackendConfigured = () => Boolean(config.appsScriptUrl && config.token);
