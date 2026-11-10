import { useId, useState } from 'react';
import type { Rank } from '../domain/types.ts';

export const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : new Intl.NumberFormat('es-CL', { maximumFractionDigits: digits }).format(value);
export const percent = (value: number | null | undefined) => value == null ? '—' : `${number(value, 1)} %`;
const palette = ['#002E56', '#3F6A8E', '#FDBB30', '#92AFC4', '#B5C8D6'];

export function LineChart({ labels, series, title }: { labels: string[]; series: { label: string; values: (number | null)[]; color: string; dashed?: boolean }[]; title: string }) {
  const id = useId().replace(/:/g, ''), [selected, setSelected] = useState<number | null>(null), [table, setTable] = useState(false);
  const max = Math.max(4, ...series.flatMap(s => s.values.filter((v): v is number => v !== null)));
  const ceiling = Math.ceil(max / 4 / Math.pow(10, Math.floor(Math.log10(max)) - 1)) * Math.pow(10, Math.floor(Math.log10(max)) - 1) * 4;
  const x = (i: number) => labels.length === 1 ? 394 : 48 + i / Math.max(1, labels.length - 1) * 692;
  const y = (v: number) => 218 - v / ceiling * 180;
  const points = series.map(s => s.values.map((value, i) => value === null ? null : `${x(i)},${y(value)}`));
  const tickIndices = [...new Set([0, Math.floor((labels.length - 1) / 4), Math.floor((labels.length - 1) / 2), Math.floor((labels.length - 1) * 3 / 4), labels.length - 1])].filter(i => i >= 0);
  return <div className="chart-wrap">
    <div className="chart-tools"><div className="legend">{series.map(s => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</div><button className="text-button" onClick={() => setTable(!table)} aria-pressed={table}>{table ? 'Ver gráfico' : 'Ver tabla'}</button></div>
    {table ? <div className="chart-table"><table><caption className="sr-only">{title}</caption><thead><tr><th>Fecha</th>{series.map(s => <th key={s.label}>{s.label}</th>)}</tr></thead><tbody>{labels.map((label, i) => <tr key={i}><th>{label}</th>{series.map(s => <td key={s.label}>{number(s.values[i])}</td>)}</tr>)}</tbody></table></div>
      : <><svg className="line-chart" viewBox="0 0 770 257" role="img" aria-label={`${title}. Usa Ver tabla para consultar todos los valores.`} onPointerLeave={() => setSelected(null)}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series[0]?.color ?? palette[0]} stopOpacity=".12" /><stop offset="100%" stopColor={palette[0]} stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="48" x2="740" y1={y(ceiling * i / 4)} y2={y(ceiling * i / 4)} stroke="#E6ECF0" strokeDasharray="3 5" /><text x="34" y={y(ceiling * i / 4) + 4} textAnchor="end">{number(ceiling * i / 4)}</text></g>)}
        {series.map((s, si) => <g key={s.label}>
          {si === 0 && points[si].every(p => p !== null) && points[si].length > 1 && <path d={`M${x(0)},218 L${points[si].join(' L')} L${x(labels.length - 1)},218 Z`} fill={`url(#${id})`} />}
          {/* Una métrica nula interrumpe la línea: no se sustituye por cero. */}
          <path d={points[si].reduce<string>((acc, p, i) => p === null ? acc : `${acc} ${i === 0 || points[si][i - 1] === null ? 'M' : 'L'}${p}`, '')} fill="none" stroke={s.color} strokeWidth="2.8" strokeDasharray={s.dashed ? '5 5' : undefined} strokeLinejoin="round" strokeLinecap="round" />
          {labels.length === 1 && s.values[0] !== null && <circle cx={x(0)} cy={y(s.values[0])} r="4.5" fill={s.color} stroke="white" strokeWidth="2"><title>{s.label}: {number(s.values[0])}</title></circle>}
          {selected !== null && s.values[selected] != null && <circle cx={x(selected)} cy={y(s.values[selected]!)} r="5" fill={s.color} stroke="white" strokeWidth="2.5" />}
        </g>)}
        {selected !== null && <line x1={x(selected)} x2={x(selected)} y1="25" y2="218" stroke="#90A4B5" strokeDasharray="3 4" />}
        {tickIndices.map(i => <text key={i} x={x(i)} y="245" textAnchor="middle">{labels[i]}</text>)}
        {labels.map((label, i) => <rect key={i} x={x(i) - 346 / Math.max(1, labels.length - 1)} y="20" width={Math.max(16, 692 / Math.max(1, labels.length - 1))} height="204" fill="transparent" onPointerEnter={() => setSelected(i)}><title>{label}: {series.map(s => `${s.label}: ${number(s.values[i])}`).join(', ')}</title></rect>)}
      </svg><div className="chart-readout" aria-live="polite">{selected === null ? 'Explora el gráfico para ver el detalle de cada fecha.' : `${labels[selected]} · ${series.map(s => `${s.label}: ${number(s.values[selected])}`).join(' · ')}`}</div></>}
  </div>;
}

export function Bars({ rows, unit = 'cantidad', rates = false, secondary = false }: { rows: Rank[]; unit?: string; rates?: boolean; secondary?: boolean }) {
  const max = rates ? 100 : Math.max(1, ...rows.map(r => r.value ?? 0));
  return <div className="bars">{rows.length ? rows.map((row, i) => <div className="bar-row" key={row.label}>
    <div className="bar-label"><span title={row.label}>{row.label}</span><strong>{rates ? percent(row.value) : number(row.value)}{secondary && <small> / {number(row.secondary)} vistas</small>}</strong></div>
    <div className="bar-track" role="img" aria-label={`${row.label}: ${row.value === null ? 'grupo protegido' : rates ? percent(row.value) : number(row.value) + ' ' + unit}`}><div style={{ width: `${(row.value ?? 0) / max * 100}%`, background: palette[i % palette.length] }} /></div>
    {row.value === null && <small className="muted">Grupo protegido</small>}
  </div>) : <p className="muted">No hay registros para esta selección.</p>}</div>;
}

export function Donut({ rows }: { rows: Rank[] }) {
  const allKnown = rows.every(r => r.value !== null), total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  let offset = 0;
  return <div className="donut-layout"><div className="donut-graphic"><svg viewBox="0 0 200 200" role="img" aria-label={allKnown ? `Distribución de ${number(total)} interacciones` : 'Distribución protegida por grupos pequeños'}>
    <circle cx="100" cy="100" r="73" fill="none" stroke="#EEF2F5" strokeWidth="26" />
    {allKnown && total > 0 && rows.map((row, i) => { const length = (row.value ?? 0) / total * 458.67, start = offset; offset += length;
      return <circle key={row.label} cx="100" cy="100" r="73" fill="none" stroke={palette[i % palette.length]} strokeWidth="26" strokeDasharray={`${Math.max(0, length - 4)} ${458.67 - Math.max(0, length - 4)}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{row.label}: {number(row.value)} ({percent((row.value ?? 0) / total * 100)})</title></circle>; })}
    <text x="100" y="100" textAnchor="middle" className="donut-total">{allKnown ? number(total) : '—'}</text><text x="100" y="122" textAnchor="middle" className="donut-caption">interacciones</text>
  </svg></div><div className="donut-legend">{rows.map((row, i) => <div key={row.label}><span><i style={{ background: palette[i % palette.length] }} />{row.label}</span><strong>{allKnown && total ? percent((row.value ?? 0) / total * 100) : '—'}</strong><small>{number(row.value)} registros</small></div>)}</div></div>;
}
