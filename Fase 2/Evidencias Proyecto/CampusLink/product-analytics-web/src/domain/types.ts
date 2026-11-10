export type Section = 'overview' | 'profiles' | 'retention' | 'marketplace' | 'demand' | 'community';
export type Source = 'demo' | 'real';
export interface Filters { from: string; to: string; institution: string; campus: string; career: string; age: string; gender: string }
export interface AgeBand { id: string; label: string; min: number; max: number }
export interface DemoUser { id: string; registered: string; institution: string; campus: string; career: string; age: number | null; gender: string }
export interface Resource { id: string; owner: string; title: string; subject: string; category: string; module: 'marketplace' | 'digital'; published: string }
export interface Activity { id: string; title: string; category: string; published: string; owner: string }
export type EventType = 'view' | 'request' | 'reserved' | 'completed' | 'cancelled' | 'joined' | 'left';
export interface DemoEvent { id: string; user: string; day: string; module: 'marketplace' | 'digital' | 'community'; type: EventType; target: string; request?: string }
export interface DemoData { users: DemoUser[]; resources: Resource[]; activities: Activity[]; events: DemoEvent[]; from: string; to: string }
export interface SeriesPoint { date: string; label: string; registered: number; active: number; wau: number | null; mau: number | null; academicRequests: number; interactions: number; joined: number; newActive: number; returning: number }
export interface Group { label: string; total: number | null; active: number | null; rate: number | null; marketplace: number | null; community: number | null }
export interface Rank { label: string; value: number | null; secondary?: number | null; detail?: string }
export interface Cohort { label: string; total: number | null; d7: number | null; d30: number | null }
export interface DemoResult {
  status: 'ready' | 'empty' | 'suppressed'; population: number; active: number; newUsers: number;
  newActive: number; recurrent: number; interactions: number; dau: number | null; wau: number | null; mau: number | null;
  d7: number | null; d30: number | null; frequency: number | null;
  series: SeriesPoint[]; modules: Rank[]; groups: Record<string, Group[]>; cohorts: Cohort[];
  market: { publications: number; views: number; requests: number; accepted: number; completed: number; cancelled: number;
    firstRequestDays: number | null; funnel: Rank[]; resources: Rank[]; states: Rank[]; timeline: Rank[] };
  demand: { subjects: Rank[]; careers: Rank[]; campuses: Rank[]; categories: Rank[] };
  community: { published: number; views: number; joined: number; left: number; participants: number;
    activities: Rank[]; categories: Rank[]; careers: Rank[]; campuses: Rank[] };
}
export interface RealSnapshot {
  from: string; to: string; generatedAt: string; cutoff: string; timeZone: string;
  institution: string; campus: string; career: string | null;
  views: number | null; requests: number | null; joined: number | null; legacyEvents: number;
  subjects: Rank[]; intervals: { label: string; views: number | null; requests: number | null; joined: number | null }[];
  analysis: RealAnalysis | null; notes: string[];
}
export interface RealDemand {
  label: string; views: number; requests: number; resources: number; requesters: number; requestsPer100Views: number | null;
}
export interface RealAudience {
  views: number; joins: number; withdrawals: number; uniqueViewers: number; uniqueParticipants: number;
  repeatParticipants: number; viewedPairs: number; convertedPairs: number;
  viewToJoinRate: number | null; repeatParticipantRate: number | null; legacyEvents: number;
}
export interface RealAudienceSegment extends RealAudience { type: string; category: string | null }
export interface RealAudienceCareer extends RealAudienceSegment { label: string; careerParticipants: number; participantShare: number | null }
export interface RealAnalysis {
  activities: { summary: RealAudience; segments: RealAudienceSegment[]; careers: RealAudienceCareer[] };
  resources: { careers: RealDemand[]; subjects: RealDemand[] };
  definitions: string[];
}
export interface LiveOptions {
  institutions: { id: string; name: string; campuses: { id: string; name: string }[];
    careers: { id: string; name: string; campusIds: string[] }[] }[];
}
export interface LiveFilters { from: string; to: string; institutionId: string; campusId: string; careerId: string; grouping: 'week' | 'month' }
