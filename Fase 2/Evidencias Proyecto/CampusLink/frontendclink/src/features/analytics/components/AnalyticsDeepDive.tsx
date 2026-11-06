import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AcademicDemand, CareerActivityAudience } from '../types/analysis';
import type { DashboardData } from '../types/dashboard';
import { formatNumber } from '../utils/presentation';
import { colors as c, styles as s } from './analytics.styles';

const typeName = (type: string) => ({ COMMUNITY_ACTIVITY: 'Actividad comunitaria', OFFICIAL_EVENT: 'Evento oficial', UNCLASSIFIED: 'Sin tipo conservado' })[type] ?? type;
const segmentName = (row: { type: string; category: string | null }) => `${typeName(row.type)} · ${row.category || 'Sin categoría'}`;
const percent = (value: number | null) => value === null ? 'Sin base' : `${formatNumber(value)} %`;
const ratio = (value: number | null) => value === null ? 'Sin base' : formatNumber(value);
const PAGE = 8;

function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ selected, disabled }} onPress={onPress} style={[s.chip, selected && s.chipActive, disabled && s.disabled]}>
    <Text style={selected ? s.link : s.small}>{label}</Text>
  </Pressable>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return <ScrollView horizontal accessibilityLabel="Tabla de análisis; desplaza horizontalmente para ver todas las columnas">
    <View><View style={[d.row, d.header]}>{headers.map((header, index) => <Text key={header} style={[d.cell, index === 0 && d.first, d.headerText]}>{header}</Text>)}</View>
      {rows.map((row, index) => <View key={index} style={[d.row, index % 2 === 0 && d.stripe]}>{row.map((value, column) => <Text selectable key={column} style={[d.cell, column === 0 && d.first]}>{typeof value === 'number' ? formatNumber(value) : value}</Text>)}</View>)}
    </View>
  </ScrollView>;
}

function Pager({ count, page, onPage }: { count: number; page: number; onPage: (page: number) => void }) {
  if (count <= PAGE) return null;
  return <View style={s.wrap}>
    <Choice label="Anterior" selected={false} disabled={page === 0} onPress={() => onPage(Math.max(0, page - 1))} />
    <Text style={s.small}>{page * PAGE + 1}–{Math.min(count, (page + 1) * PAGE)} de {count}</Text>
    <Choice label="Siguiente" selected={false} disabled={(page + 1) * PAGE >= count} onPress={() => onPage(Math.min(Math.ceil(count / PAGE) - 1, page + 1))} />
  </View>;
}

export function CareerAudience({ rows }: { rows: CareerActivityAudience[] }) {
  const [term, setTerm] = useState(''), [segment, setSegment] = useState(''), [page, setPage] = useState(0);
  const [sort, setSort] = useState<'uniqueParticipants' | 'participantShare' | 'viewToJoinRate'>('uniqueParticipants');
  const [minimum, setMinimum] = useState(0);
  const segments = [...new Set(rows.map(segmentName))].sort();
  const filtered = rows.filter(row => row.uniqueParticipants >= minimum && (!segment || segmentName(row) === segment) && row.careerName.toLocaleLowerCase('es').includes(term.trim().toLocaleLowerCase('es')))
    .sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1) || b.uniqueParticipants - a.uniqueParticipants || a.careerName.localeCompare(b.careerName));
  const max = Math.max(0, ...filtered.map(row => row.uniqueParticipants));
  return <View style={s.stack}>
    <View><Text accessibilityRole="header" style={s.heading}>¿Qué carreras se interesan más?</Text>
      <Text style={s.small}>Compara personas únicas y afinidad: la proporción de participantes de cada carrera que eligió ese tipo y categoría.</Text></View>
    <ScrollView horizontal><View style={s.wrap}>
      <Choice label="Todos los tipos" selected={!segment} onPress={() => { setSegment(''); setPage(0); }} />
      {segments.map(label => <Choice key={label} label={label} selected={segment === label} onPress={() => { setSegment(label); setPage(0); }} />)}
    </View></ScrollView>
    <TextInput accessibilityLabel="Buscar carrera en participación" placeholder="Buscar carrera" value={term} onChangeText={value => { setTerm(value); setPage(0); }} style={s.input} />
    <View style={s.wrap}>{([['uniqueParticipants', 'Más participantes'], ['participantShare', 'Mayor afinidad'], ['viewToJoinRate', 'Mayor conversión']] as const).map(([key, label]) =>
      <Choice key={key} label={label} selected={sort === key} onPress={() => { setSort(key); setPage(0); }} />)}</View>
    <View style={s.wrap}><Text style={s.small}>Base mínima:</Text>{[0, 5, 10].map(value => <Choice key={value} label={value === 0 ? 'Sin mínimo' : `${value} participantes`} selected={minimum === value} onPress={() => { setMinimum(value); setPage(0); }} />)}</View>
    {filtered.length ? <>
      {filtered.slice(page * PAGE, (page + 1) * PAGE).map(row => <View key={JSON.stringify([row.careerId, row.type, row.category])} style={d.audienceRow}>
        <View style={s.wrap}><Text style={[s.label, { flexGrow: 1, flexShrink: 1, minWidth: 0, flexBasis: 160 }]}>{row.careerName}</Text><Text style={[s.link, { flexShrink: 1 }]}>{formatNumber(row.uniqueParticipants)} participantes</Text></View>
        <Text style={s.small}>{segmentName(row)}</Text>
        <View style={d.track} accessible={false}><View style={[d.fill, { width: `${max > 0 ? row.uniqueParticipants / max * 100 : 0}%` }]} /></View>
        <Text style={s.body}>Afinidad {percent(row.participantShare)} · {formatNumber(row.uniqueParticipants)} de {formatNumber(row.careerParticipants)} participantes de la carrera</Text>
        <Text style={s.small}>{formatNumber(row.views)} vistas · {formatNumber(row.uniqueViewers)} personas que vieron · {formatNumber(row.joins)} inscripciones · {formatNumber(row.withdrawals)} retiros</Text>
        <Text style={s.small}>Conversión {percent(row.viewToJoinRate)} ({formatNumber(row.convertedPairs)}/{formatNumber(row.viewedPairs)} pares persona–actividad) · Recurrencia {percent(row.repeatParticipantRate)}</Text>
      </View>)}
      <Pager count={filtered.length} page={page} onPage={setPage} />
    </> : <Text style={s.muted}>{rows.length ? 'No hay carreras que coincidan con la búsqueda y la base mínima.' : 'No hay interacciones de actividades registradas en este período.'}</Text>}
    <Text style={s.small}>La afinidad permite comparar carreras de distinto tamaño dentro de su audiencia participante. Una misma persona puede participar en varios tipos y pertenecer a varias carreras; los porcentajes no suman necesariamente 100 %.</Text>
  </View>;
}

