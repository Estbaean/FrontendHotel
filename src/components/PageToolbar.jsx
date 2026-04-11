import { Card, SearchInput, RSelect } from './UI';
import { FilterLabel } from './Filters';

/**
 * Unified toolbar wrapper for all data pages.
 * Provides a consistent Card container + layout helpers.
 *
 * @param {ReactNode} children — main toolbar row(s)
 * @param {ReactNode} panel    — optional collapsible FilterPanel
 */
function PageToolbar({ children, panel }) {
  return (
    <Card padding="12px 16px" style={{ marginBottom: 18 }}>
      {children}
      {panel}
    </Card>
  );
}

/** Flex row — use `inline` for label-above-control layout (simple filter pages) */
PageToolbar.Row = function TBRow({ children, inline }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: inline ? 'flex-end' : 'center',
    }}>
      {children}
    </div>
  );
};

/** Search field with "Buscar" label */
PageToolbar.Search = function TBSearch({ value, onChange, placeholder }) {
  return (
    <div style={{ flex: '1 1 220px', minWidth: 180 }}>
      <FilterLabel small>Buscar</FilterLabel>
      <SearchInput value={value} onChange={onChange} placeholder={placeholder || 'Buscar…'} />
    </div>
  );
};

/** Dropdown filter with label */
PageToolbar.Filter = function TBFilter({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <FilterLabel small>{label}</FilterLabel>
      <RSelect value={value} onValueChange={onChange} options={options} placeholder={placeholder} />
    </div>
  );
};

/** Right-aligned action buttons group */
PageToolbar.Actions = function TBActions({ children }) {
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {children}
    </div>
  );
};

export default PageToolbar;
