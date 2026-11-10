import type { BrowserContext, Route } from '@playwright/test';
import { MOCK_API, MOCK_AUTH } from '../../qa/environment';
import { academic, activities, campusId, digital, identity, options, password, physical, syntheticSession } from './data';

/** Strict browser-only API simulation. Unknown requests fail; none reach a real service. */
export async function installMockAPI(context: BrowserContext, webOrigin: string) {
  const unexpected: string[] = [];
  const calls: { method: string; path: string; query: string }[] = [];
  const state = { catalogError: false, denyAccount: false, emptyCatalog: false };
  const respond = (route: Route, data: unknown, meta?: unknown) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === webOrigin && !/^\/(api|auth)\/v1\//.test(url.pathname)) return route.continue();
    const path = url.pathname, method = request.method();
    const failure = (status: number, code: string) => route.fulfill({ status, json: { error: { code, message: 'Respuesta sintética QA' } } });
    if (![MOCK_API, MOCK_AUTH].includes(url.origin)) {
      unexpected.push(`${method} ${url.origin}${path}`); return route.abort('blockedbyclient');
    }
    calls.push({ method, path, query: url.search });
    if (url.origin === MOCK_AUTH) {
      if (path === '/auth/v1/user') return route.fulfill({ json: syntheticSession().user });
      if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
      if (path === '/auth/v1/token') return route.fulfill({ json: syntheticSession() });
    }
    if (path === '/api/v1/auth/login' && method === 'POST') {
      return request.postDataJSON()?.password === password
        ? respond(route, { session: syntheticSession() }) : failure(401, 'INVALID_CREDENTIALS');
    }
    if (path === '/api/v1/auth/me') return state.denyAccount ? failure(403, 'ACCOUNT_SUSPENDED') : respond(route, identity);
    if (path === '/api/v1/users/me/profile') return respond(route, academic);
    if (path === '/api/v1/users/me/profile-options') return respond(route, {
      campuses: [options.campus], careers: options.careers.map(c => ({ ...c, campusIds: [campusId] })),
    });
    if (path === '/api/v1/users/me/overview') return respond(route, { activePublications: 0, pendingRequests: 0, transactions: 0, acquiredResources: 0 });
    if (path.endsWith('/notifications/unread-count')) return respond(route, { unreadCount: 0 });
    if (path === '/api/v1/users/me/notifications') return respond(route, { items: [], nextCursor: null });
    if (path === '/api/v1/activities/mine/count') return respond(route, { campusId, total: activities.length });
    if (path === '/api/v1/activities/mine') return respond(route, { campusId, items: activities, total: activities.length,
      page: Number(url.searchParams.get('page') || 1), limit: Number(url.searchParams.get('limit') || 10), hasMore: false });
    // Exercise the real map error/retry UI without fabricating a MongoDB map.
    if (path.includes('/maps/')) return failure(503, 'SERVICE_UNAVAILABLE');
    if (/^\/api\/v1\/analytics\/resources\/[^/]+\/views$/.test(path) && method === 'POST') return respond(route, { recorded: true });
    const p = '/api/v1/marketplace/physicalgoods';
    const d = '/api/v1/marketplace/elibrary';
    const meta = { page: Number(url.searchParams.get('page') || 1), limit: Number(url.searchParams.get('limit') || 10), hasMore: false };
    if (path === p + '/options') return respond(route, options);
    if (path === p + '/request-counts') return respond(route, { sentAccepted: 0, receivedPending: 0, pendingRequests: 0, pendingTransactions: 0 });
    if (path === d + '/academic-options') return respond(route, { careers: digital[0].careers, subjects: digital[0].subjects.map(s => ({ ...s, careerIds: ['career-qa'] })) });
    if (path === d + '/activity/counts') return respond(route, { pendingRequests: 0, pendingTransactions: 0 });
    if (path === d + '/recommendations') return respond(route, [], meta);
    if ((path === p || path === d) && method === 'GET') {
      if (state.catalogError) return failure(503, 'SERVICE_UNAVAILABLE');
      const query = (url.searchParams.get('q') || '').toLocaleLowerCase('es');
      const rows = path === p ? physical : digital;
      return respond(route, state.emptyCatalog ? [] : rows.filter(row => row.title.toLocaleLowerCase('es').includes(query)
        && (!url.searchParams.get('modality') || row.modality === url.searchParams.get('modality'))), meta);
    }
    const item = physical.find(row => path === `${p}/${row.id}/images`);
    if (item) return respond(route, item);
    const resource = digital.find(row => path === `${d}/${row.id}`);
    if (resource) return respond(route, resource);
    if (path.endsWith('/request-options')) return respond(route, { canRequest: true, acquired: false, activeRequest: null,
      activeRequestId: null, messages: [{ code: 'INTERES', label: 'Me interesa este recurso.', description: 'Me interesa este recurso.' }] });
    if (path.endsWith('/preview')) return respond(route, { available: true, text: 'Guía QA · Programación\nTipos, funciones y trabajo colaborativo.\nVista previa con contenido sintético.', page: 1, message: 'Vista previa QA' });
    unexpected.push(`${method} ${path}`);
    return failure(501, 'UNIMPLEMENTED_QA_FIXTURE');
  });
  return { state, calls, unexpected };
}
