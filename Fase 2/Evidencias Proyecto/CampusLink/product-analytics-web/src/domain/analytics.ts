import type { AgeBand, Cohort, DemoData, DemoEvent, DemoResult, DemoUser, Filters, Group, Rank } from './types.ts';
import { dates, dayAdd, daysBetween, GENDER_LABELS } from '../data/demo.ts';

export const MIN_GROUP = 10;
export function ratio(part: number, total: number): number | null { return total > 0 ? part / total * 100 : null; }
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01'
    && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function validateFilters(filters: Filters): string | null {
  if (!validDate(filters.from) || !validDate(filters.to)) return 'Selecciona dos fechas válidas.';
  if (filters.from > filters.to) return 'La fecha inicial debe ser anterior o igual a la final.';
  if (daysBetween(filters.from, filters.to) > 366) return 'Selecciona un período de hasta 367 días para este prototipo.';
  return null;
}
export function makeAgeBands(cuts: number[]): AgeBand[] {
  if (cuts.length !== 3 || cuts.some(n => !Number.isInteger(n)) || cuts[0] < 18 || cuts[0] >= cuts[1] || cuts[1] >= cuts[2] || cuts[2] > 100) throw new Error('Usa tres límites crecientes entre 18 y 100.');
  return [18, ...cuts.map(n => n + 1)].map((min, i) => ({ id: ['young', 'adult', 'mature', 'senior'][i], min, max: cuts[i] ?? 120,
    label: i === 3 ? `${min} años o más` : `${min}–${cuts[i]} años` }));
}
export function matchesUser(user: DemoUser, filters: Filters, bands: AgeBand[]) {
  const band = bands.find(b => b.id === filters.age);
  return (!filters.institution || user.institution === filters.institution) && (!filters.campus || user.campus === filters.campus)
    && (!filters.career || user.career === filters.career) && (!filters.gender || user.gender === filters.gender)
    && (!filters.age || (filters.age === 'unknown' ? user.age === null : !!band && user.age !== null && user.age >= band.min && user.age <= band.max));
}
const unique = (events: DemoEvent[]) => new Set(events.map(e => e.user));
const count = (events: DemoEvent[], type: DemoEvent['type']) => events.filter(e => e.type === type).length;
const orderedGroups = (rows: Group[], order: string[]) => rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

/** Supresión primaria y complementaria: evita deducir una sola celda pequeña a partir del total. */
export function suppressRanks(rows: (Rank & { people: number })[]): Rank[] {
  const hidden = new Set(rows.map((row, i) => row.people > 0 && row.people < MIN_GROUP ? i : -1).filter(i => i >= 0));
  if (hidden.size === 1 && rows.length > 1) {
    const other = rows.map((row, i) => ({ i, people: row.people })).filter(row => !hidden.has(row.i) && row.people > 0).sort((a, b) => a.people - b.people)[0];
    if (other) hidden.add(other.i);
  }
  return rows.map((row, i) => ({ label: row.label, value: hidden.has(i) ? null : row.value, secondary: hidden.has(i) ? null : row.secondary, detail: row.detail }));
}

