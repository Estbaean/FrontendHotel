import { Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Btn } from '../UI/index.jsx';
import s from './Filters.module.css';

/* ── Toggle button (Filtros [3] ▾) ───────────── */
export function FilterToggle({ open, activeCount, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${s.toggleBtn} ${activeCount > 0 ? s.active : s.idle}`}
    >
      <Filter size={14} />
      Filtros
      {activeCount > 0 && <span className={s.badge}>{activeCount}</span>}
      {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
    </button>
  );
}

/* ── Collapsible filter panel ─────────────────── */
export function FilterPanel({ open, activeCount, onClear, children }) {
  if (!open) return null;
  return (
    <div className={s.panel}>
      {children}
      {activeCount > 0 && (
        <div>
          <Btn variant="ghost" onClick={onClear}>Limpiar todos los filtros</Btn>
        </div>
      )}
    </div>
  );
}

/* ── Active filter pills (summary when collapsed) */
export function FilterPills({ items }) {
  if (!items || items.length === 0) return null;
  const colorMap = { blue: s.pillBlue, purple: s.pillPurple, orange: s.pillOrange, gray: s.pillGray };
  return (
    <div className={s.pills}>
      {items.map((p, i) => (
        <span key={i} className={colorMap[p.color] || s.pillGray}>{p.label}</span>
      ))}
    </div>
  );
}

/* ── Section label ────────────────────────────── */
export function FilterLabel({ children, small }) {
  return <label className={small ? s.filterLabelSmall : s.filterLabel}>{children}</label>;
}