export function AcademicAudience({ careers, subjects }: { careers: AcademicDemand[]; subjects: AcademicDemand[] }) {
  const [dimension, setDimension] = useState<'careers' | 'subjects'>('careers'), [term, setTerm] = useState(''), [page, setPage] = useState(0);
  const [sort, setSort] = useState<'requests' | 'views' | 'uniqueRequesters'>('requests');
  const rows = (dimension === 'careers' ? careers : subjects).filter(row => row.name.toLocaleLowerCase('es').includes(term.trim().toLocaleLowerCase('es')))
    .sort((a, b) => b[sort] - a[sort] || b.views - a.views || a.name.localeCompare(b.name));
  return <View style={s.stack}>
    <Text style={s.body}>Identifica qué recursos reciben atención y solicitudes según su clasificación académica.</Text>
    <View style={s.wrap}>{([['careers', 'Por carrera'], ['subjects', 'Por asignatura']] as const).map(([key, label]) => <Choice key={key} label={label} selected={dimension === key} onPress={() => { setDimension(key); setTerm(''); setPage(0); }} />)}</View>
    <TextInput accessibilityLabel="Buscar clasificación académica" placeholder="Buscar carrera o asignatura" value={term} onChangeText={value => { setTerm(value); setPage(0); }} style={s.input} />
    <View style={s.wrap}>{([['requests', 'Más solicitudes'], ['views', 'Más vistas'], ['uniqueRequesters', 'Más solicitantes']] as const).map(([key, label]) => <Choice key={key} label={label} selected={sort === key} onPress={() => { setSort(key); setPage(0); }} />)}</View>
    {rows.length ? <DataTable headers={['Clasificación', 'Vistas', 'Solicitudes', 'Recursos con demanda', 'Solicitantes únicos', 'Solicitudes por 100 vistas']} rows={rows.slice(page * PAGE, (page + 1) * PAGE).map(row => [row.name, row.views, row.requests, row.resourcesWithDemand, row.uniqueRequesters, ratio(row.requestsPer100Views)])} />
      : <Text style={s.muted}>No hay demanda registrada que coincida con estos filtros.</Text>}
    <Pager count={rows.length} page={page} onPage={setPage} />
    <Text style={s.small}>Clasificación del recurso, según asociaciones al generar; no indica la carrera del solicitante. Un recurso puede pertenecer a varias carreras y asignaturas. La razón de solicitudes por 100 vistas puede superar 100: no es conversión de personas.</Text>
  </View>;
}

