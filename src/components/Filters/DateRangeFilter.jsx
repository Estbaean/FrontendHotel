import { inputStyle } from '../UI/index.jsx';
import { quickDateBtn } from '../../constants/filterStyles';
import { FilterLabel } from './FilterPanel';
import s from './Filters.module.css';

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => {
  const h = new Date(); const y = h.getFullYear(); const m = h.getMonth();
  return {
    desde: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    hasta: new Date(y, m + 1, 0).toISOString().slice(0, 10),
  };
};
const thisWeek = () => {
  const h = new Date();
  const dom = new Date(h); dom.setDate(h.getDate() - ((h.getDay() + 6) % 7));
  const fin = new Date(dom); fin.setDate(dom.getDate() + 6);
  return { desde: dom.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) };
};

/**
 * @param {{ desde, hasta, onChange, label?, showWeek? }} props
 */
export default function DateRangeFilter({ desde, hasta, onChange, label = 'Período', showWeek = false }) {
  return (
    <div>
      <FilterLabel>{label}</FilterLabel>
      <div className={s.dateRow}>
        <div className={s.dateField}>
          <span className={s.dateFieldLabel}>Desde</span>
          <input type="date" style={{ ...inputStyle, width: 150 }} value={desde} onChange={e => onChange({ desde: e.target.value, hasta })} />
        </div>
        <div className={s.dateField}>
          <span className={s.dateFieldLabel}>Hasta</span>
          <input type="date" style={{ ...inputStyle, width: 150 }} value={hasta} onChange={e => onChange({ desde, hasta: e.target.value })} />
        </div>
        <button type="button" onClick={() => { const d = today(); onChange({ desde: d, hasta: d }); }} style={quickDateBtn}>Hoy</button>
        <button type="button" onClick={() => onChange(thisMonth())} style={quickDateBtn}>Este mes</button>
        {showWeek && <button type="button" onClick={() => onChange(thisWeek())} style={quickDateBtn}>Esta semana</button>}
        {(desde || hasta) && (
          <button type="button" onClick={() => onChange({ desde: '', hasta: '' })} style={{ ...quickDateBtn, color: 'var(--red,#e53935)' }}>× Limpiar</button>
        )}
      </div>
    </div>
  );
}
