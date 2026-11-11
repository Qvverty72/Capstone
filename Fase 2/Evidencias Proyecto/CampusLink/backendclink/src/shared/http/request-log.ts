import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logEvent } from '../observability/logger.js';

export const requestLog: RequestHandler = (request, response, next) => {
  const started = performance.now(), requestId = randomUUID();
  const pathSegments = request.path.split('/').filter(Boolean);
  response.locals.requestId = requestId;
  response.setHeader('X-Request-ID', requestId);
  response.once('finish', () => {
    // Express route patterns contain placeholders; baseUrl may contain user identifiers.
    // Keep only known static segments. Unknown URLs/queries are deliberately excluded.
    const staticSegments = new Set(['api', 'v1', 'auth', 'users', 'me', 'profile', 'notifications', 'access', 'campuses',
      'activities', 'maps', 'marketplace', 'physicalgoods', 'elibrary', 'reports', 'analytics']);
    const pattern = typeof request.route?.path === 'string' ? request.route.path.split('/').filter(Boolean) as string[] : undefined;
    const prefix = pattern ? pathSegments.slice(0, pathSegments.length - pattern.length).map(part => staticSegments.has(part) ? part : ':id') : [];
    const route = pattern ? '/' + [...prefix, ...pattern].join('/') : 'unmatched';
    logEvent(response.statusCode >= 500 ? 'error' : 'info', 'http.request', { requestId, method: request.method,
      route, status: response.statusCode, durationMs: Math.round(performance.now() - started) });
  });
  next();
};