export function AnalyticsDeepDive({ dashboard }: { dashboard: DashboardData }) {
  const [tab, setTab] = useState<'activities' | 'resources'>('activities'), [period, setPeriod] = useState('total'), [definitions, setDefinitions] = useState(false);
  // Los snapshots anteriores no se recalculan ni se presentan como ceros.
  if (dashboard.analysis === undefined) return <View style={s.card}><Text style={s.label}>Análisis avanzado</Text><Text style={s.muted}>Este reporte se generó con la versión anterior. Genera uno nuevo para incluir cruces por carrera, conversión y demanda académica.</Text></View>;
  const interval = dashboard.intervals.find(row => row.key === period);
  const analysis = period === 'total' ? dashboard.analysis : interval?.metrics?.analysis;
  const audience = analysis?.activities.summary;
  return <View style={s.card}>
    <View><Text style={s.eyebrow}>EXPLORAR LOS DATOS</Text><Text accessibilityRole="header" style={s.heading}>Participación y demanda académica</Text></View>
    <View style={s.wrap}>
      <Choice label="Participación en actividades" selected={tab === 'activities'} onPress={() => setTab('activities')} />
      <Choice label="Demanda académica" selected={tab === 'resources'} onPress={() => setTab('resources')} />
    </View>
    <Text style={s.label}>Período del análisis</Text>
    <ScrollView horizontal><View style={s.wrap}>
      <Choice label="Todo el rango" selected={period === 'total'} onPress={() => setPeriod('total')} />
      {dashboard.intervals.map(row => <Choice key={row.key} label={row.label} selected={period === row.key} onPress={() => setPeriod(row.key)} />)}
    </View></ScrollView>
    {period !== 'total' && interval && <Text style={s.small}>{interval.period.from} a {interval.period.to} · {interval.period.timeZone}</Text>}
    {!analysis ? <Text style={s.muted}>Sin datos disponibles para este período.</Text> : tab === 'activities' && audience ? <>
      <View style={d.summary}>{[
        ['Participantes únicos', formatNumber(audience.uniqueParticipants)], ['Personas que vieron', formatNumber(audience.uniqueViewers)],
        ['Conversión observada', percent(audience.viewToJoinRate)], ['Recurrencia', percent(audience.repeatParticipantRate)],
      ].map(([label, value]) => <View key={label} style={d.stat}><Text style={s.small}>{label}</Text><Text style={d.value}>{value}</Text></View>)}</View>
      <Text style={s.small}>{formatNumber(audience.views)} vistas · {formatNumber(audience.joins)} inscripciones · {formatNumber(audience.withdrawals)} retiros. Las inscripciones incluyen al creador y no acreditan asistencia.</Text>
      <Text style={s.small}>Conversión: {formatNumber(audience.convertedPairs)} de {formatNumber(audience.viewedPairs)} pares persona–actividad con vista y posterior inscripción en el período. Recurrencia: {formatNumber(audience.repeatParticipants)} de {formatNumber(audience.uniqueParticipants)} participantes en dos o más actividades distintas.</Text>
      <Text accessibilityRole="header" style={s.label}>Interés por tipo y categoría</Text>
      {analysis.activities.segments.length > 0 && <DataTable headers={['Tipo y categoría', 'Participantes únicos', 'Personas que vieron', 'Inscripciones', 'Retiros', 'Conversión observada']} rows={analysis.activities.segments.map(row => [segmentName(row), row.uniqueParticipants, row.uniqueViewers, row.joins, row.withdrawals, percent(row.viewToJoinRate)])} />}
      <CareerAudience key={period} rows={analysis.activities.careers} />
    </> : <AcademicAudience key={period} careers={analysis.resources.careers} subjects={analysis.resources.subjects} />}
    {analysis && <>
      <Choice label={definitions ? 'Ocultar definiciones' : 'Cómo se calculan estas métricas'} selected={definitions} onPress={() => setDefinitions(value => !value)} />
      {definitions && analysis.definitions.map(definition => <Text key={definition} style={s.small}>{definition}</Text>)}
    </>}
  </View>;
}

const d = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: 180, flexGrow: 1, backgroundColor: c.tint, padding: 14, borderRadius: 12, gap: 6 },
  value: { color: c.PRIMARY, fontSize: 24, fontWeight: '700' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border },
  header: { backgroundColor: c.PRIMARY }, headerText: { color: '#FFFFFF', fontWeight: '600' },
  cell: { width: 124, padding: 12, fontSize: 12, lineHeight: 18, color: c.ink, textAlign: 'right' },
  first: { width: 220, textAlign: 'left' }, stripe: { backgroundColor: '#F4F7F9' },
  audienceRow: { gap: 7, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 14 },
  track: { height: 6, backgroundColor: c.tint, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: c.PRIMARY, borderRadius: 3 },
});
