/** Solo agregados públicos. Las identidades internas nunca se devuelven al cliente. */
export interface ActivityAudienceMetrics {
  views: number;
  joins: number;
  withdrawals: number;
  uniqueViewers: number;
  uniqueParticipants: number;
  repeatParticipants: number;
  viewedPairs: number;
  convertedPairs: number;
  viewToJoinRate: number | null;
  repeatParticipantRate: number | null;
  legacyEvents: number;
}
export interface ActivityAudienceSegment extends ActivityAudienceMetrics {
  type: string;
  category: string | null;
}
export interface CareerActivityAudience extends ActivityAudienceSegment {
  careerId: string | null;
  careerName: string;
  careerParticipants: number;
  participantShare: number | null;
}
export interface AcademicDemand {
  id: string | null;
  name: string;
  views: number;
  requests: number;
  resourcesWithDemand: number;
  uniqueRequesters: number;
  requestsPer100Views: number | null;
}
export interface DashboardAnalysis {
  activities: {
    summary: ActivityAudienceMetrics;
    segments: ActivityAudienceSegment[];
    careers: CareerActivityAudience[];
  };
  resources: { careers: AcademicDemand[]; subjects: AcademicDemand[] };
  definitions: string[];
}

