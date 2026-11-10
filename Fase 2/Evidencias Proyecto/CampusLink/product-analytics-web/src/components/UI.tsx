import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { number, percent } from './Charts';

export function Badge({ real = false, children }: { real?: boolean; children?: ReactNode }) { return <span className={`badge ${real ? 'real' : 'demo'}`}><span />{children ?? (real ? 'Datos reales' : 'Demostración')}</span>; }
export function Card({ title, subtitle, children, real = false, className = '', action }: { title: string; subtitle?: string; children: ReactNode; real?: boolean; className?: string; action?: ReactNode }) {
  return <section className={`card ${className}`} aria-label={title}><div className="card-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action ?? <Badge real={real} />}</div>{children}</section>;
}
export function Metric({ label, value, unit, detail, icon, accent = false, hint }: { label: string; value: number | null; unit?: string; detail: string; icon: string; accent?: boolean; hint?: string }) {
  return <article className={`metric ${accent ? 'metric-accent' : ''}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon name={icon} size={18} /></span></div>
    <div className="metric-value">{unit === '%' ? percent(value) : number(value, unit ? 1 : 0)}{unit && unit !== '%' && <small>{unit}</small>}</div>
    <p>{detail}</p>{hint && <span className="metric-hint">{hint}</span>}</article>;
}
export function Notice({ children, title, kind = 'info' }: { children: ReactNode; title?: string; kind?: 'info' | 'warning' }) {
  return <div className={`notice ${kind}`}><Icon name={kind === 'warning' ? 'shield' : 'info'} size={18} /><div>{title && <strong>{title}</strong>}<div>{children}</div></div></div>;
}
export function Empty({ title, children, action, icon = 'chart' }: { title: string; children: ReactNode; action?: ReactNode; icon?: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={28} /></div><h2>{title}</h2><p>{children}</p>{action}</div>;
}
export function Dialog({ onClose, children, title }: { onClose: () => void; children: ReactNode; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement as HTMLElement | null; dialog?.showModal(); return () => { dialog?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) onClose(); }} aria-labelledby="dialog-title">
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></div><div className="dialog-body">{children}</div>
  </dialog>;
}
