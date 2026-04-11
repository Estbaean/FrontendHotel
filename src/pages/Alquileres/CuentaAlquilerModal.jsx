import { useState, useEffect } from 'react';
import { Modal, Btn, Field, inputStyle, useToast } from '../../components/UI/index.jsx';
import { Plus, Trash2, Check, FileText } from 'lucide-react';
import { getCuentasByAlquiler, postCuenta, putCuenta, deleteCuenta } from '../../api/consumos';
import { getMovimientosPorAlquiler } from '../../api/caja';
import { patchAlquilerMontos } from '../../api/alquileres';
import { generarBoletaCheckout } from '../../utils/reportesPdf';
import { esAlquilerEmpresa, puedeVerMontos, METODOS_PAGO } from '../../utils/formHelpers';
import s from '../../styles/shared.module.css';

const thStyle = { padding: '8px 10px', fontSize: 12, fontWeight: 600, textAlign: 'left', color: 'var(--text-2)' };
const tdCuenta = { padding: '8px 10px', fontSize: 13 };

export default function CuentaAlquilerModal({ alquiler, onClose, isAdmin, refreshAlquiler }) {
  const addToast = useToast();

  const [alqData, setAlqData] = useState(alquiler);
  const [cuentaItems, setCuentaItems] = useState([]);
  const [newConsumo, setNewConsumo] = useState({ descripcion: '', precioUnit: '', cantidad: 1 });
  const [pagoConsumoModal, setPagoConsumoModal] = useState(null);
  const [pagoConsumoMetodo, setPagoConsumoMetodo] = useState('EFECTIVO');
  const [editPopover, setEditPopover] = useState(null);
  const [cuentaMovimientos, setCuentaMovimientos] = useState([]);
  const [editBasePrice, setEditBasePrice] = useState(null);

  useEffect(() => {
    if (!alquiler?.id) return;
    setAlqData(alquiler);
    setNewConsumo({ descripcion: '', precioUnit: '', cantidad: 1 });
    setEditPopover(null);
    setPagoConsumoModal(null);
    setEditBasePrice(null);
    (async () => {
      const [cuentasRes, movsRes] = await Promise.allSettled([
        getCuentasByAlquiler(alquiler.id),
        getMovimientosPorAlquiler(alquiler.id),
      ]);
      setCuentaItems(cuentasRes.status === 'fulfilled' ? cuentasRes.value : []);
      setCuentaMovimientos(movsRes.status === 'fulfilled' ? movsRes.value : []);
    })();
  }, [alquiler]);

  if (!alquiler || !alqData) return null;

  const esEmpresa = esAlquilerEmpresa(alqData);
  const mostrarPrecios = puedeVerMontos(isAdmin, esEmpresa);
  const basePrice = parseFloat(alqData.subTotal || 0);
  const totalConsumos = cuentaItems.reduce((sum, c) => sum + c.subTotal, 0);
  const totalFactura = basePrice + totalConsumos;
  const totalPagado = parseFloat(alqData.totalPagadoCaja || 0);
  const saldoPendiente = parseFloat(alqData.pagoPendiente || 0);

  const refreshLocal = async () => {
    const updated = await refreshAlquiler(alqData.id);
    if (updated) setAlqData(prev => ({ ...prev, pagoPendiente: updated.pagoPendiente, totalPagadoCaja: updated.totalPagadoCaja, subTotal: updated.subTotal }));
    return updated;
  };

  const generarBoleta = async () => {
    try {
      const [cuentasRes, movsRes] = await Promise.allSettled([
        getCuentasByAlquiler(alqData.id),
        getMovimientosPorAlquiler(alqData.id),
      ]);
      generarBoletaCheckout(
        alqData,
        cuentasRes.status === 'fulfilled' ? cuentasRes.value : [],
        movsRes.status === 'fulfilled' ? movsRes.value : [],
        { isAdmin },
      );
      addToast('Boleta generada', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al generar boleta', 'error');
    }
  };

  const addConsumo = async () => {
    const { descripcion, precioUnit, cantidad } = newConsumo;
    if (!descripcion.trim() || cantidad < 1) return;
    const puedeEditarPrecio = puedeVerMontos(isAdmin, esEmpresa);
    const precio = puedeEditarPrecio ? parseFloat(precioUnit || '0') : 0;
    const payload = { descripcion: descripcion.trim(), precioUnit: precio, cantidad: Number(cantidad), estado: 'PENDIENTE' };
    try {
      const saved = await postCuenta(alqData.id, payload);
      setCuentaItems(prev => [...prev, saved]);
      const updated = await refreshLocal();
      if (!updated) setAlqData(prev => ({ ...prev, pagoPendiente: parseFloat(prev.pagoPendiente) + saved.subTotal }));
      addToast('Consumo agregado', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al agregar consumo', 'error');
    }
    setNewConsumo({ descripcion: '', precioUnit: '', cantidad: 1 });
  };

  const saveEditConsumo = async () => {
    if (!editPopover || !isAdmin) return;
    const precio = parseFloat(editPopover.precioUnit);
    if (isNaN(precio) || precio < 0) { setEditPopover(null); return; }
    const currentItem = cuentaItems.find(c => c.id === editPopover.id);
    if (!currentItem) { setEditPopover(null); return; }
    const payload = { descripcion: currentItem.descripcion, precioUnit: precio, cantidad: currentItem.cantidad, estado: currentItem.estado };
    setEditPopover(null);
    try {
      const updated = await putCuenta(alqData.id, editPopover.id, payload);
      setCuentaItems(prev => prev.map(c => c.id === editPopover.id ? updated : c));
      await refreshLocal();
      addToast('Precio actualizado', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al actualizar precio', 'error');
    }
  };

  const removeConsumo = async (id) => {
    try {
      await deleteCuenta(alqData.id, id);
      const refreshedItems = await getCuentasByAlquiler(alqData.id);
      setCuentaItems(refreshedItems);
      await refreshLocal();
      if (editPopover?.id === id) setEditPopover(null);
      addToast('Consumo eliminado', 'info');
      getMovimientosPorAlquiler(alqData.id).then(setCuentaMovimientos).catch(() => {});
    } catch (error) {
      addToast(error?.response?.data?.message || 'No se pudo eliminar el consumo', 'error');
    }
  };

  const markConsumoAsPaid = async (c, metodo) => {
    try {
      const updated = await putCuenta(alqData.id, c.id, {
        descripcion: c.descripcion, precioUnit: c.precioUnit, cantidad: c.cantidad, estado: 'PAGADO',
      }, metodo);
      setCuentaItems(prev => prev.map(x => x.id === c.id ? updated : x));
      const refreshed = await refreshLocal();
      if (!refreshed) setAlqData(prev => ({ ...prev, pagoPendiente: Math.max(0, parseFloat(prev.pagoPendiente) - c.subTotal) }));
      setPagoConsumoModal(null);
      addToast('Consumo marcado como pagado', 'success');
      getMovimientosPorAlquiler(alqData.id).then(setCuentaMovimientos).catch(() => {});
    } catch (error) {
      addToast(error?.response?.data?.message || 'No se pudo marcar el consumo como pagado', 'error');
    }
  };

  const saveBasePrice = async () => {
    if (editBasePrice === null || !isAdmin) return;
    const subTotal = parseFloat(editBasePrice);
    if (isNaN(subTotal) || subTotal < 0) { setEditBasePrice(null); return; }
    const pagoPendiente = Math.max(0, subTotal + totalConsumos - totalPagado);
    setEditBasePrice(null);
    try {
      await patchAlquilerMontos(alqData.id, { subTotal, pagoPendiente });
      await refreshAlquiler(alqData.id);
      setAlqData(prev => ({ ...prev, subTotal, pagoPendiente }));
      addToast('Precio base actualizado', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al actualizar', 'error');
    }
  };

  return (
    <>
    <Modal open onOpenChange={(o) => !o && onClose()} title="Cuenta del Alquiler" width={580}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Hab. {alqData.numeroHabitacion}</span>
          <span style={{ fontSize: 14 }}> — {alqData.nombreCliente}</span>
          {alqData.tipoAlquilerNombre && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{alqData.tipoAlquilerNombre}</span>
          )}
        </div>
        <Btn style={{ fontSize: 12, padding: '6px 16px', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
          icon={<FileText size={13} />}
          onClick={generarBoleta}>
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
              <span className={s.badgeGreen} style={{ fontSize: 10 }}>BASE</span>
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
                      onClick={isAdmin ? () => setEditPopover(prev => prev?.id === c.id ? null : { id: c.id, precioUnit: String(c.precioUnit) }) : undefined}
                      style={isAdmin ? { cursor: 'pointer', borderBottom: '1px dashed var(--accent)', paddingBottom: 1 } : undefined}
                      title={isAdmin ? 'Clic para editar precio' : undefined}
                    >S/ {c.precioUnit.toFixed(2)}</span>
                  )}
                </td>
              )}
              <td style={{ ...tdCuenta, textAlign: 'center' }}>{c.cantidad}</td>
              {mostrarPrecios && <td style={{ ...tdCuenta, textAlign: 'right', fontWeight: 600 }}>S/ {c.subTotal.toFixed(2)}</td>}
              <td style={{ ...tdCuenta, textAlign: 'center' }}>
                <span className={c.estado === 'PENDIENTE' ? s.badgeOrange : s.badgeGreen} style={{ fontSize: 10 }}>{c.estado}</span>
              </td>
              <td style={tdCuenta}>
                {(alqData.estadoAlquiler === 'ACTIVO' || isAdmin) && (
                  <div className={s.actionRow}>
                    {c.estado === 'PENDIENTE' && mostrarPrecios && alqData.estadoAlquiler === 'ACTIVO' && (
                      <button onClick={() => { setPagoConsumoModal(c); setPagoConsumoMetodo('EFECTIVO'); }} title="Marcar como pagado" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--green, #43a047)', padding: 2 }}>
                        <Check size={14} />
                      </button>
                    )}
                    {alqData.estadoAlquiler === 'ACTIVO' && (
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
          <div className={s.sectionLabel} style={{ marginBottom: 6 }}>
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
      {alqData.estadoAlquiler === 'ACTIVO' && (() => {
        const mostrarPrecioUnit = puedeVerMontos(isAdmin, esEmpresa);
        return (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className={s.sectionLabel} style={{ marginBottom: 10 }}>
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
    </Modal>

    {/* Sub-modal: confirmar pago de consumo individual */}
    <Modal open={!!pagoConsumoModal} onOpenChange={(o) => !o && setPagoConsumoModal(null)} title="Marcar consumo como pagado" width={420}>
      {pagoConsumoModal && (
        <>
          <div className={s.infoMuted} style={{ marginBottom: 10 }}>
            {pagoConsumoModal.descripcion} - S/ {Number(pagoConsumoModal.subTotal || 0).toFixed(2)}
          </div>
          <Field label="Método de pago" required>
            <select value={pagoConsumoMetodo} onChange={(e) => setPagoConsumoMetodo(e.target.value)} style={inputStyle}>
              {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <div className={s.modalFooter}>
            <Btn variant="ghost" onClick={() => setPagoConsumoModal(null)}>Cancelar</Btn>
            <Btn onClick={() => markConsumoAsPaid(pagoConsumoModal, pagoConsumoMetodo)}>Confirmar pago</Btn>
          </div>
        </>
      )}
    </Modal>
    </>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
