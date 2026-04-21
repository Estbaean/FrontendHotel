import { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useAuth } from '../../context/AuthContext';
import { Table, Btn, Card, EmptyState, Pagination, tdStyle, PageHeader, SearchInput } from '../../components/UI/index.jsx';
import { ClipboardList, LogOut, Trash2, Download, FileText, ArrowDown, ArrowUp, DollarSign, TrendingUp, CheckCircle, Calendar } from 'lucide-react';
import { descargarReporteAlquileresActivos, generarRegistroAsistencia, descargarReporteFinalizados } from '../../utils/reportesPdf';
import { esAlquilerEmpresa, puedeVerMontos } from '../../utils/formHelpers';
import { FilterToggle, FilterPanel, FilterPills, FilterLabel, DateRangeFilter, ChipGroup } from '../../components/Filters';
import PageToolbar from '../../components/PageToolbar';
import CheckoutModal from '../../components/CheckoutModal';
import CuentaAlquilerModal from './CuentaAlquilerModal';
import EditFechaSalidaModal from './EditFechaSalidaModal';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { previewDeleteHistorial, deleteHistorial } from '../../api/alquileres';
import s from '../../styles/shared.module.css';

const PER_PAGE = 12;

export default function Alquileres() {
  const { userRole } = useAuth();
  const { alquileres, checkOut, refreshAlquiler, refetchAlquileres, empresas } = useHotel();
  const isAdmin = userRole === 'admin';

  const [tab, setTab] = useState('ACTIVO'); // 'ACTIVO' | 'FINALIZADO'
  const [page, setPage] = useState(1);
  const [checkOutModal, setCheckOutModal] = useState(null);
  const [cuentaModal, setCuentaModal] = useState(null);
  const [editFechaModal, setEditFechaModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);

  const [searchAlq, setSearchAlq] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEmpresaNombre, setFiltroEmpresaNombre] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');

  const filtroActivos = [filtroCliente, filtroEmpresaNombre, filtroFechaDesde, filtroFechaHasta, searchAlq.trim()].filter(Boolean).length;
  const limpiarFiltrosAlq = () => { setFiltroCliente(''); setFiltroEmpresaNombre(''); setFiltroFechaDesde(''); setFiltroFechaHasta(''); setSearchAlq(''); setPage(1); };

  const filtered = useMemo(() => {
    let result = alquileres.filter(a => a.estadoAlquiler === tab);
    if (filtroCliente === 'SOLO_CLIENTES') result = result.filter(a => !esAlquilerEmpresa(a));
    if (filtroCliente === 'SOLO_EMPRESAS') result = result.filter(a => esAlquilerEmpresa(a));
    if (filtroEmpresaNombre) result = result.filter(a => a.empresaNombre === filtroEmpresaNombre);
    if (filtroFechaDesde) result = result.filter(a => a.fechaIngreso?.slice(0, 10) >= filtroFechaDesde);
    if (filtroFechaHasta) result = result.filter(a => a.fechaIngreso?.slice(0, 10) <= filtroFechaHasta);
    if (searchAlq.trim()) {
      const q = searchAlq.toLowerCase();
      result = result.filter(a =>
        a.nombreCliente?.toLowerCase().includes(q) ||
        String(a.numeroHabitacion).includes(q) ||
        a.empresaNombre?.toLowerCase().includes(q) ||
        a.tipoAlquilerNombre?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [alquileres, tab, filtroCliente, filtroEmpresaNombre, filtroFechaDesde, filtroFechaHasta, searchAlq]);

  const filteredSorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.fechaIngreso).getTime();
      const tb = new Date(b.fechaIngreso).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
  }, [filtered, sortDir]);

  const paged = filteredSorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleTabChange = (t) => { setTab(t); setPage(1); };

  const alquilerHeaders = ['Hab.', 'Cliente', 'Tipo', 'Ingreso', tab === 'FINALIZADO' ? 'Salida Real' : 'Salida Prev.', 'Saldo', ''];

  // Dashboard stats (reactive to filtered data)
  const activos = alquileres.filter(a => a.estadoAlquiler === 'ACTIVO');
  const finalizados = alquileres.filter(a => a.estadoAlquiler === 'FINALIZADO');
  const pendienteTotal = activos.reduce((sum, a) => {
    if (!isAdmin && esAlquilerEmpresa(a)) return sum;
    return sum + (parseFloat(a.pagoPendiente) || 0);
  }, 0);
  const filteredCount = filtered.length;


  return (
    <div className="page-anim">
      <PageHeader title="Alquileres" subtitle={`Rentas activas e historial · ${filteredCount}`}>
        {isAdmin && tab === 'FINALIZADO' && finalizados.length > 0 && (
          <Btn
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={() => setDeleteModal(true)}
            title="Eliminar permanentemente alquileres finalizados"
          >
            Limpiar Historial
          </Btn>
        )}
      </PageHeader>

      {/* Summary Cards — per tab */}
      {tab === 'ACTIVO' && (
      <div className={s.summaryGrid}>
        <AlquilerSummaryCard label="Activos" value={activos.length} isCount color="var(--green, #43a047)" bg="var(--green-bg, #e8f5e9)" icon={<TrendingUp size={16} />} />
        {isAdmin && <AlquilerSummaryCard label="Pendiente" value={pendienteTotal} color={pendienteTotal > 0 ? 'var(--red, #e53935)' : 'var(--green, #43a047)'} bg={pendienteTotal > 0 ? 'var(--red-bg, #fbe9e7)' : 'var(--green-bg, #e8f5e9)'} icon={<DollarSign size={16} />} />}
        <AlquilerSummaryCard label="Mostrando" value={filteredCount} isCount color="var(--text-2)" bg="var(--surface-2, #f5f5f5)" icon={<FileText size={16} />} />
      </div>
      )}
      {tab === 'FINALIZADO' && (
      <div className={s.summaryGrid}>
        <AlquilerSummaryCard label="Finalizados" value={finalizados.length} isCount color="var(--text-2)" bg="var(--surface-2, #f5f5f5)" icon={<CheckCircle size={16} />} />
        <AlquilerSummaryCard label="Mostrando" value={filteredCount} isCount color="var(--accent, #1976d2)" bg="var(--accent-light, #e3f2fd)" icon={<FileText size={16} />} />
      </div>
      )}

      {/* Tab selector */}
      <div className={s.tabBar}>
        <button onClick={() => handleTabChange('ACTIVO')} className={tab === 'ACTIVO' ? s.tabBtnActive : s.tabBtn}>
          Activos
          <span className={s.tabBadge} style={{ background: 'var(--green, #43a047)' }}>
            {activos.length}
          </span>
        </button>
        {isAdmin && (
          <button onClick={() => handleTabChange('FINALIZADO')} className={tab === 'FINALIZADO' ? s.tabBtnActive : s.tabBtn}>
            Finalizados
            {finalizados.length > 0 && (
              <span className={s.tabBadge} style={{ background: 'var(--text-muted)' }}>
                {finalizados.length}
              </span>
            )}
          </button>
        )}
      </div>

      <PageToolbar panel={
        <FilterPanel open={filtrosOpen} activeCount={filtroActivos} onClear={limpiarFiltrosAlq}>
          <DateRangeFilter
            label="Período de ingreso"
            desde={filtroFechaDesde} hasta={filtroFechaHasta}
            onChange={({ desde, hasta }) => { setFiltroFechaDesde(desde); setFiltroFechaHasta(hasta); setPage(1); }}
          />

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

          <div style={{ maxWidth: 360 }}>
            <FilterLabel small>Buscar</FilterLabel>
            <SearchInput value={searchAlq} onChange={v => { setSearchAlq(v); setPage(1); }} placeholder="Cliente, habitación, empresa, tipo…" />
          </div>
        </FilterPanel>
      }>
        <PageToolbar.Row>
          <FilterToggle open={filtrosOpen} activeCount={filtroActivos} onClick={() => setFiltrosOpen(o => !o)} />
          {!filtrosOpen && filtroActivos > 0 && (
            <FilterPills items={[
              filtroCliente === 'SOLO_CLIENTES' && { label: 'Solo clientes', color: 'blue' },
              filtroCliente === 'SOLO_EMPRESAS' && { label: 'Solo empresas', color: 'purple' },
              filtroEmpresaNombre && { label: filtroEmpresaNombre, color: 'purple' },
              filtroFechaDesde && { label: `Desde ${filtroFechaDesde}`, color: 'orange' },
              filtroFechaHasta && { label: `Hasta ${filtroFechaHasta}`, color: 'orange' },
              searchAlq.trim() && { label: `"${searchAlq.trim()}"`, color: 'gray' },
            ].filter(Boolean)} />
          )}
          <PageToolbar.Actions>
            {filtroActivos > 0 && <Btn variant="ghost" onClick={limpiarFiltrosAlq}>Limpiar</Btn>}
            <Btn variant="ghost" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', whiteSpace: 'nowrap' }}
              icon={sortDir === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
              {sortDir === 'desc' ? 'Más reciente' : 'Más antiguo'}
            </Btn>
            {tab === 'ACTIVO' && filteredSorted.length > 0 && (
              <Btn variant="ghost" icon={<FileText size={14} />}
                onClick={() => generarRegistroAsistencia(filteredSorted, filtroEmpresaNombre || null, new Date().toLocaleDateString('es-PE'))}>
                Asistencia PDF
              </Btn>
            )}
            {tab === 'ACTIVO' && (
              <Btn variant="ghost" icon={<Download size={14} />} onClick={() => descargarReporteAlquileresActivos(filteredSorted)}>
                Activos PDF
              </Btn>
            )}
            {tab === 'FINALIZADO' && filteredSorted.length > 0 && (
              <Btn variant="ghost" icon={<Download size={14} />} onClick={() => descargarReporteFinalizados(filteredSorted, {
                desde: filtroFechaDesde || undefined,
                hasta: filtroFechaHasta || undefined,
                empresa: filtroEmpresaNombre || undefined,
                condicion: filtroCliente || undefined,
                search: searchAlq.trim() || undefined,
              })}>
                Finalizados PDF
              </Btn>
            )}
          </PageToolbar.Actions>
        </PageToolbar.Row>
      </PageToolbar>

      {paged.length === 0 ? (
        <EmptyState message={tab === 'ACTIVO' ? 'No hay alquileres activos' : 'Sin historial'} icon={<ClipboardList size={48} />} />
      ) : (
        <Card key={`alquileres-table-${tab}-${alquileres.length}-${Date.now()}`} padding="0 16px 4px">
          <Table headers={alquilerHeaders}>
            {paged.map(a => (
              <tr key={a.id}>{(() => {
                  const esEmpresa = esAlquilerEmpresa(a);
                  return (
                    <>
                <td style={tdStyle}>
                  <span className={s.badgeAccent}>
                    {a.numeroHabitacion}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {a.nombreCliente}
                  {a.empresaNombre && a.empresaNombre !== '—' && (
                    <div className={s.empresaSub}>{a.empresaNombre}</div>
                  )}
                  {a.huespedes && a.huespedes.length > 1 && (
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                      +{a.huespedes.length - 1} huésped(es):{' '}
                      {a.huespedes.filter(h => h !== a.nombreCliente).join(', ')}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  <span className={s.badgeMuted}>
                    {a.tipoAlquilerNombre || '—'}
                  </span>
                </td>
                <td style={tdStyle}>{formatDate(a.fechaIngreso)}</td>
                <td style={tdStyle}>{formatDate(tab === 'FINALIZADO' ? (a.fechaSalida || a.fechaPrevista) : a.fechaPrevista)}</td>
                <td style={tdStyle}>
                  {puedeVerMontos(isAdmin, esEmpresa) ? (
                    (() => {
                      const saldo = parseFloat(a.pagoPendiente || 0);
                      
                      // Caso 1: Saldo a favor (Negativo)
                      if (saldo < -0.01) {
                        return (
                          <span style={{ color: 'var(--blue, #2563eb)', fontWeight: 700 }}>
                            Vuelto: S/ {Math.abs(saldo).toFixed(2)}
                          </span>
                        );
                      }
                      
                      // Caso 2: Deuda pendiente (Positivo)
                      if (saldo > 0.01) {
                        return (
                          <span className={s.amountNegative} style={{ fontWeight: 700 }}>
                            S/ {saldo.toFixed(2)}
                          </span>
                        );
                      }
                      
                      // Caso 3: Pagado (Cero)
                      return (
                        <span className={s.amountPositive} style={{ fontWeight: 600 }}>
                          S/ 0.00
                        </span>
                      );
                    })()
                  ) : (
                    <span style={{ cursor: 'help' }} title="Monto empresa — visible solo para administradores">
                      —
                    </span>
                  )}
                </td>

                <td style={tdStyle}>
                  <div className={s.actionRow}>
                    <Btn variant="ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setCuentaModal(a)}
                      icon={<ClipboardList size={13} />}>
                      Gestionar
                    </Btn>
                    {isAdmin && (a.estadoAlquiler === 'ACTIVO' || a.estadoAlquiler === 'FINALIZADO') && (
                      <Btn variant="secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setEditFechaModal(a)}
                        icon={<Calendar size={13} />}>
                        Editar fecha
                      </Btn>
                    )}
                    {a.estadoAlquiler === 'ACTIVO' && (
                      <Btn variant="danger" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setCheckOutModal(a)}
                        icon={<LogOut size={13} />}>
                        Check-out
                      </Btn>
                    )}
                  </div>
                </td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </Table>
          <div className={s.paginationWrap}>
            <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
          </div>
        </Card>
      )}

      <CheckoutModal alquiler={checkOutModal} onClose={() => setCheckOutModal(null)} checkOut={checkOut} isAdmin={isAdmin} />
<CuentaAlquilerModal 
  alquiler={cuentaModal} 
  onClose={() => setCuentaModal(null)} 
  isAdmin={isAdmin} 
  refreshAlquiler={refreshAlquiler}
  refetchAlquileres={refetchAlquileres}
/>
<EditFechaSalidaModal 
  alquiler={editFechaModal} 
  onClose={() => setEditFechaModal(null)} 
  onSuccess={(updated) => {
    refreshAlquiler(updated.id);
    refetchAlquileres();
  }}
  refetchAlquileres={refetchAlquileres}
/>
      <DeleteConfirmModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        onSuccess={refetchAlquileres}
        title="Eliminar Historial de Alquileres"
        warningText='Los alquileres eliminados <strong>no se pueden recuperar</strong>. Los movimientos de caja asociados perderán su referencia al alquiler.'
        todoDesc="Borra todos los alquileres finalizados"
        emptyMessage="No hay alquileres finalizados en ese período."
        previewFn={previewDeleteHistorial}
        deleteFn={deleteHistorial}
        entityName="alquiler(es)"
        radioName="deleteModeAlq"
      />

    </div >
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function AlquilerSummaryCard({ label, value, color, bg, icon, isCount }) {
  return (
    <div className={s.summaryCard} style={{ color, background: bg }}>
      <span style={{ display: 'flex' }}>{icon}</span>
      <div>
        <div className={s.summaryLabel}>{label}</div>
        <div className={s.summaryValue}>{isCount ? value : `S/ ${Number(value).toFixed(2)}`}</div>
      </div>
    </div>
  );
}
