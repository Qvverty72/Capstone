import { getAnalyticsHealth } from './modules/analytics/services/analytics.service.js';
import { getAuthHealth } from './modules/auth/services/auth.service.js';
import { getMapHealth } from './modules/maps/services/map.service.js';
import { getElibraryHealth } from './modules/marketplace/elibrary/services/elibrary.service.js';
import { getPhysicalgoodsHealth } from './modules/marketplace/physicalgoods/services/physicalgoods.service.js';
import { getReportsHealth } from './modules/reports/services/reports.service.js';
import { getUsersHealth } from './modules/users/services/users.service.js';
import type { ApiReadiness } from './shared/health/health.types.js';
import { getDependencyReadiness } from './database/readiness.js';

/** Agrega la salud de cada módulo; la API está lista solo cuando todos responden correctamente. */
export async function getReadiness(): Promise<ApiReadiness> {
  const [dependencies, modules] = await Promise.all([getDependencyReadiness(), Promise.all([
    getUsersHealth(), getAuthHealth(), getMapHealth(), getPhysicalgoodsHealth(),
    getElibraryHealth(), getReportsHealth(), getAnalyticsHealth(),
  ])]);
  return { status: dependencies.status === 'ok' && modules.every(module => module.status === 'ok') ? 'ok' : 'unavailable', modules };
}