export function calculateDemo(data: DemoData, filters: Filters, bands: AgeBand[]): DemoResult {
  const error = validateFilters(filters); if (error) throw new Error(error);
  const population = data.users.filter(u => matchesUser(u, filters, bands) && u.registered <= filters.to);
  const ids = new Set(population.map(u => u.id));
  const all = data.events.filter(e => ids.has(e.user) && e.day <= filters.to);
  const activityDays = new Set(all.map(e => `${e.user}|${e.day}`));
  const events = all.filter(e => e.day >= filters.from);
  const activeIds = unique(events), market = events.filter(e => e.module === 'marketplace'), community = events.filter(e => e.module === 'community');
  const registered = new Map(population.map(u => [u.id, u.registered]));
  const eligible = population.filter(u => u.registered >= filters.from);
  const newActive = [...activeIds].filter(id => registered.get(id)! >= filters.from).length;
  function groups(key: (u: DemoUser) => string): Group[] {
    const labels = [...new Set(population.map(key))];
    const raw = labels.map(label => {
      const members = population.filter(u => key(u) === label), membersIds = new Set(members.map(u => u.id));
      return { label, total: members.length, active: members.filter(u => activeIds.has(u.id)).length,
        marketplace: unique(market.filter(e => membersIds.has(e.user))).size, community: unique(community.filter(e => membersIds.has(e.user))).size };
    });
    const hidden = suppressRanks(raw.map(g => ({ label: g.label, value: g.total, people: Math.min(...[g.total, g.active, g.marketplace, g.community].filter(n => n > 0)) })));
    return raw.map((g, i) => hidden[i].value === null ? { label: g.label, total: null, active: null, rate: null, marketplace: null, community: null }
      : { ...g, rate: ratio(g.active, g.total), marketplace: ratio(g.marketplace, g.total), community: ratio(g.community, g.total) });
  }
  function ranks(list: DemoEvent[], label: (event: DemoEvent) => string): Rank[] {
    const labels = [...new Set(list.map(label))];
    return suppressRanks(labels.map(name => {
      const selected = list.filter(e => label(e) === name);
      return { label: name, value: selected.length, people: unique(selected).size };
    }).sort((a, b) => b.value - a.value));
  }
  function retention(users: DemoUser[], offset: number) {
    const observed = users.filter(u => dayAdd(u.registered, offset) <= filters.to && u.registered >= data.from && dayAdd(u.registered, offset) <= data.to);
    const returning = observed.filter(u => activityDays.has(`${u.id}|${dayAdd(u.registered, offset)}`)).length;
    return observed.length >= MIN_GROUP && (returning === 0 || returning >= MIN_GROUP) ? ratio(returning, observed.length) : null;
  }
  const series = dates(filters.from, filters.to).map(date => {
    const daily = events.filter(e => e.day === date), dailyIds = unique(daily);
    const weekFrom = dayAdd(date, -6), monthFrom = dayAdd(date, -29);
    const dailyNew = [...dailyIds].filter(id => registered.get(id)! >= filters.from).length;
    return { date, label: date.slice(8) + '/' + date.slice(5, 7), registered: population.filter(u => u.registered <= date).length,
      active: dailyIds.size, wau: weekFrom < data.from ? null : unique(all.filter(e => e.day >= weekFrom && e.day <= date)).size,
      mau: monthFrom < data.from ? null : unique(all.filter(e => e.day >= monthFrom && e.day <= date)).size,
      academicRequests: daily.filter(e => e.type === 'request' && e.module !== 'community').length,
      interactions: daily.length, joined: count(daily.filter(e => e.module === 'community'), 'joined'), newActive: dailyNew, returning: dailyIds.size - dailyNew };
  });
  const resourceById = new Map(data.resources.map(r => [r.id, r]));
  const activityById = new Map(data.activities.map(a => [a.id, a]));
  const userById = new Map(population.map(u => [u.id, u]));
  const requests = market.filter(e => e.type === 'request'), requestIds = new Set(requests.map(e => e.request));
  // El embudo sigue la misma cohorte de solicitudes, con resultados observados hasta el corte.
  const cohortEvents = all.filter(e => e.module === 'marketplace' && !!e.request && requestIds.has(e.request));
  const accepted = new Set(cohortEvents.filter(e => e.type === 'reserved').map(e => e.request));
  const completed = new Set(cohortEvents.filter(e => e.type === 'completed' && accepted.has(e.request)).map(e => e.request));
  const publications = data.resources.filter(r => r.module === 'marketplace' && ids.has(r.owner) && r.published >= filters.from && r.published <= filters.to);
  const waits = publications.flatMap(r => {
    const first = data.events.find(e => e.target === r.id && e.type === 'request' && e.day <= filters.to);
    return first ? [daysBetween(r.published, first.day)] : [];
  });
  const academic = events.filter(e => e.type === 'request' && e.module !== 'community');
  const joined = community.filter(e => e.type === 'joined');
  const cohortLabels = [...new Set(eligible.map(u => u.registered.slice(0, 7)))];
  const cohorts: Cohort[] = cohortLabels.map(label => { const members = eligible.filter(u => u.registered.startsWith(label));
    return { label, total: members.length >= MIN_GROUP ? members.length : null, d7: retention(members, 7), d30: retention(members, 30) }; });
  const windowActive = (n: number) => { const from = dayAdd(filters.to, 1 - n); return from < data.from || filters.to > data.to ? null : unique(all.filter(e => e.day >= from)).size; };
  return {
    status: population.length > 0 && population.length < MIN_GROUP ? 'suppressed' : events.length ? 'ready' : 'empty',
    population: population.length, active: activeIds.size, newUsers: eligible.length, newActive, recurrent: activeIds.size - newActive, interactions: events.length,
    dau: windowActive(1), wau: windowActive(7), mau: windowActive(30), d7: retention(eligible, 7), d30: retention(eligible, 30),
    frequency: activeIds.size ? series.reduce((sum, p) => sum + p.active, 0) / activeIds.size : null,
    series, modules: ranks(events, e => ({ marketplace: 'Marketplace', digital: 'Recursos digitales', community: 'Actividades' }[e.module])),
    groups: { age: orderedGroups(groups(u => u.age === null ? 'Sin información' : bands.find(b => u.age! >= b.min && u.age! <= b.max)?.label ?? 'Fuera de rango'), [...bands.map(b => b.label), 'Sin información', 'Fuera de rango']),
      gender: orderedGroups(groups(u => GENDER_LABELS[u.gender]), ['Femenino', 'Masculino', 'Otro declarado', 'Prefiere no informar', 'Sin información']), institution: groups(u => u.institution), campus: groups(u => u.campus), career: groups(u => u.career),
      tenure: orderedGroups(groups(u => { const n = daysBetween(u.registered, filters.to); return n < 30 ? 'Menos de 30 días' : n < 90 ? '30–89 días' : '90 días o más'; }), ['Menos de 30 días', '30–89 días', '90 días o más']) },
    cohorts, market: {
      publications: publications.length, views: count(market, 'view'), requests: requests.length, accepted: count(market, 'reserved'), completed: count(market, 'completed'), cancelled: count(market, 'cancelled'),
      firstRequestDays: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
      funnel: [{ label: 'Solicitudes creadas', value: requests.length }, { label: 'Con reserva', value: accepted.size }, { label: 'Con intercambio completado', value: completed.size }],
      resources: ranks(requests, e => resourceById.get(e.target)!.title),
      states: [{ label: 'Reserva registrada', value: count(market, 'reserved') }, { label: 'Completada', value: count(market, 'completed') }, { label: 'Cancelada', value: count(market, 'cancelled') }],
      timeline: dates(filters.from, filters.to).map(date => ({ label: date.slice(8) + '/' + date.slice(5, 7), value: count(market.filter(e => e.day === date), 'completed'), secondary: requests.filter(e => e.day === date).length })),
    }, demand: {
      subjects: ranks(academic, e => resourceById.get(e.target)!.subject), careers: ranks(academic, e => userById.get(e.user)!.career),
      campuses: ranks(academic, e => userById.get(e.user)!.campus), categories: ranks(academic, e => resourceById.get(e.target)!.category),
    }, community: { published: data.activities.filter(a => ids.has(a.owner) && a.published >= filters.from && a.published <= filters.to).length,
      views: count(community, 'view'), joined: joined.length, left: count(community, 'left'), participants: unique(joined).size,
      activities: ranks(joined, e => activityById.get(e.target)!.title), categories: ranks(joined, e => activityById.get(e.target)!.category),
      careers: ranks(joined, e => userById.get(e.user)!.career), campuses: ranks(joined, e => userById.get(e.user)!.campus) },
  };
}
