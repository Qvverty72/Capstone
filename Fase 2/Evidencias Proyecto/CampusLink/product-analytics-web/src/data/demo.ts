import type { Activity, AgeBand, DemoData, DemoEvent, DemoUser, Filters, Resource } from '../domain/types.ts';

export const DEFAULT_FILTERS: Filters = { from: '2026-10-01', to: '2026-10-31', institution: '', campus: '', career: '', age: '', gender: '' };
export const DEFAULT_BANDS: AgeBand[] = [
  { id: 'young', label: '18–22 años', min: 18, max: 22 },
  { id: 'adult', label: '23–29 años', min: 23, max: 29 },
  { id: 'mature', label: '30–39 años', min: 30, max: 39 },
  { id: 'senior', label: '40 años o más', min: 40, max: 120 },
];
export const CAMPUSES = [
  { name: 'San Joaquín', institution: 'Duoc UC' },
  { name: 'Antonio Varas', institution: 'Duoc UC' },
  { name: 'Viña del Mar', institution: 'Duoc UC' },
  { name: 'Santiago Centro', institution: 'INACAP' },
];
export const CAREERS = ['Ingeniería en Informática', 'Diseño Gráfico', 'Administración de Empresas', 'Ingeniería en Construcción', 'Enfermería'];
export const GENDERS = ['FEMENINO', 'MASCULINO', 'OTRO', 'PREFIERO_NO_INFORMAR', 'SIN_DATO'];
export const GENDER_LABELS: Record<string, string> = { FEMENINO: 'Femenino', MASCULINO: 'Masculino', OTRO: 'Otro declarado', PREFIERO_NO_INFORMAR: 'Prefiere no informar', SIN_DATO: 'Sin información' };
export const SUBJECTS = ['Programación', 'Cálculo diferencial', 'Bases de datos', 'Estadística', 'Diseño de interfaces', 'Inglés', 'Anatomía', 'Administración'];
export const ACTIVITY_CATEGORIES = ['Académicas', 'Deportes', 'Cultura', 'Comunidad'];
export const DAY = 86_400_000;
export function dayAdd(day: string, n: number) { return new Date(Date.parse(day + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10); }
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY); }
export function dates(from: string, to: string) { return Array.from({ length: Math.max(0, daysBetween(from, to) + 1) }, (_, i) => dayAdd(from, i)); }

/** Escenario reproducible y exclusivamente local; no contiene perfiles reales. */
export function createDemoData(): DemoData {
  let seed = 78206;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = <T,>(values: T[]): T => values[Math.floor(random() * values.length)];
  const users: DemoUser[] = Array.from({ length: 840 }, (_, i) => {
    const campus = pick(CAMPUSES), r = random();
    return { id: `demo-${i}`, registered: dayAdd('2026-07-01', Math.floor(random() * 123)),
      institution: campus.institution, campus: campus.name, career: pick(CAREERS),
      age: r < .04 ? null : r < .56 ? 18 + Math.floor(random() * 5) : r < .84 ? 23 + Math.floor(random() * 7) : r < .96 ? 30 + Math.floor(random() * 10) : 40 + Math.floor(random() * 16),
      gender: pick(['FEMENINO', 'FEMENINO', 'MASCULINO', 'MASCULINO', 'OTRO', 'PREFIERO_NO_INFORMAR', 'SIN_DATO']) };
  });
  const resources: Resource[] = Array.from({ length: 180 }, (_, i) => {
    const owner = pick(users), module = random() < .63 ? 'marketplace' : 'digital';
    return { id: `resource-${i}`, owner: owner.id, title: pick(module === 'digital'
      ? ['Guía de estudio', 'Apuntes de clases', 'Ejercicios resueltos', 'Resumen de unidad']
      : ['Libro de estudio', 'Calculadora científica', 'Kit de materiales', 'Manual práctico']) + ` ${i + 1}`,
      subject: pick(SUBJECTS), category: module === 'digital' ? pick(['Apuntes', 'Guías', 'Ejercicios']) : pick(['Libros', 'Tecnología', 'Materiales']),
      module, published: dayAdd(owner.registered, Math.floor(random() * Math.max(1, daysBetween(owner.registered, '2026-10-25')))) };
  });
  const activities: Activity[] = Array.from({ length: 24 }, (_, i) => {
    const owner = users[i], category = ACTIVITY_CATEGORIES[i % 4];
    return { id: `activity-${i}`, title: ['Taller de programación', 'Encuentro deportivo', 'Festival universitario', 'Voluntariado estudiantil', 'Grupo de estudio', 'Jornada de bienestar'][i % 6] + ` · ${i + 1}`, category,
      owner: owner.id, published: dayAdd(owner.registered, Math.floor(random() * Math.max(1, daysBetween(owner.registered, '2026-10-20')))) };
  });
  const events: DemoEvent[] = [];
  const add = (user: string, day: string, module: DemoEvent['module'], type: DemoEvent['type'], target: string, request?: string) => {
    if (day <= '2026-10-31') events.push({ id: `event-${events.length}`, user, day, module, type, target, request });
  };
  for (const day of dates('2026-07-01', '2026-10-31')) {
    const available = resources.filter(r => r.published <= day);
    const community = activities.filter(a => a.published <= day);
    for (const [i, user] of users.entries()) {
      if (user.registered > day || i % 11 === 0 || random() > .16 + daysBetween('2026-07-01', day) / 850) continue;
      if (random() < .79 && available.length) {
        const resource = pick(available);
        add(user.id, day, resource.module, 'view', resource.id);
        if (random() < .20) {
          const request = `request-${events.length}`;
          add(user.id, day, resource.module, 'request', resource.id, request);
          if (resource.module === 'marketplace' && random() < .73) {
            const reserved = dayAdd(day, Math.floor(random() * 3));
            add(user.id, reserved, resource.module, 'reserved', resource.id, request);
            const completed = dayAdd(reserved, 1 + Math.floor(random() * 5));
            add(user.id, completed, resource.module, random() < .82 ? 'completed' : 'cancelled', resource.id, request);
          }
        }
      } else if (community.length) {
        const activity = pick(community);
        add(user.id, day, 'community', 'view', activity.id);
        if (random() < .32) {
          add(user.id, day, 'community', 'joined', activity.id);
          if (random() < .12) add(user.id, dayAdd(day, 1), 'community', 'left', activity.id);
        }
      }
    }
  }
  return { users, resources, activities, events: events.sort((a, b) => a.day.localeCompare(b.day)), from: '2026-07-01', to: '2026-10-31' };
}
export const DEMO_DATA = createDemoData();
