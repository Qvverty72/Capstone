import { ANALYSIS_DEFINITIONS, analyzeActivityAudience } from '../../src/modules/analytics/domain/analytics.analysis.js';
import type { ActivityAudienceFact, DashboardAnalysis } from '../../src/modules/analytics/types/analytics.analysis.types.js';

export function analysisFixture(): DashboardAnalysis {
  const firstViewedAt = new Date('2026-10-01T12:00Z'), lastLiveJoinedAt = new Date('2026-10-02T12:00Z');
  const base: ActivityAudienceFact = { period: '2026-10-01', userId: 'one', activityId: 'sport', type: 'COMMUNITY_ACTIVITY', category: 'Deporte',
    views: 2, joins: 1, withdrawals: 0, legacyEvents: 0, firstViewedAt, lastLiveJoinedAt };
  return {
    activities: analyzeActivityAudience([base, { ...base, userId: 'two', joins: 0, lastLiveJoinedAt: null },
      { ...base, activityId: 'culture', type: 'OFFICIAL_EVENT', category: 'Cultura' }], [
      { userId: 'one', careerId: 'it', careerName: 'Ingeniería en Informática' },
      { userId: 'two', careerId: 'design', careerName: 'Diseño Gráfico' },
    ], null),
    resources: {
      careers: [{ id: 'it', name: 'Ingeniería en Informática', views: 4, requests: 6, uniqueRequesters: 2, resourcesWithDemand: 1, requestsPer100Views: 150 }],
      subjects: [{ id: 'subject', name: '=SUM(1,2)', views: 0, requests: 3, uniqueRequesters: 2, resourcesWithDemand: 1, requestsPer100Views: null }],
    }, definitions: [...ANALYSIS_DEFINITIONS],
  };
}
