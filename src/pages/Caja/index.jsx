import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Table, Btn, EmptyState, Pagination, Card, SearchInput, tdStyle, PageHeader, useToast } from '../../components/UI/index.jsx';
import { DollarSign, TrendingUp, TrendingDown, Plus, FileText, Download, Pencil, ArrowUp, ArrowDown, Clock, Trash2, ClipboardList } from 'lucide-react';
import { getMovimientosRango, getResumenHoy } from '../../api/caja';
import { descargarReporteCajaMovimientos, generarCierreCaja, generarReporteEmpresa } from '../../utils/reportesPdf';
import { FilterToggle, FilterPanel, FilterPills, FilterLabel, DateRangeFilter, ChipGroup } from '../../components/Filters';
import PageToolbar from '../../components/PageToolbar';
import { MovimientoFormModal, EditMontoModal, CobrarModal, CobrarLoteModal } from './CajaModals';
import GestionarCuentaModal from './GestionarCuentaModal';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { deleteMovimientos, previewDeleteMovimientos } from '../../api/caja';
import s from '../../styles/shared.module.css';

const PER_PAGE = 15;
const CAJA_FILTROS_STORAGE_KEY = 'caja.filtros.rango';

export default function Caja() {
  const { empresas } = useHotel();
  const addToast = useToast();

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState('EGRESO');
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState({
    totalIngresos: 0,
    totalEgresos: 0,
    balance: 0,
    cantidadMovimientos: 0,
    movimientos: [],
  });

  // Resumen date filter (todos los roles) - persistido en localStorage
  const [filtroDesde, setFiltroDesde] = useState(() => {
    try {
      const raw = localStorage.getItem(CAJA_FILTROS_STORAGE_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.desde || '';
    } catch {
      return '';
    }
  });
  const [filtroHasta, setFiltroHasta] = useState(() => {
    try {
      const raw = localStorage.getItem(CAJA_FILTROS_STORAGE_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.hasta || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!filtroDesde && !filtroHasta) {
      localStorage.removeItem(CAJA_FILTROS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CAJA_FILTROS_STORAGE_KEY, JSON.stringify({ desde: filtroDesde, hasta: filtroHasta }));
  }, [filtroDesde, filtroHasta]);

  const [filtrosOpen, setFiltrosOpen]     = useState(false);
  const [filtroTipo, setFiltroTipo]       = useState('');
  const [filtroMetodo, setFiltroMetodo]   = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEmpresaNombre, setFiltroEmpresaNombre] = useState('');
  const [buscarNombre, setBuscarNombre]   = useState('');
  const [sortDir, setSortDir]             = useState('desc');

  // Tab state
  const [activeTab, setActiveTab] = useState('movimientos');

  const filtroActivosMov = [filtroDesde, filtroHasta, filtroTipo, filtroMetodo, filtroCliente, filtroEmpresaNombre, buscarNombre.trim()].filter(Boolean).length;
  const filtroActivosEmp = [filtroDesde, filtroHasta, filtroEmpresaNombre, buscarNombre.trim()].filter(Boolean).length;
  const filtroActivos = activeTab === 'cuentas_empresa' ? filtroActivosEmp : filtroActivosMov;
  const limpiarFiltros = () => { setFiltroDesde(''); setFiltroHasta(''); setFiltroTipo(''); setFiltroMetodo(''); setFiltroCliente(''); setFiltroEmpresaNombre(''); setBuscarNombre(''); setPage(1); setPageEmpresa(1); };

  // Edit monto state (admin only)
  const [editMontoModal, setEditMontoModal] = useState(null);

  // Cobrar empresa state (admin only)
  const [cobrarModal, setCobrarModal] = useState(null);
  const [pageEmpresa, setPageEmpresa] = useState(1);

  // Cobrar lote empresa state (admin only)
  const [cobrarLoteModal, setCobrarLoteModal] = useState(false);

  // Gestionar cuenta empresa modal
  const [gestionarModal, setGestionarModal] = useState(null);

  // Eliminar caja (admin only)
  const [deleteModal, setDeleteModal] = useState(false);

  const fetchResumen = useCallback(async () => {
    setLoading(true);
    try {
      const desde = filtroDesde || '2000-01-01';
      const hasta = filtroHasta || new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const movs = await getMovimientosRango(desde, hasta);
      const movimientos = Array.isArray(movs) ? movs : [];
      const totalIngresos = movimientos.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
      const totalEgresos = movimientos.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
      setResumen({
        totalIngresos,
        totalEgresos,
        balance: totalIngresos - totalEgresos,
        cantidadMovimientos: movimientos.length,
        movimientos,
      });
    } catch {
      setResumen({ totalIngresos: 0, totalEgresos: 0, balance: 0, cantidadMovimientos: 0, movimientos: [] });
      addToast('No se pudo cargar información de caja desde backend.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filtroDesde, filtroHasta, addToast]);

  useEffect(() => {
    fetchResumen();
  }, [fetchResumen]);

  const movimientosFiltrados = useMemo(() => {
    let filtered = resumen.movimientos;
    if (filtroTipo) filtered = filtered.filter(m => filtroTipo === 'INGRESO' ? m.tipo === 'INGRESO' : m.tipo === 'EGRESO');
    if (filtroMetodo) filtered = filtered.filter(m => m.metodoPago?.toUpperCase() === filtroMetodo);
    if (filtroCliente === 'SOLO_CLIENTES') filtered = filtered.filter(m => !m.nombreEmpresa || m.nombreEmpresa === '—');
    if (filtroCliente === 'SOLO_EMPRESAS') filtered = filtered.filter(m => m.nombreEmpresa && m.nombreEmpresa !== '—');
    if (filtroEmpresaNombre) filtered = filtered.filter(m => m.nombreEmpresa === filtroEmpresaNombre);
    if (buscarNombre.trim()) {
      const q = buscarNombre.toLowerCase().trim();
      filtered = filtered.filter(m =>
        m.concepto?.toLowerCase().includes(q) ||
        m.nombreCliente?.toLowerCase().includes(q) ||
        m.nombreUsuario?.toLowerCase().includes(q) ||
        m.nombreEmpresa?.toLowerCase().includes(q) ||
        String(m.numeroHabitacion).includes(q)
      );
    }
    return filtered;
  }, [resumen.movimientos, filtroTipo, filtroMetodo, filtroCliente, filtroEmpresaNombre, buscarNombre]);

  const movimientosSorted = useMemo(() => {
    return [...movimientosFiltrados].sort((a, b) => {
      const ta = new Date(a.fecha).getTime();
      const tb = new Date(b.fecha).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
  }, [movimientosFiltrados, sortDir]);

  const cuentasEmpresaAll = useMemo(() => {
    return resumen.movimientos.filter(m => m.tipo === 'PENDIENTE');
  }, [resumen.movimientos]);

  const cuentasEmpresaPendientes = useMemo(() => {
    let filtered = cuentasEmpresaAll;
    if (filtroEmpresaNombre) filtered = filtered.filter(m => m.nombreEmpresa === filtroEmpresaNombre);
    if (buscarNombre.trim()) {
      const q = buscarNombre.toLowerCase().trim();
      filtered = filtered.filter(m =>
        m.concepto?.toLowerCase().includes(q) ||
        m.nombreCliente?.toLowerCase().includes(q) ||
        m.nombreEmpresa?.toLowerCase().includes(q) ||
        String(m.numeroHabitacion).includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.fecha).getTime();
      const tb = new Date(b.fecha).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
  }, [cuentasEmpresaAll, filtroEmpresaNombre, buscarNombre, sortDir]);

  const empresasConPendientes = useMemo(() => {
    const nombres = [...new Set(cuentasEmpresaAll.map(m => m.nombreEmpresa).filter(Boolean))];
    return nombres.sort();
  }, [cuentasEmpresaAll]);

  const totalPendienteEmpresas = useMemo(() =>
    cuentasEmpresaPendientes.reduce((s, m) => s + (parseFloat(m.monto) || 0), 0),
    [cuentasEmpresaPendientes]
  );

  const empresasConDeuda = useMemo(() =>
    new Set(cuentasEmpresaAll.map(m => m.nombreEmpresa).filter(Boolean)).size,
    [cuentasEmpresaAll]
  );

  const resumenFiltrado = useMemo(() => {
    const totalIngresos = movimientosFiltrados
      .filter(m => m.tipo === 'INGRESO')
      .reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
    const totalEgresos = movimientosFiltrados
      .filter(m => m.tipo === 'EGRESO')
      .reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
    return {
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      cantidadMovimientos: movimientosFiltrados.length,
    };
  }, [movimientosFiltrados]);

  const paged = movimientosSorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openModal = (tipo) => { setModalTipo(tipo); setModalOpen(true); };

  return (
    <div className="page-anim">
      <PageHeader title="Caja / Movimientos" subtitle={`Registra ingresos, egresos y controla saldo · ${movimientosFiltrados.length}`}>
          <Btn icon={<Plus size={14} />} onClick={() => openModal('INGRESO_EXTRA')} title="Registrar ingresos fuera de alquileres (servicios, depósitos, etc.)">Ingreso Adicional</Btn>
          <Btn icon={<TrendingDown size={14} />} variant="ghost" onClick={() => openModal('EGRESO')}>Registrar Egreso</Btn>
          <Btn
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={() => setDeleteModal(true)}
            title="Eliminar permanentemente todos los movimientos de caja"
          >
            Limpiar Caja
          </Btn>
      </PageHeader>

      {/* Summary Cards — per tab */}
      {activeTab === 'movimientos' && (
      <div className={s.summaryGrid}>
        <SummaryCard label="Total Ingresos" value={resumenFiltrado.totalIngresos} color="var(--green, #43a047)" bg="var(--green-bg, #e8f5e9)" icon={<TrendingUp size={16} />} />
        <SummaryCard label="Total Egresos" value={resumenFiltrado.totalEgresos} color="var(--red, #e53935)" bg="var(--red-bg, #fbe9e7)" icon={<TrendingDown size={16} />} />
        <SummaryCard label="Balance" value={resumenFiltrado.balance} color={resumenFiltrado.balance >= 0 ? 'var(--accent)' : 'var(--red, #e53935)'} bg="var(--accent-light, #e3f2fd)" icon={<DollarSign size={16} />} />
        <SummaryCard label="Movimientos" value={resumenFiltrado.cantidadMovimientos} isCount color="var(--text-2)" bg="var(--surface-2, #f5f5f5)" icon={<FileText size={16} />} />
      </div>
      )}
      {activeTab === 'cuentas_empresa' && (
      <div className={s.summaryGrid}>
        <SummaryCard label="Total Pendiente" value={totalPendienteEmpresas} color="#e65100" bg="#fff3e0" icon={<Clock size={16} />} />
        <SummaryCard label="Empresas con deuda" value={empresasConDeuda} isCount color="var(--text-2)" bg="var(--surface-2, #f5f5f5)" icon={<FileText size={16} />} />
      </div>
      )}

      {/* Tab selector */}
      <div className={s.tabBar}>
        {[['movimientos', 'Movimientos'], ['cuentas_empresa', 'Cuentas Empresa']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={activeTab === key ? s.tabBtnActive : s.tabBtn}>
            {label}
            {key === 'cuentas_empresa' && cuentasEmpresaAll.length > 0 && (
              <span className={s.tabBadge} style={{ background: '#e65100' }}>
                {cuentasEmpresaAll.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <PageToolbar panel={
        <FilterPanel open={filtrosOpen} activeCount={filtroActivos} onClear={limpiarFiltros}>
          <DateRangeFilter
            label="Período"
            desde={filtroDesde} hasta={filtroHasta} showWeek
            onChange={({ desde, hasta }) => { setFiltroDesde(desde); setFiltroHasta(hasta); setPage(1); }}
          />

          {activeTab === 'movimientos' && (
            <ChipGroup label="Tipo de movimiento"
              options={[['', 'Todos'], ['INGRESO', 'Ingreso'], ['EGRESO', 'Egreso']]}
              value={filtroTipo}
              onChange={v => { setFiltroTipo(v); setPage(1); }}
            />
          )}

          {activeTab === 'movimientos' && (
            <ChipGroup label="Método de pago"
              options={[['', 'Todos'], ['EFECTIVO', 'Efectivo'], ['TARJETA', 'Tarjeta'], ['TRANSFERENCIA', 'Transferencia'], ['YAPE', 'Yape'], ['PLIN', 'Plin']]}
              value={filtroMetodo}
              onChange={v => { setFiltroMetodo(v); setPage(1); }}
            />
          )}

          {activeTab === 'movimientos' && (
            <>
              <ChipGroup label="Tipo de cliente"
                options={[['', 'Todos'], ['SOLO_CLIENTES', 'Solo clientes'], ['SOLO_EMPRESAS', 'Solo empresas']]}
                value={filtroCliente}
                onChange={v => { setFiltroCliente(v); if (v !== 'SOLO_EMPRESAS') setFiltroEmpresaNombre(''); setPage(1); }}
              />
              {filtroCliente === 'SOLO_EMPRESAS' && empresas.length > 0 && (
                <ChipGroup label="Empresa específica"
                  options={[['', 'Todas'], ...empresas.map(e => [e.nombre, e.nombre])]}
                  value={filtroEmpresaNombre}
                  onChange={v => { setFiltroEmpresaNombre(v); setPage(1); }}
                />
              )}
            </>
          )}

          {activeTab === 'cuentas_empresa' && empresasConPendientes.length > 0 && (
            <ChipGroup label="Empresa"
              options={[['', 'Todas'], ...empresasConPendientes.map(n => [n, n])]}
              value={filtroEmpresaNombre}
              onChange={v => { setFiltroEmpresaNombre(v); setPageEmpresa(1); }}
            />
          )}

          <div style={{ maxWidth: 360 }}>
            <FilterLabel small>Buscar</FilterLabel>
            <SearchInput value={buscarNombre} onChange={v => { setBuscarNombre(v); setPage(1); }} placeholder="Concepto, cliente, usuario, habitación…" />
          </div>
        </FilterPanel>
      }>
        <PageToolbar.Row>
          <FilterToggle open={filtrosOpen} activeCount={filtroActivos} onClick={() => setFiltrosOpen(o => !o)} />
          {!filtrosOpen && filtroActivos > 0 && (
            <FilterPills items={[
              activeTab === 'movimientos' && filtroTipo && { label: filtroTipo === 'INGRESO' ? 'Ingreso' : 'Egreso', color: 'blue' },
              activeTab === 'movimientos' && filtroMetodo && { label: filtroMetodo.charAt(0) + filtroMetodo.slice(1).toLowerCase(), color: 'blue' },
              activeTab === 'movimientos' && filtroCliente === 'SOLO_CLIENTES' && { label: 'Solo clientes', color: 'blue' },
              activeTab === 'movimientos' && filtroCliente === 'SOLO_EMPRESAS' && { label: 'Solo empresas', color: 'purple' },
              filtroEmpresaNombre && { label: filtroEmpresaNombre, color: 'purple' },
              filtroDesde && { label: `Desde ${filtroDesde}`, color: 'orange' },
              filtroHasta && { label: `Hasta ${filtroHasta}`, color: 'orange' },
              buscarNombre.trim() && { label: `"${buscarNombre.trim()}"`, color: 'gray' },
            ].filter(Boolean)} />
          )}
          <PageToolbar.Actions>
            {filtroActivos > 0 && <Btn variant="ghost" onClick={limpiarFiltros}>Limpiar</Btn>}
            <Btn variant="ghost" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px' }}
              icon={sortDir === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
              {sortDir === 'desc' ? 'Más reciente' : 'Más antiguo'}
            </Btn>
            <Btn variant="ghost" icon={<Download size={14} />}
              onClick={() => {
                if (activeTab === 'cuentas_empresa') {
                  generarReporteEmpresa(cuentasEmpresaPendientes, filtroEmpresaNombre || 'Todas las empresas',
                    filtroDesde && filtroHasta ? `${filtroDesde} — ${filtroHasta}` : '');
                } else {
                  descargarReporteCajaMovimientos(movimientosFiltrados, {
                    desde: filtroDesde, hasta: filtroHasta,
                    filtroTipo,
                    filtroEmpresa: filtroEmpresaNombre || (filtroCliente === 'SOLO_EMPRESAS' ? 'empresas' : ''),
                    search: buscarNombre,
                    resumen: {
                      totalIngresos: resumenFiltrado.totalIngresos,
                      totalEgresos: resumenFiltrado.totalEgresos,
                      balance: resumenFiltrado.balance,
                      cantidadMovimientos: resumenFiltrado.cantidadMovimientos,
                    },
                  });
                }
              }}>
              Descargar PDF
            </Btn>
            {activeTab === 'cuentas_empresa' && cuentasEmpresaPendientes.length > 0 && (
              <Btn icon={<TrendingUp size={14} />}
                onClick={() => setCobrarLoteModal(true)}
                title={`Cobrar los ${cuentasEmpresaPendientes.length} pendientes visibles`}>
                Cobrar todo ({cuentasEmpresaPendientes.length})
              </Btn>
            )}
            {activeTab === 'movimientos' && <Btn variant="ghost" icon={<FileText size={14} />}
              onClick={async () => {
                const hoy = new Date().toISOString().slice(0, 10);
                let movHoy = [];
                try {
                  movHoy = await getResumenHoy();
                  if (!Array.isArray(movHoy)) movHoy = [];
                } catch (error) {
                  const msg = error?.response?.data?.message;
                  addToast(msg || 'Error al cargar movimientos de hoy', 'error');
                  return;
                }
                const totalIngresos = movHoy.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
                const totalEgresos = movHoy.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
                generarCierreCaja(movHoy, {
                  totalIngresos, totalEgresos,
                  balance: totalIngresos - totalEgresos,
                  cantidadMovimientos: movHoy.length,
                }, `Fecha: ${hoy}`);
              }}>
              Cierre de Caja
            </Btn>}
          </PageToolbar.Actions>
        </PageToolbar.Row>
      </PageToolbar>

      {activeTab === 'movimientos' && <>
      {/* Movements table */}
      <Card>
      {loading ? (
        <EmptyState message="Cargando movimientos..." icon={<DollarSign size={48} />} />
      ) : paged.length === 0 ? (
        <EmptyState message="No hay movimientos registrados" icon={<DollarSign size={48} />} />
      ) : (
        <>
          <Table headers={['Fecha', 'Tipo', 'Monto', 'Método', 'Concepto', 'Usuario', 'Cliente', '']}>
            {paged.map(m => {
              return (
              <tr key={m.id}
              >                <td style={tdStyle}>{new Date(m.fecha).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--r-sm, 4px)', fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    color: m.tipo === 'EGRESO' ? 'var(--red, #e53935)' : m.tipo === 'PENDIENTE' ? '#e65100' : 'var(--green, #43a047)',
                    background: m.tipo === 'EGRESO' ? 'var(--red-bg, #fbe9e7)' : m.tipo === 'PENDIENTE' ? '#fff3e0' : 'var(--green-bg, #e8f5e9)',
                  }}>
                    {m.tipo === 'EGRESO' ? <TrendingDown size={12} /> : m.tipo === 'PENDIENTE' ? <Clock size={12} /> : <TrendingUp size={12} />}
                    {m.tipo === 'EGRESO' ? 'Egreso' : m.tipo === 'PENDIENTE' ? 'Pendiente' : 'Ingreso'}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 700, fontSize: 14, color: 'var(--accent-dark)' }}>
                  {`S/ ${parseFloat(m.monto).toFixed(2)}`}
                </td>
                <td style={tdStyle}>
                  {m.metodoPago || '—'}
                </td>
                <td style={tdStyle}>{(m.concepto || '').substring(0, 40)}{(m.concepto || '').length > 40 ? '...' : ''}</td>
                <td style={tdStyle}>{m.nombreUsuario || '—'}</td>
                <td style={tdStyle}>
                  {m.nombreCliente || '—'}
                  {m.nombreEmpresa && m.nombreEmpresa !== '—' && (
                    <div className={s.empresaSub}>{m.nombreEmpresa}</div>
                  )}
                </td>
                <td style={tdStyle}>
                  <Btn variant="ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setEditMontoModal(m)}
                    icon={<Pencil size={12} />}
                    title="Editar monto y método de pago">
                    Editar
                  </Btn>
                </td>
              </tr>
              );
            })}
          </Table>
          <div className={s.paginationWrap}>
            <Pagination page={page} total={movimientosFiltrados.length} perPage={PER_PAGE} onChange={setPage} />
          </div>
        </>
      )}
      </Card>
      </> /* end movimientos tab */}

      {activeTab === 'cuentas_empresa' && (
        <>
          <Card>
            {loading ? (
              <EmptyState message="Cargando..." icon={<DollarSign size={48} />} />
            ) : cuentasEmpresaPendientes.length === 0 ? (
              <EmptyState message="No hay cuentas pendientes de empresas" icon={<Clock size={48} />} />
            ) : (
              <>
              <Table headers={['Fecha checkout', 'Empresa', 'Cliente', 'Habitación', 'Monto', '']}>
                {cuentasEmpresaPendientes.slice((pageEmpresa - 1) * PER_PAGE, pageEmpresa * PER_PAGE).map(m => (
                  <tr key={m.id}
                  >
                    <td style={tdStyle}>{new Date(m.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{m.nombreEmpresa || '—'}</td>
                    <td style={tdStyle}>{m.nombreCliente || '—'}</td>
                    <td style={tdStyle}>{m.numeroHabitacion || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#e65100' }}>
                      S/ {parseFloat(m.monto).toFixed(2)}
                    </td>
                    <td style={tdStyle}>
                      <div className={s.actionRow}>
                        <Btn variant="ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                          icon={<ClipboardList size={12} />}
                          onClick={() => {
                            if (!m.alquilerId) { addToast('Este movimiento no tiene alquiler asociado', 'error'); return; }
                            setGestionarModal(m);
                          }}
                          title="Ver consumos y asignar precios">
                          Gestionar
                        </Btn>
                        <Btn style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => setCobrarModal(m)}>
                          Cobrar
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
              <div className={s.paginationWrap}>
                <Pagination page={pageEmpresa} total={cuentasEmpresaPendientes.length} perPage={PER_PAGE} onChange={setPageEmpresa} />
              </div>
              </>
            )}
          </Card>
        </>
      )}

      {/* ─── Modales extraídos ─── */}
      <GestionarCuentaModal
        movimiento={gestionarModal}
        onClose={() => setGestionarModal(null)}
        onSuccess={fetchResumen}
        onCobrar={(mov) => setCobrarModal(mov)}
      />
      <MovimientoFormModal open={modalOpen} tipo={modalTipo} onClose={() => setModalOpen(false)} onSuccess={fetchResumen} />
      <EditMontoModal movimiento={editMontoModal} onClose={() => setEditMontoModal(null)} onSuccess={fetchResumen} />
      <CobrarModal movimiento={cobrarModal} onClose={() => setCobrarModal(null)} onSuccess={fetchResumen} />
      <CobrarLoteModal
        open={cobrarLoteModal}
        onClose={() => setCobrarLoteModal(false)}
        onSuccess={fetchResumen}
        pendientes={cuentasEmpresaPendientes}
        totalPendiente={totalPendienteEmpresas}
        filtroEmpresaNombre={filtroEmpresaNombre}
      />
      <DeleteConfirmModal
          open={deleteModal}
          onClose={() => setDeleteModal(false)}
          onSuccess={fetchResumen}
          title="⚠️ Limpiar movimientos de caja"
          warningText='Los registros eliminados <strong>no se pueden recuperar</strong>. Revisá el resumen antes de confirmar.'
          todoDesc="Borra todos los ingresos, egresos y cuentas pendientes"
          emptyMessage="No hay movimientos en ese período."
          previewFn={previewDeleteMovimientos}
          deleteFn={deleteMovimientos}
          entityName="movimiento(s)"
          radioName="deleteModeCaja"
          renderPreviewExtra={(p) => (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total ingresos</div>
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--green, #43a047)' }}>S/ {Number(p.totalIngresos).toFixed(2)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total egresos</div>
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--red, #e53935)' }}>S/ {Number(p.totalEgresos).toFixed(2)}</div>
            </>
          )}
        />
    </div>
  );
}

function SummaryCard({ label, value, color, bg, icon, isCount }) {
  return (
    <div className={s.summaryCard} style={{ color, background: bg }}>
      <span style={{ display: 'flex' }}>{icon}</span>
      <div>
        <div className={s.summaryLabel}>{label}</div>
        <div className={s.summaryValue}>
          {isCount ? value : `S/ ${value.toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}