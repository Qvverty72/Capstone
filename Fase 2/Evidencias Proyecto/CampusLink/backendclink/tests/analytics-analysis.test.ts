import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeActivityAudience, percentage } from '../src/modules/analytics/domain/analytics.analysis.js';
import { audiencePipeline } from '../src/modules/analytics/repositories/analytics.analysis.repository.js';
import type { ActivityAudienceFact } from '../src/modules/analytics/types/analytics.analysis.types.js';

const viewAt = new Date('2026-10-01T12:00Z'), joinAt = new Date('2026-10-02T12:00Z');
const fact = (overrides: Partial<ActivityAudienceFact> = {}): ActivityAudienceFact => ({
  period: '2026-10-01', userId: 'person-1', activityId: 'activity-1', type: 'COMMUNITY_ACTIVITY', category: 'Deporte',
  views: 3, joins: 1, withdrawals: 0, legacyEvents: 0, firstViewedAt: viewAt, lastLiveJoinedAt: joinAt, ...overrides,
});

test('audience deduplicates reopenings and rejoins; recurrence requires two different activities', () => {
  const rows = [fact({ joins: 3, withdrawals: 2 }), fact({ period: '2026-11-01', joins: 2 }),
    fact({ activityId: 'activity-2' }), fact({ userId: 'person-2', views: 0, firstViewedAt: null })];
  const { summary } = analyzeActivityAudience(rows, [], null);
  assert.equal(summary.views, 9); assert.equal(summary.joins, 7); assert.equal(summary.withdrawals, 2);
  assert.equal(summary.uniqueViewers, 1); assert.equal(summary.uniqueParticipants, 2);
  assert.equal(summary.repeatParticipants, 1); assert.equal(summary.repeatParticipantRate, 50);
  assert.equal(summary.viewedPairs, 2); assert.equal(summary.convertedPairs, 2); assert.equal(summary.viewToJoinRate, 100);
});

test('conversion requires a later live join of the same person and activity; legacy and pre-view joins do not convert', () => {
  const { summary } = analyzeActivityAudience([
    fact({ lastLiveJoinedAt: new Date('2026-09-30T12:00Z') }),
    fact({ userId: 'legacy', lastLiveJoinedAt: null, legacyEvents: 1 }),
    fact({ userId: 'viewer', joins: 0, lastLiveJoinedAt: null }),
    fact({ userId: 'joins-without-view', views: 0, firstViewedAt: null }),
    fact({ userId: 'converts', views: 9 }),
  ], [], null);
  assert.equal(summary.viewedPairs, 4); assert.equal(summary.convertedPairs, 1); assert.equal(summary.viewToJoinRate, 25);
  assert.equal(summary.legacyEvents, 1);
  assert.equal(analyzeActivityAudience([fact({ lastLiveJoinedAt: viewAt })], [], null).summary.viewToJoinRate, 0,
    'equal timestamps do not establish that a join occurred after the view');
});

test('range conversion crosses intervals and range uniques are not sums of interval uniques', () => {
  const viewing = fact({ joins: 0, lastLiveJoinedAt: null });
  const joining = fact({ period: '2026-11-01', views: 0, firstViewedAt: null });
  assert.equal(analyzeActivityAudience([viewing], [], null).summary.viewToJoinRate, 0);
  assert.equal(analyzeActivityAudience([joining], [], null).summary.viewToJoinRate, null);
  assert.equal(analyzeActivityAudience([viewing, joining], [], null).summary.viewToJoinRate, 100);
  assert.equal(analyzeActivityAudience([viewing, joining], [], null).summary.repeatParticipants, 0);
});

test('career affinity uses the distinct audience of that career; memberships and categories are non-exclusive', () => {
  const memberships = [
    { userId: 'person-1', careerId: 'it', careerName: 'Informática' },
    { userId: 'person-1', careerId: 'design', careerName: 'Diseño' },
    { userId: 'person-1', careerId: 'it', careerName: 'Informática' },
    { userId: 'person-2', careerId: 'it', careerName: 'Informática' },
  ];
  const rows = [fact(), fact({ userId: 'person-2', category: 'Cultura' }), fact({ activityId: 'activity-2', category: 'Cultura' }), fact({ userId: 'unclassified' })];
  const result = analyzeActivityAudience(rows, memberships, null);
  const sport = result.careers.find(row => row.careerId === 'it' && row.category === 'Deporte')!;
  assert.equal(sport.uniqueParticipants, 1); assert.equal(sport.careerParticipants, 2); assert.equal(sport.participantShare, 50);
  assert.equal(result.careers.find(row => row.careerId === 'it' && row.category === 'Cultura')?.participantShare, 100);
  assert.equal(result.careers.find(row => row.careerId === null)?.uniqueParticipants, 1);
  assert.equal(result.summary.uniqueParticipants, 3);
  assert.ok(!JSON.stringify(result).includes('person-1'));
  const filtered = analyzeActivityAudience([rows[0]], memberships, 'it');
  assert.deepEqual(filtered.careers.map(row => row.careerId), ['it']);
});

test('no observations and zero denominators retain unavailable rates, while event ratios may exceed100', () => {
  const result = analyzeActivityAudience([], [], null);
  assert.equal(result.summary.uniqueParticipants, 0); assert.equal(result.summary.viewToJoinRate, null);
  assert.equal(result.summary.repeatParticipantRate, null); assert.deepEqual(result.careers, []);
  assert.equal(percentage(3, 2), 150); assert.equal(percentage(1, 3), 33.33); assert.equal(percentage(0, 0), null);
});

test('Mongo audience projection retains deleted activity metadata with campus isolation and live-only conversion timestamps', () => {
  const pipeline = audiencePipeline('week') as any[];
  assert.equal(pipeline[0].$group._id.period.$dateToString.date.$dateTrunc.startOfWeek, 'monday');
  assert.equal(pipeline[0].$group._id.period.$dateToString.timezone, 'America/Santiago');
  assert.ok(JSON.stringify(pipeline[0].$group.lastLiveJoinedAt).includes('LEGACY_STATE'));
  assert.ok(JSON.stringify(pipeline[1].$lookup).includes('$$campusId'));
  assert.ok(!JSON.stringify(pipeline).includes('deletedAt'));
  assert.equal(pipeline[2].$project.userId, '$_id.userId');
});
