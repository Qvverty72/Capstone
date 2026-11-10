export interface PortalAssignment { id: string; name: string; campusId: string }

/** Contexto confirmado por GET /auth/me; nunca se deriva de metadatos del JWT. */
export interface PortalIdentity {
  userId: string;
  campusId: string;
  profile: {
    id: string; institucion_id: string; campus_id: string;
    estado_cuenta: 'ACTIVA' | 'SUSPENDIDA' | 'DESACTIVADA'; deleted_at: string | null;
  };
  roles: PortalAssignment[];
  permissions: PortalAssignment[];
  capabilities: { general: boolean; officialActivities: boolean; analytics: boolean; reports: boolean };
}

export interface PortalAuthContext {
  identity: PortalIdentity;
  signOut: () => Promise<void>;
  revalidate: () => void;
}
