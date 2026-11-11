// Explicit fields only: never accept request bodies, headers, URLs, driver errors or user data.
export interface LogFields { requestId?: string; method?: string; route?: string; status?: number; durationMs?: number; errorKind?: string; port?: number; poolTotal?: number; poolIdle?: number; poolWaiting?: number }
export function logEvent(level: 'info' | 'error', event: string, fields: LogFields = {}): void {
  const { requestId, method, route, status, durationMs, errorKind, port, poolTotal, poolIdle, poolWaiting } = fields;
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, event, requestId, method, route, status, durationMs, errorKind, port, poolTotal, poolIdle, poolWaiting });
  if (level === 'error') console.error(line); else console.log(line);
}
