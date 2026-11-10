import type { AuthIdentity } from '../../src/features/auth/types/auth';
import type { AcademicProfile } from '../../src/features/users/types/profile';
import type { PhysicalgoodsGallery, PublicationOptions } from '../../src/features/marketplace/physicalgoods/types/publication';
import type { DigitalPublication } from '../../src/features/marketplace/elibrary/types/publication';

export const userId = '11111111-1111-4111-8111-111111111111';
export const campusId = '22222222-2222-4222-8222-222222222222';
export const email = 'estudiante.qa@example.test';
export const password = 'Synthetic-QA-only-2026';
export const identity: AuthIdentity = {
  userId, campusId,
  profile: { id: userId, institucion_id: campusId, campus_id: campusId, nombre_completo: 'Estudiante CampusLink',
    foto_path: null, verificado_en: '2026-01-01T12:00:00Z', estado_cuenta: 'ACTIVA', deleted_at: null },
  roles: [], permissions: [], capabilities: { general: true, officialActivities: false, analytics: false, reports: false },
};
export const academic: AcademicProfile = {
  fullName: identity.profile.nombre_completo, campusId, campusName: 'Campus de demostración',
  careers: [{ id: 'career-qa', nombre: 'Ingeniería en Informática' }], updatedAt: '2026-11-01T12:00:00Z',
};
export const options: PublicationOptions = {
  campus: { id: campusId, name: academic.campusName },
  categories: [{ id: 'books', name: 'Libros' }, { id: 'tools', name: 'Material académico' }],
  careers: [{ id: 'career-qa', name: 'Ingeniería en Informática' }],
  subjects: [{ id: 'subject-qa', name: 'Programación', careerIds: ['career-qa'] }],
};
const owner = { id: '33333333-3333-4333-8333-333333333333', fullName: 'Comunidad QA',
  averageRating: null, ratingCount: 0, completedAgreements: 0, completedSales: 0, careers: ['Ingeniería en Informática'] };
export const physical: PhysicalgoodsGallery[] = ['Calculadora científica', 'Libro de programación', 'Kit de dibujo técnico', 'Cuaderno de laboratorio'].map((title, i) => ({
  id: `44444444-4444-4444-8444-44444444444${i}`, title, category: options.categories[i % 2],
  modality: i > 1 ? 'DONACION' : 'VENTA', price: i > 1 ? null : 5000 + i * 3000, condition: 'BUEN_ESTADO', status: 'DISPONIBLE',
  updatedAt: '2026-11-01T12:00:00Z', description: 'Recurso sintético para explorar el intercambio entre estudiantes. Datos preparados para QA.',
  campus: options.campus, owner, acceptsRequests: true, canEdit: false, images: [], expiresIn: 3600,
}));
export const digital: DigitalPublication[] = ['Guía de programación TypeScript', 'Apuntes de bases de datos', 'Ejercicios de algoritmos'].map((title, i) => ({
  id: `55555555-5555-4555-8555-55555555555${i}`, title, description: 'Material académico sintético de CampusLink para la demostración de interfaz.',
  modality: 'DONACION', price: null, campusId, campusName: academic.campusName, ownerId: owner.id, owner,
  publishedAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z',
  careers: options.careers.map(c => ({ ...c, code: 'INF' })), subjects: options.subjects.map(s => ({ ...s, code: 'PRO' })), careerIds: ['career-qa'], subjectIds: ['subject-qa'],
  institutionId: campusId, currency: 'CLP', deletedAt: null, acquisition: null,
  status: 'DISPONIBLE', isWithdrawn: false, acquired: false,
  files: [{ id: '66666666-6666-4666-8666-666666666666', name: 'guia-qa.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
}));
export const activities = ['Taller de programación colaborativa', 'Grupo de estudio de algoritmos'].map((title, i) => ({
  id: `77777777777777777777777${i}`, campusId, title, description: 'Encuentro sintético de la comunidad para practicar y compartir conocimientos.',
  type: 'COMMUNITY_ACTIVITY', status: 'ACTIVE', startAt: '2027-06-10T15:00:00Z', endAt: '2027-06-10T17:00:00Z',
  location: { buildingKey: 'H', floorKey: 'h-floor1', buildingName: 'Edificio H', floorName: 'Piso 1', customLabel: 'Sala de estudio' },
}));

/** Deliberately unsigned synthetic token; no server accepts it. */
export function syntheticSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email,
    app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T12:00:00Z' };
  const claims = { sub: userId, aud: 'authenticated', role: 'authenticated', email, iat: now, exp: now + 3600 };
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${Buffer.from('synthetic-signature').toString('base64url')}`;
  return { access_token: token, refresh_token: 'synthetic-refresh-not-a-secret', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user };
}
