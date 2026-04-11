import { useState, useCallback, useMemo } from 'react';

/**
 * Generic filter state manager.
 *
 * @param {Record<string, any>} initialValues – e.g. { search: '', tipo: '', desde: '', hasta: '' }
 * @param {object}              [opts]
 * @param {function}            [opts.onReset]  – extra callback on clear (e.g. resetPage)
 * @returns {{ filters, setFilter, clearFilters, activeCount, filtrosOpen, toggleFiltros }}
 */
export default function useFilters(initialValues, opts = {}) {
  const [filters, setFilters] = useState(initialValues);
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    opts.onReset?.();
  }, [opts]);

  const setMultiple = useCallback((patch) => {
    setFilters(prev => ({ ...prev, ...patch }));
    opts.onReset?.();
  }, [opts]);

  const clearFilters = useCallback(() => {
    setFilters(initialValues);
    opts.onReset?.();
  }, [initialValues, opts]);

  const activeCount = useMemo(
    () => Object.values(filters).filter(v => typeof v === 'string' ? v.trim() !== '' : Boolean(v)).length,
    [filters],
  );

  const toggleFiltros = useCallback(() => setFiltrosOpen(o => !o), []);

  return { filters, setFilter, setMultiple, clearFilters, activeCount, filtrosOpen, toggleFiltros };
}
