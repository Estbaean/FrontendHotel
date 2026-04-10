import { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Table, Btn, Card, EmptyState, Pagination, Modal, Field, inputStyle, tdStyle, PageHeader, TabBtn, SearchInput, useToast } from '../../components/UI/index.jsx';
import { ClipboardList, LogOut, Plus, Trash2, Check, Download, FileText, ArrowDown, ArrowUp, Filter, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { getCuentasByAlquiler, postCuenta, putCuenta, deleteCuenta } from '../../api/consumos';
import { getMovimientosPorAlquiler } from '../../api/caja';
import { patchAlquilerMontos, previewDeleteHistorial, deleteHistorial } from '../../api/alquileres';
import { descargarReporteAlquileresActivos, generarBoletaCheckout, generarRegistroAsistencia } from '../../utils/reportesPdf';
import { esAlquilerEmpresa, puedeVerMontos, METODOS_PAGO } from '../../utils/formHelpers';
import { chipStyle, quickDateBtn } from '../../constants/filterStyles';

const PER_PAGE = 12;

export default function Alquileres() {
  const { alquileres, checkOut, refreshAlquiler, refetchAlquileres, userRole, empresas } = useHotel();
  const isAdmin = userRole === 'admin';
  const addToast = useToast();

  const [tab, setTab] = useState('ACTIVO'); // 'ACTIVO' | 'FINALIZADO'
  const [page, setPage] = useState(1);
  const [checkOutModal, setCheckOutModal] = useState(null); // alquiler object or null
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Checkout detail state
  const [checkoutCuentaItems, setCheckoutCuentaItems] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Cuenta (consumos) state
  const [cuentaModal, setCuentaModal] = useState(null); // alquiler object or null
  const [cuentaItems, setCuentaItems] = useState([]); // CuentaAlquilerDTO[]
  const [newConsumo, setNewConsumo] = useState({ descripcion: '', precioUnit: '', cantidad: 1 });
  const [pagoConsumoModal, setPagoConsumoModal] = useState(null); // CuentaAlquilerDTO | null
  const [pagoConsumoMetodo, setPagoConsumoMetodo] = useState('EFECTIVO');
  const [editPopover, setEditPopover] = useState(null); // { id, descripcion, precioUnit, cantidad }
  const [cuentaMovimientos, setCuentaMovimientos] = useState([]); // MovimientoCajaResponseDTO[]
  const [editBasePrice, setEditBasePrice] = useState(null);

  // Delete historial state (admin only)
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteMode, setDeleteMode] = useState('todo');
  const [deleteDesde, setDeleteDesde] = useState('');
  const [deleteHasta, setDeleteHasta] = useState('');
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const DELETE_KEYWORD = deleteMode === 'todo' ? 'ELIMINAR TODO' : 'ELIMINAR RANGO';

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

  const handleDeletePreview = async () => {
    if (deleteMode === 'rango' && (!deleteDesde || !deleteHasta)) {
      addToast('Seleccioná ambas fechas para el rango.', 'error');
      return;
    }
    setDeletePreviewLoading(true);
    try {
      const preview = deleteMode === 'rango'
        ? await previewDeleteHistorial(deleteDesde, deleteHasta)
        : await previewDeleteHistorial();
      if (preview.cantidad === 0) {
        addToast('No hay alquileres finalizados en ese período.', 'warning');
        return;
      }
      setDeletePreview(preview);
      setDeleteConfirmText('');
      setDeleteStep(2);
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al obtener preview.', 'error');
    } finally {
      setDeletePreviewLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== DELETE_KEYWORD) return;
    setDeleteSubmitting(true);
    try {
      const result = deleteMode === 'rango'
        ? await deleteHistorial(deleteDesde, deleteHasta)
        : await deleteHistorial();
      addToast(`${result.eliminados} alquiler(es) eliminado(s).`, 'info');
      setDeleteModal(false);
      await refetchAlquileres();
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al eliminar el historial.', 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openCheckout = async (a) => {
    setCheckOutModal(a);
    setMetodoPago('EFECTIVO');
    setCheckoutCuentaItems([]);
    setCheckoutLoading(true);
    try {
      const items = await getCuentasByAlquiler(a.id);
      setCheckoutCuentaItems(items.filter(c => c.estado === 'PENDIENTE'));
    } catch { /* show empty list */ } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!checkOutModal || isCheckingOut) return;
    const currentCheckout = checkOutModal;
    setIsCheckingOut(true);
    try {
      const esEmpresa = esAlquilerEmpresa(currentCheckout);
      await checkOut(currentCheckout.id, esEmpresa ? undefined : metodoPago);
      addToast('Check-out realizado con éxito', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al realizar check-out', 'error');
    } finally {
      setIsCheckingOut(false);
      setCheckOutModal(null);
      setCheckoutCuentaItems([]);
    }
  };

  // Open cuenta modal — try API, fallback to mock
  const openCuenta = async (alquiler) => {
    setCuentaModal(alquiler);
    setNewConsumo({ descripcion: '', precioUnit: '', cantidad: 1 });
    setEditPopover(null);
    setPagoConsumoModal(null);
    setPagoConsumoMetodo('EFECTIVO');
    setCuentaMovimientos([]);
    setEditBasePrice(null);
    const [cuentasResult, movsResult] = await Promise.allSettled([
      getCuentasByAlquiler(alquiler.id),
      getMovimientosPorAlquiler(alquiler.id),
    ]);
    setCuentaItems(cuentasResult.status === 'fulfilled' ? cuentasResult.value : []);
    setCuentaMovimientos(movsResult.status === 'fulfilled' ? movsResult.value : []);
  };

  const generarBoleta = async (alquiler) => {
    try {
      const [cuentasRes, movsRes] = await Promise.allSettled([
        getCuentasByAlquiler(alquiler.id),
        getMovimientosPorAlquiler(alquiler.id),
      ]);
      generarBoletaCheckout(
        alquiler,
        cuentasRes.status === 'fulfilled' ? cuentasRes.value : [],
        movsRes.status === 'fulfilled' ? movsRes.value : [],
        { isAdmin },
      );
      addToast('Boleta generada', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al generar boleta', 'error');
    }
  };

  const addConsumo = async () => {
    const { descripcion, precioUnit, cantidad } = newConsumo;
    if (!descripcion.trim() || cantidad < 1) return;
    const alquilerEsEmpresa = esAlquilerEmpresa(cuentaModal);
    const puedeEditarPrecioUnit = puedeVerMontos(isAdmin, alquilerEsEmpresa);
    const precio = puedeEditarPrecioUnit ? parseFloat(precioUnit || '0') : 0;
    const payload = { descripcion: descripcion.trim(), precioUnit: precio, cantidad: Number(cantidad), estado: 'PENDIENTE' };

    // Add new consumo
    try {
      const saved = await postCuenta(cuentaModal.id, payload);
      setCuentaItems(prev => [...prev, saved]);
      const updatedAlquiler = await refreshAlquiler(cuentaModal.id);
      if (updatedAlquiler) {
        setCuentaModal(prev => prev ? { ...prev, pagoPendiente: updatedAlquiler.pagoPendiente, totalPagadoCaja: updatedAlquiler.totalPagadoCaja } : prev);
      } else {
        setCuentaModal(prev => prev ? { ...prev, pagoPendiente: parseFloat(prev.pagoPendiente) + saved.subTotal } : prev);
      }
      addToast('Consumo agregado', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al agregar consumo', 'error');
    }
    setNewConsumo({ descripcion: '', precioUnit: '', cantidad: 1 });
  };

  const saveEditConsumo = async () => {
    if (!editPopover) return;
    if (!isAdmin) return;
    const { id, precioUnit } = editPopover;
    const precio = parseFloat(precioUnit);
    if (isNaN(precio) || precio < 0) { setEditPopover(null); return; }

    const currentItem = cuentaItems.find(c => c.id === id);
    if (!currentItem) { setEditPopover(null); return; }
    const payload = {
      descripcion: currentItem.descripcion,
      precioUnit: precio,
      cantidad: currentItem.cantidad,
      estado: currentItem.estado,
    };

    setEditPopover(null);
    try {
      const updated = await putCuenta(cuentaModal.id, id, payload);
      setCuentaItems(prev => prev.map(c => c.id === id ? updated : c));
      const updatedAlquiler = await refreshAlquiler(cuentaModal.id);
      if (updatedAlquiler) {
        setCuentaModal(prev => prev ? { ...prev, pagoPendiente: updatedAlquiler.pagoPendiente, totalPagadoCaja: updatedAlquiler.totalPagadoCaja } : prev);
      }
      addToast('Precio actualizado', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al actualizar precio', 'error');
    }
  };

  const removeConsumo = async (id) => {
    if (!cuentaModal?.id) return;
    try {
      await deleteCuenta(cuentaModal.id, id);
      const refreshedItems = await getCuentasByAlquiler(cuentaModal.id);
      setCuentaItems(refreshedItems);

      const updatedAlquiler = await refreshAlquiler(cuentaModal.id);
      if (updatedAlquiler) {
        setCuentaModal((prev) => (prev ? { ...prev, pagoPendiente: updatedAlquiler.pagoPendiente, totalPagadoCaja: updatedAlquiler.totalPagadoCaja } : prev));
      }

      if (editPopover?.id === id) setEditPopover(null);
      addToast('Consumo eliminado', 'info');
      getMovimientosPorAlquiler(cuentaModal.id).then(setCuentaMovimientos).catch(() => { });
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      addToast(backendMessage || 'No se pudo eliminar el consumo', 'error');
    }
  };

  const startEditConsumo = (c) => {
    setEditPopover((prev) => {
      if (prev?.id === c.id) return null;
      return { id: c.id, precioUnit: String(c.precioUnit) };
    });
  };

  const openPagoConsumoModal = (c) => {
    setPagoConsumoModal(c);
    setPagoConsumoMetodo('EFECTIVO');
  };

  const markConsumoAsPaid = async (c, metodoPago = 'EFECTIVO') => {
    try {
      const updated = await putCuenta(cuentaModal.id, c.id, {
        descripcion: c.descripcion, precioUnit: c.precioUnit, cantidad: c.cantidad, estado: 'PAGADO',
      }, metodoPago);
      setCuentaItems(prev => prev.map(x => x.id === c.id ? updated : x));
      const updatedAlquiler = await refreshAlquiler(cuentaModal.id);
      if (updatedAlquiler) {
        setCuentaModal(prev => prev ? { ...prev, pagoPendiente: updatedAlquiler.pagoPendiente, totalPagadoCaja: updatedAlquiler.totalPagadoCaja } : prev);
      } else {
        setCuentaModal(prev => prev ? { ...prev, pagoPendiente: Math.max(0, parseFloat(prev.pagoPendiente) - c.subTotal) } : prev);
      }
      setPagoConsumoModal(null);
      addToast('Consumo marcado como pagado', 'success');
      getMovimientosPorAlquiler(cuentaModal.id).then(setCuentaMovimientos).catch(() => { });
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      addToast(backendMessage || 'No se pudo marcar el consumo como pagado', 'error');
    }
  };

  const saveBasePrice = async () => {
    if (!cuentaModal || editBasePrice === null) return;
    if (!isAdmin) return;
    const subTotal = parseFloat(editBasePrice);
    if (isNaN(subTotal) || subTotal < 0) { setEditBasePrice(null); return; }
    const totalConsumos = cuentaItems.reduce((sum, c) => sum + c.subTotal, 0);
    const totalPagadoCaja = parseFloat(cuentaModal.totalPagadoCaja || 0);
    const pagoPendiente = Math.max(0, subTotal + totalConsumos - totalPagadoCaja);
    setEditBasePrice(null);
    try {
      await patchAlquilerMontos(cuentaModal.id, { subTotal, pagoPendiente });
      await refreshAlquiler(cuentaModal.id);
      setCuentaModal(prev => prev ? { ...prev, subTotal, pagoPendiente } : prev);
      addToast('Precio base actualizado', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al actualizar', 'error');
    }
  };

  const alquilerHeaders = ['Hab.', 'Cliente', 'Tipo', 'Ingreso', tab === 'FINALIZADO' ? 'Salida Real' : 'Salida Prev.', 'Saldo', ''];

  // Dashboard stats
  const activos = alquileres.filter(a => a.estadoAlquiler === 'ACTIVO');
  const finalizados = alquileres.filter(a => a.estadoAlquiler === 'FINALIZADO');
  const pendienteTotal = activos.reduce((sum, a) => {
    if (!isAdmin && esAlquilerEmpresa(a)) return sum;
    return sum + (parseFloat(a.pagoPendiente) || 0);
  }, 0);

  const statCards = [
    { label: 'ACTIVOS', value: activos.length, color: 'var(--green)', dot: 'var(--green)', bg: 'var(--green-bg)', tab: 'ACTIVO' },
    ...(isAdmin ? [
      { label: 'PENDIENTE', value: `S/ ${pendienteTotal.toFixed(2)}`, color: pendienteTotal > 0 ? 'var(--red)' : 'var(--green)', dot: pendienteTotal > 0 ? 'var(--red)' : 'var(--green)', bg: pendienteTotal > 0 ? 'var(--red-bg)' : 'var(--green-bg)' },
      { label: 'FINALIZADOS', value: finalizados.length, color: 'var(--text-muted)', dot: 'var(--text-muted)', bg: 'var(--surface-2)', tab: 'FINALIZADO' },
    ] : []),
  ];


  return (
    <div className="page-anim">
      <PageHeader title="Alquileres" subtitle={`Rentas activas e historial · ${filtered.length}`}>
        {isAdmin && tab === 'FINALIZADO' && finalizados.length > 0 && (
          <Btn
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={() => { setDeleteStep(1); setDeleteMode('todo'); setDeleteDesde(''); setDeleteHasta(''); setDeletePreview(null); setDeleteConfirmText(''); setDeleteModal(true); }}
            title="Eliminar permanentemente alquileres finalizados"
          >
            Limpiar Historial
          </Btn>
        )}
      </PageHeader>

      {/* Dashboard stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {statCards.map(s => (
          <button
            key={s.label}
            onClick={() => s.tab && handleTabChange(s.tab)}
            style={{
              position: 'relative',
              padding: '10px 18px',
              background: s.tab && tab === s.tab ? `linear-gradient(135deg, ${s.dot}15, ${s.dot}08)` : 'var(--surface)',
              border: `1.5px solid ${s.tab && tab === s.tab ? s.dot : 'var(--border)'}`,
              borderRadius: 24,
              cursor: s.tab ? 'pointer' : 'default',
              transition: 'all .2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              outline: 'none',
            }}
            onMouseEnter={e => {
              if (s.tab) {
                e.currentTarget.style.borderColor = s.dot;
                e.currentTarget.style.background = `linear-gradient(135deg, ${s.dot}25, ${s.dot}12)`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={e => {
              if (s.tab) {
                e.currentTarget.style.borderColor = tab === s.tab ? s.dot : 'var(--border)';
                e.currentTarget.style.background = tab === s.tab ? `linear-gradient(135deg, ${s.dot}15, ${s.dot}08)` : 'var(--surface)';
                e.currentTarget.style.transform = '';
              }
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.3px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {s.label}
            </span>
          </button>
        ))}
      </div>

      <Card padding="12px 16px" style={{ marginBottom: 18 }}>
        {/* Toolbar row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <TabBtn active={tab === 'ACTIVO'} onClick={() => handleTabChange('ACTIVO')} label="Activos" count={alquileres.filter(a => a.estadoAlquiler === 'ACTIVO').length} />
            {isAdmin && (
              <TabBtn active={tab === 'FINALIZADO'} onClick={() => handleTabChange('FINALIZADO')} label="Finalizados" count={alquileres.filter(a => a.estadoAlquiler === 'FINALIZADO').length} />
            )}
          </div>
          <button
            onClick={() => setFiltrosOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: `1.5px solid ${filtroActivos > 0 ? 'var(--accent)' : 'var(--border)'}`,
              background: filtroActivos > 0 ? 'var(--accent-light,#e3f2fd)' : 'var(--surface)',
              color: filtroActivos > 0 ? 'var(--accent)' : 'var(--text)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <Filter size={14} />
            Filtros
            {filtroActivos > 0 && (
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{filtroActivos}</span>
            )}
            {filtrosOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {/* Active filter pills (when panel is closed) */}
          {!filtrosOpen && filtroActivos > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
              {filtroCliente === 'SOLO_CLIENTES' && <span style={{ background: '#e3f2fd', color: '#1565c0', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>Solo clientes</span>}
              {filtroCliente === 'SOLO_EMPRESAS' && <span style={{ background: '#f3e5f5', color: '#7b1fa2', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>Solo empresas</span>}
              {filtroEmpresaNombre && <span style={{ background: '#f3e5f5', color: '#7b1fa2', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{filtroEmpresaNombre}</span>}
              {filtroFechaDesde && <span style={{ background: '#fff3e0', color: '#e65100', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>Desde {filtroFechaDesde}</span>}
              {filtroFechaHasta && <span style={{ background: '#fff3e0', color: '#e65100', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>Hasta {filtroFechaHasta}</span>}
              {searchAlq.trim() && <span style={{ background: 'var(--surface-2,#f5f5f5)', color: 'var(--text-2)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>&#34;{searchAlq.trim()}&#34;</span>}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
                Descargar PDF
              </Btn>
            )}
          </div>
        </div>

        {/* Collapsible filter panel */}
        {filtrosOpen && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Período de ingreso */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text-xmuted)', display: 'block', marginBottom: 8 }}>Período de ingreso</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Desde</span>
                  <input type="date" style={{ ...inputStyle, width: 150 }} value={filtroFechaDesde} onChange={e => { setFiltroFechaDesde(e.target.value); setPage(1); }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Hasta</span>
                  <input type="date" style={{ ...inputStyle, width: 150 }} value={filtroFechaHasta} onChange={e => { setFiltroFechaHasta(e.target.value); setPage(1); }} />
                </div>
                <button onClick={() => { const h = new Date().toISOString().slice(0, 10); setFiltroFechaDesde(h); setFiltroFechaHasta(h); setPage(1); }} style={quickDateBtn}>Hoy</button>
                <button onClick={() => {
                  const h = new Date(); const y = h.getFullYear(); const m = h.getMonth();
                  setFiltroFechaDesde(`${y}-${String(m + 1).padStart(2, '0')}-01`);
                  setFiltroFechaHasta(new Date(y, m + 1, 0).toISOString().slice(0, 10)); setPage(1);
                }} style={quickDateBtn}>Este mes</button>
                {(filtroFechaDesde || filtroFechaHasta) && <button onClick={() => { setFiltroFechaDesde(''); setFiltroFechaHasta(''); setPage(1); }} style={{ ...quickDateBtn, color: 'var(--red,#e53935)' }}>× Limpiar</button>}
              </div>
            </div>

            {/* Tipo de cliente */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text-xmuted)', display: 'block', marginBottom: 8 }}>Tipo de cliente</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['', 'Todos'], ['SOLO_CLIENTES', 'Solo clientes'], ['SOLO_EMPRESAS', 'Solo empresas']].map(([v, l]) => (
                  <button key={v} onClick={() => { setFiltroCliente(v); if (v !== 'SOLO_EMPRESAS') setFiltroEmpresaNombre(''); setPage(1); }} style={chipStyle(filtroCliente === v)}>{l}</button>
                ))}
              </div>
              {filtroCliente === 'SOLO_EMPRESAS' && empresas.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text-xmuted)', display: 'block', marginBottom: 6 }}>Empresa específica</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['', 'Todas'], ...empresas.map(e => [e.nombre, e.nombre])].map(([v, l]) => (
                      <button key={v} onClick={() => { setFiltroEmpresaNombre(v); setPage(1); }} style={chipStyle(filtroEmpresaNombre === v)}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Búsqueda por nombre */}
            <div style={{ maxWidth: 360 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text-xmuted)', display: 'block', marginBottom: 4 }}>Buscar</label>
              <SearchInput value={searchAlq} onChange={v => { setSearchAlq(v); setPage(1); }} placeholder="Cliente, habitación, empresa, tipo…" />
            </div>

          </div>
        )}
      </Card>

      {paged.length === 0 ? (
        <EmptyState message={tab === 'ACTIVO' ? 'No hay alquileres activos' : 'Sin historial'} icon={<ClipboardList size={48} />} />
      ) : (
        <Card padding="0 16px 4px">
          <Table headers={alquilerHeaders}>
            {paged.map(a => (
              <tr key={a.id}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ transition: 'background .12s' }}
              >                {(() => {
                  const esEmpresa = esAlquilerEmpresa(a);
                  return (
                    <>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--r-sm, 4px)', fontSize: 12, fontWeight: 700,
                    background: 'var(--accent-light, #e3f2fd)', color: 'var(--accent)',
                  }}>
                    {a.numeroHabitacion}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {a.nombreCliente}
                  {a.empresaNombre && (
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 1 }}>{a.empresaNombre}</div>
                  )}
                  {a.huespedes && a.huespedes.length > 1 && (
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                      +{a.huespedes.length - 1} huésped(es):{' '}
                      {a.huespedes.filter(h => h !== a.nombreCliente).join(', ')}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={{ padding: '2px 8px', borderRadius: 'var(--r-sm, 4px)', fontSize: 11, fontWeight: 600,
                    background: 'var(--surface-2, #f5f5f5)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {a.tipoAlquilerNombre || '—'}
                  </span>
                </td>
                <td style={tdStyle}>{formatDate(a.fechaIngreso)}</td>
                <td style={tdStyle}>{formatDate(tab === 'FINALIZADO' ? (a.fechaSalida || a.fechaPrevista) : a.fechaPrevista)}</td>
                <td style={tdStyle}>
                  {puedeVerMontos(isAdmin, esEmpresa) ? (
                    <span style={{
                      fontWeight: 700,
                      color: a.pagoPendiente > 0 ? 'var(--red, #e53935)' : 'var(--green, #43a047)',
                    }}>
                      S/ {parseFloat(a.pagoPendiente).toFixed(2)}
                    </span>
                  ) : <span style={{ cursor: 'help' }} title="Monto empresa — visible solo para administradores">—</span>}
                </td>

                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => openCuenta(a)}
                      icon={<ClipboardList size={13} />}>
                      Gestionar
                    </Btn>
                    {a.estadoAlquiler === 'ACTIVO' && (
                      <Btn variant="danger" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => openCheckout(a)}
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
          <div style={{ marginTop: 12 }}>
            <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
          </div>
        </Card>
      )}

      {/* Check-out modal — calls POST /{id}/check-out?metodoPago=X */}
      <Modal open={!!checkOutModal} onOpenChange={(open) => !open && setCheckOutModal(null)} title="Confirmar Check-out" width={480}>
        {checkOutModal && (() => {
          const esEmpresaCheckout = esAlquilerEmpresa(checkOutModal);
          const verMontosCheckout = puedeVerMontos(isAdmin, esEmpresaCheckout);
          return (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              Hab. {checkOutModal.numeroHabitacion} — {checkOutModal.nombreCliente}
            </div>
            {/* Bill breakdown */}
            {verMontosCheckout ? (
            <div style={{ background: 'var(--surface-2, #f5f5f5)', borderRadius: 'var(--r-md, 8px)', padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>Base habitación</span>
                <span>S/ {parseFloat(checkOutModal.subTotal).toFixed(2)}</span>
              </div>
              {Number(checkOutModal.totalPagadoCaja || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: 'var(--green, #43a047)' }}>
                  <span title="Total acumulado de pagos ya registrados en caja para este alquiler">Ya pagado en caja</span>
                  <span>− S/ {Number(checkOutModal.totalPagadoCaja || 0).toFixed(2)}</span>
                </div>
              )}
              {checkoutLoading && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>Cargando consumos...</div>
              )}
              {!checkoutLoading && checkoutCuentaItems.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', margin: '8px 0 4px' }}>
                    Consumos pendientes
                  </div>
                  {checkoutCuentaItems.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 2 }}>
                      <span>{c.descripcion} × {c.cantidad}</span>
                      <span>S/ {c.subTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </>
              )}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                <span>Total a cobrar</span>
                <span style={{ color: parseFloat(checkOutModal.pagoPendiente) > 0 ? 'var(--red, #e53935)' : 'var(--green, #43a047)' }}>
                  S/ {parseFloat(checkOutModal.pagoPendiente).toFixed(2)}
                </span>
              </div>
            </div>
            ) : (
            <div style={{ background: 'var(--surface-2, #f5f5f5)', borderRadius: 'var(--r-md, 8px)', padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text)' }}>Cliente empresa</strong>
              Los montos de este alquiler son gestionados por administración. El check-out se procesará normalmente.
              {!checkoutLoading && checkoutCuentaItems.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  Consumos pendientes: {checkoutCuentaItems.length} item(s)
                </div>
              )}
            </div>
            )}
            {!esEmpresaCheckout && (
            <Field label="Método de Pago">
              <select style={inputStyle} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => { setCheckOutModal(null); setCheckoutCuentaItems([]); }}>Cancelar</Btn>
              <Btn onClick={handleCheckOut} disabled={isCheckingOut}>
                {isCheckingOut ? 'Procesando...' : 'Confirmar Check-out'}
              </Btn>
            </div>
          </>
          );
        })()}
      </Modal>

      {/* Cuenta / Consumos modal — GET/POST /alquiler/{id}/cuenta */}
      <Modal open={!!cuentaModal} onOpenChange={(open) => !open && setCuentaModal(null)} title="Cuenta del Alquiler" width={580}>
        {cuentaModal && (() => {
          const esEmpresa = esAlquilerEmpresa(cuentaModal);
          const mostrarPrecios = puedeVerMontos(isAdmin, esEmpresa);
          const basePrice = parseFloat(cuentaModal.subTotal || 0);
          const totalConsumos = cuentaItems.reduce((sum, c) => sum + c.subTotal, 0);
          const totalFactura = basePrice + totalConsumos;
          const totalPagado = parseFloat(cuentaModal.totalPagadoCaja || 0);
          const saldoPendiente = parseFloat(cuentaModal.pagoPendiente || 0);
          return (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Hab. {cuentaModal.numeroHabitacion}</span>
                  <span style={{ fontSize: 14 }}> — {cuentaModal.nombreCliente}</span>
                  {cuentaModal.tipoAlquilerNombre && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{cuentaModal.tipoAlquilerNombre}</span>
                  )}
                </div>
                <Btn style={{ fontSize: 12, padding: '6px 16px', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                  icon={<FileText size={13} />}
                  onClick={() => generarBoleta(cuentaModal)}>
                  Generar Boleta
                </Btn>
              </div>

              {/* Bill table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thStyle}>Concepto</th>
                    {mostrarPrecios && <th style={{ ...thStyle, textAlign: 'right' }}>P.Unit</th>}
                    <th style={{ ...thStyle, textAlign: 'center' }}>Cant.</th>
                    {mostrarPrecios && <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>}
                    <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Alojamiento row */}
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2, #fafafa)' }}>
                    <td style={{ ...tdCuenta, fontWeight: 600 }}>Alojamiento</td>
                    {mostrarPrecios && (
                      <td style={{ ...tdCuenta, textAlign: 'right' }}>
                        {isAdmin && editBasePrice !== null ? (
                          <input
                            type="number" min="0" step="0.01" autoFocus
                            value={editBasePrice}
                            onChange={(e) => setEditBasePrice(e.target.value)}
                            onBlur={saveBasePrice}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveBasePrice(); if (e.key === 'Escape') setEditBasePrice(null); }}
                            style={{ width: 80, textAlign: 'right', padding: '2px 6px', fontSize: 13, border: '1.5px solid var(--accent)', borderRadius: 'var(--r-sm, 4px)', outline: 'none' }}
                          />
                        ) : (
                          <span
                            onClick={isAdmin ? () => setEditBasePrice(basePrice.toFixed(2)) : undefined}
                            style={isAdmin ? { cursor: 'pointer', borderBottom: '1px dashed var(--accent)', paddingBottom: 1 } : undefined}
                            title={isAdmin ? 'Clic para editar precio base' : undefined}
                          >S/ {basePrice.toFixed(2)}</span>
                        )}
                      </td>
                    )}
                    <td style={{ ...tdCuenta, textAlign: 'center' }}>1</td>
                    {mostrarPrecios && <td style={{ ...tdCuenta, textAlign: 'right', fontWeight: 600 }}>S/ {basePrice.toFixed(2)}</td>}
                    <td style={{ ...tdCuenta, textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--r-sm, 4px)', background: 'var(--green-bg, #e8f5e9)', color: 'var(--green, #43a047)' }}>BASE</span>
                    </td>
                    <td style={tdCuenta}></td>
                  </tr>
                  {/* Consumo rows */}
                  {cuentaItems.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdCuenta}>{c.descripcion}</td>
                      {mostrarPrecios && (
                        <td style={{ ...tdCuenta, textAlign: 'right' }}>
                          {isAdmin && editPopover?.id === c.id ? (
                            <input
                              type="number" min="0" step="0.5" autoFocus
                              value={editPopover.precioUnit}
                              onChange={(e) => setEditPopover(p => ({ ...p, precioUnit: e.target.value }))}
                              onBlur={saveEditConsumo}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditConsumo(); if (e.key === 'Escape') setEditPopover(null); }}
                              style={{ width: 72, textAlign: 'right', padding: '2px 6px', fontSize: 13, border: '1.5px solid var(--accent)', borderRadius: 'var(--r-sm, 4px)', outline: 'none' }}
                            />
                          ) : (
                            <span
                              onClick={isAdmin ? () => startEditConsumo(c) : undefined}
                              style={isAdmin ? { cursor: 'pointer', borderBottom: '1px dashed var(--accent)', paddingBottom: 1 } : undefined}
                              title={isAdmin ? 'Clic para editar precio' : undefined}
                            >S/ {c.precioUnit.toFixed(2)}</span>
                          )}
                        </td>
                      )}
                      <td style={{ ...tdCuenta, textAlign: 'center' }}>{c.cantidad}</td>
                      {mostrarPrecios && <td style={{ ...tdCuenta, textAlign: 'right', fontWeight: 600 }}>S/ {c.subTotal.toFixed(2)}</td>}
                      <td style={{ ...tdCuenta, textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--r-sm, 4px)',
                          background: c.estado === 'PENDIENTE' ? 'var(--orange-bg, #fff3e0)' : 'var(--green-bg, #e8f5e9)',
                          color: c.estado === 'PENDIENTE' ? 'var(--orange, #ef6c00)' : 'var(--green, #43a047)',
                        }}>{c.estado}</span>
                      </td>
                      <td style={tdCuenta}>
                        {(cuentaModal?.estadoAlquiler === 'ACTIVO' || isAdmin) && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {c.estado === 'PENDIENTE' && mostrarPrecios && cuentaModal?.estadoAlquiler === 'ACTIVO' && (
                              <button onClick={() => openPagoConsumoModal(c)} title="Marcar como pagado" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--green, #43a047)', padding: 2 }}>
                                <Check size={14} />
                              </button>
                            )}
                            {cuentaModal?.estadoAlquiler === 'ACTIVO' && (
                              <button onClick={() => removeConsumo(c.id)} title="Eliminar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red, #e53935)', padding: 2 }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              {mostrarPrecios && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, padding: '10px 10px 14px', borderTop: '2px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: 13, color: 'var(--text-muted)' }}>
                    <span>Total</span><span>S/ {totalFactura.toFixed(2)}</span>
                  </div>
                  {totalPagado > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: 13, color: 'var(--green, #43a047)' }}>
                      <span>Ya cobrado</span><span>− S/ {totalPagado.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: 15, fontWeight: 700,
                    borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2,
                    color: saldoPendiente > 0 ? 'var(--red, #e53935)' : 'var(--green, #43a047)' }}>
                    <span>Saldo</span><span>S/ {saldoPendiente.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Historial de pagos */}
              {mostrarPrecios && cuentaMovimientos.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    Pagos en caja
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={thStyle}>Fecha</th>
                        <th style={thStyle}>Concepto</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Monto</th>
                        <th style={thStyle}>Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentaMovimientos.map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ ...tdCuenta, fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(m.fecha)}</td>
                          <td style={{ ...tdCuenta, fontSize: 12 }}>{m.concepto}</td>
                          <td style={{ ...tdCuenta, fontSize: 12, textAlign: 'right', fontWeight: 600, color: 'var(--green, #43a047)' }}>
                            + S/ {parseFloat(m.monto).toFixed(2)}
                          </td>
                          <td style={{ ...tdCuenta, fontSize: 12 }}>{m.metodoPago}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}


              {/* Add consumo */}
              {cuentaModal.estadoAlquiler === 'ACTIVO' && (() => {
                const mostrarPrecioUnit = puedeVerMontos(isAdmin, esEmpresa);
                return (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      Agregar consumo
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: mostrarPrecioUnit ? '2fr 1fr 0.7fr auto' : '2fr 0.7fr auto', gap: 8, alignItems: 'end' }}>
                      <Field label="Descripción">
                        <input style={inputStyle} value={newConsumo.descripcion}
                          onChange={(e) => setNewConsumo(p => ({ ...p, descripcion: e.target.value }))}
                          placeholder="Ej: Agua mineral" />
                      </Field>
                      {mostrarPrecioUnit && (
                        <Field label="Precio unit.">
                          <input style={inputStyle} type="number" min="0" step="0.5" value={newConsumo.precioUnit}
                            onChange={(e) => setNewConsumo(p => ({ ...p, precioUnit: e.target.value }))}
                            placeholder="0.00" />
                        </Field>
                      )}
                      <Field label="Cant.">
                        <input style={inputStyle} type="number" min="1" value={newConsumo.cantidad}
                          onChange={(e) => setNewConsumo(p => ({ ...p, cantidad: e.target.value }))}
                          placeholder="1" />
                      </Field>
                      <div style={{ marginBottom: 16 }}>
                        <Btn onClick={addConsumo} icon={<Plus size={14} />}>Agregar</Btn>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          );
        })()}
      </Modal>

      <Modal open={!!pagoConsumoModal} onOpenChange={(open) => !open && setPagoConsumoModal(null)} title="Marcar consumo como pagado" width={420}>
        {pagoConsumoModal && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              {pagoConsumoModal.descripcion} - S/ {Number(pagoConsumoModal.subTotal || 0).toFixed(2)}
            </div>
            <Field label="Método de pago" required>
              <select
                value={pagoConsumoMetodo}
                onChange={(e) => setPagoConsumoMetodo(e.target.value)}
                style={inputStyle}
              >
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setPagoConsumoModal(null)}>Cancelar</Btn>
              <Btn onClick={() => markConsumoAsPaid(pagoConsumoModal, pagoConsumoMetodo)}>Confirmar pago</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* Delete historial modal (admin only) */}
      {deleteModal && (
        <Modal open={deleteModal} onOpenChange={(open) => !open && setDeleteModal(false)} title="Eliminar Historial de Alquileres" width={520}>
          {deleteStep === 1 ? (
            <>
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: 'var(--red-bg, #fbe9e7)', border: '1.5px solid var(--red, #e53935)',
                borderRadius: 'var(--r-md, 8px)', padding: '12px 16px', marginBottom: 16,
              }}>
                <AlertTriangle size={22} color="var(--red, #e53935)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red, #e53935)', marginBottom: 4 }}>Acción irreversible</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                    Los alquileres eliminados <strong>no se pueden recuperar</strong>. Los movimientos de caja asociados perderán su referencia al alquiler.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 'var(--r-md, 8px)', cursor: 'pointer',
                  border: `1.5px solid ${deleteMode === 'todo' ? 'var(--red, #e53935)' : 'var(--border)'}`,
                  background: deleteMode === 'todo' ? 'var(--red-bg, #fbe9e7)' : 'var(--surface)',
                }}>
                  <input type="radio" name="deleteModeAlq" value="todo" checked={deleteMode === 'todo'} onChange={() => setDeleteMode('todo')} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Eliminar todo el historial</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Borra todos los alquileres finalizados</div>
                  </div>
                </label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 'var(--r-md, 8px)', cursor: 'pointer',
                  border: `1.5px solid ${deleteMode === 'rango' ? 'var(--red, #e53935)' : 'var(--border)'}`,
                  background: deleteMode === 'rango' ? 'var(--red-bg, #fbe9e7)' : 'var(--surface)',
                }}>
                  <input type="radio" name="deleteModeAlq" value="rango" checked={deleteMode === 'rango'} onChange={() => setDeleteMode('rango')} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Eliminar por rango de fechas</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Solo borra alquileres dentro de un período específico</div>
                  </div>
                </label>
              </div>

              {deleteMode === 'rango' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <Field label="Desde" required>
                    <input type="date" value={deleteDesde} onChange={e => setDeleteDesde(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Hasta" required>
                    <input type="date" value={deleteHasta} onChange={e => setDeleteHasta(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Btn variant="ghost" onClick={() => setDeleteModal(false)}>Cancelar</Btn>
                <Btn
                  variant="danger"
                  onClick={handleDeletePreview}
                  disabled={deletePreviewLoading || (deleteMode === 'rango' && (!deleteDesde || !deleteHasta))}
                >
                  {deletePreviewLoading ? 'Cargando...' : 'Ver resumen antes de eliminar'}
                </Btn>
              </div>
            </>
          ) : (
            <>
              {deletePreview && (
                <div style={{
                  background: 'var(--surface)', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-md, 8px)', padding: '16px', marginBottom: 16,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Resumen de eliminación</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Período</div>
                    <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{deletePreview.periodo}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Alquileres a eliminar</div>
                    <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--red, #e53935)' }}>{deletePreview.cantidad}</div>
                  </div>
                </div>
              )}

              <div style={{
                background: 'var(--red-bg, #fbe9e7)',
                border: '1.5px solid var(--red, #e53935)',
                borderRadius: 'var(--r-md, 8px)',
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--red, #e53935)',
                fontWeight: 600,
                textAlign: 'center',
              }}>
                Esta acción no se puede deshacer
              </div>

              <Field label={<>Para confirmar, escribí <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{DELETE_KEYWORD}</code></>} required>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder={DELETE_KEYWORD}
                  style={{
                    ...inputStyle,
                    borderColor: deleteConfirmText === DELETE_KEYWORD ? 'var(--red, #e53935)' : undefined,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                  autoComplete="off"
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <Btn variant="ghost" onClick={() => { setDeleteStep(1); setDeleteConfirmText(''); }}>← Volver</Btn>
                <Btn
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  onClick={handleDeleteConfirm}
                  disabled={deleteConfirmText !== DELETE_KEYWORD || deleteSubmitting}
                >
                  {deleteSubmitting ? 'Eliminando...' : 'Eliminar'}
                </Btn>
              </div>
            </>
          )}
        </Modal>
      )}

    </div >
  );
}

const tdCuenta = { padding: '8px 10px', fontSize: 13 };
const thStyle = { padding: '8px 10px', fontSize: 12, fontWeight: 600, textAlign: 'left', color: 'var(--text-2)' };

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
