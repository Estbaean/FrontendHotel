import { chipStyle } from '../../constants/filterStyles';
import { FilterLabel } from './FilterPanel';
import s from './Filters.module.css';

/**
 * A row of chip-style buttons for selecting a filter value.
 *
 * @param {{ label?, options: [value, label][], value, onChange }} props
 */
export default function ChipGroup({ label, options, value, onChange }) {
  return (
    <div>
      {label && <FilterLabel>{label}</FilterLabel>}
      <div className={s.chipRow}>
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)} style={chipStyle(value === v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}
