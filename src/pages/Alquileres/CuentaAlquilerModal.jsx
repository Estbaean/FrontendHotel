import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, Field, inputStyle, useToast } from '../../components/UI/index.jsx';
import { Plus, Trash2, Check, FileText, RefreshCw } from 'lucide-react';
import { getCuentasByAlquiler, postCuenta, putCuenta, deleteCuenta } from '../../api/consumos';
import { getMovimientosPorAlquiler, patchMovimientoMonto } from '../../api/caja';
import { patchAlquilerMontos } from '../../api/alquileres';
import {
  buildAlquilerCuentaResumen,
  getCuentaItemSubtotal,
  hasMoneyDifference,
  toMoneyNumber,
} from '../../utils/alquilerCuenta';
import { findMovimientoPagoConsumo } from '../../utils/cajaMovimientos';
import { generarBoletaCheckout } from '../../utils/reportesPdf';
import { esAlquilerEmpresa, puedeVerMontos, METODOS_PAGO } from '../../utils/formHelpers';
import s from '../../styles/shared.module.css';

const thStyle = { padding: '8px 10px', fontSize: 12, fontWeight: 600, textAlign: 'left', color: 'var(--text-2)', whiteSpace: 'nowrap' };
const tdCuenta = { padding: '8px 10px', fontSize: 13, whiteSpace: 'nowrap' };

export default function CuentaAlquilerModal({ alquiler, onClose, isAdmin, refreshAlquiler, mergeAlquilerLocal }) {
  const addToast = useToast();

  const [alqData, setAlqData] = useState(alquiler);
  const [cuentaItems, setCuentaItems] = useState([]);
  const [cuentaMovimientos, setCuentaMovimientos] = useState([]);
  const [newConsumo, setNewConsumo] = useState({ descripcion: '', precioUnit: '', cantidad: 1 });
  const [pagoConsumoModal, setPagoConsumoModal] = useState(null);
  const [pagoConsumoMetodo, setPagoConsumoMetodo] = useState('EFECTIVO');
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [editPopover, setEditPopover] = useState(null);
  const [editBasePrice, setEditBasePrice] = useState(null);

  useEffect(() => {
    if (!alquiler) return;
    setAlqData(prev => ({ ...(prev || {}), ...alquiler }));
  }, [
    alquiler?.id,
    alquiler?.subTotal,
    alquiler?.pagoPendiente,
    alquiler?.totalPagadoCaja,
    alquiler?.estadoAlquiler,
    alquiler?.fechaPrevista,
    alquiler?.fechaSalida,
  ]);

  useEffect(() => {
    if (!alquiler?.id) return;

    let cancelled = false;
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

      if (cancelled) return;
      setCuentaItems(cuentasRes.status === 'fulfilled' ? cuentasRes.value : []);
      setCuentaMovimientos(movsRes.status === 'fulfilled' ? movsRes.value : []);
    })();

    return () => {
      cancelled = true;
    };
  }, [alquiler?.id]);

  const applyDerivedState = (nextAlquiler, nextCuentaItems, nextMovimientos) => {
    const nextResumen = buildAlquilerCuentaResumen({
      alquiler: nextAlquiler,
      cuentaItems: nextCuentaItems,
      movimientos: nextMovimientos,
    });
    const nextSnapshot = {
      ...nextAlquiler,
      subTotal: nextResumen.basePrice,
      pagoPendiente: nextResumen.saldoPendiente,
      totalPagadoCaja: nextResumen.totalPagado,
    };

    setCuentaItems(nextCuentaItems);
    setCuentaMovimientos(nextMovimientos);
    setAlqData(nextSnapshot);
    mergeAlquilerLocal?.(nextAlquiler?.id, nextSnapshot);

    return nextResumen;
  };

  const forceFullRefresh = async ({ syncMontos = false } = {}) => {
    const alquilerActual = alqData || alquiler;
    if (loadingRefresh || !alquilerActual?.id) return;

    setLoadingRefresh(true);
    try {
      const [updatedAlqRes, freshCuentasRes, freshMovimientosRes] = await Promise.allSettled([
        refreshAlquiler(alquilerActual.id),
        getCuentasByAlquiler(alquilerActual.id),
        getMovimientosPorAlquiler(alquilerActual.id),
      ]);

      const freshAlquiler = updatedAlqRes.status === 'fulfilled' && updatedAlqRes.value
        ? updatedAlqRes.value
        : alquilerActual;
      const freshCuentas = freshCuentasRes.status === 'fulfilled' ? freshCuentasRes.value : [];
      const freshMovimientos = freshMovimientosRes.status === 'fulfilled' ? freshMovimientosRes.value : [];
      const freshResumen = buildAlquilerCuentaResumen({
        alquiler: freshAlquiler,
        cuentaItems: freshCuentas,
        movimientos: freshMovimientos,
      });

      let finalAlquiler = freshAlquiler;
      if (
        syncMontos &&
        (
          hasMoneyDifference(freshAlquiler?.subTotal, freshResumen.basePrice) ||
          hasMoneyDifference(freshAlquiler?.pagoPendiente, freshResumen.saldoPendiente)
        )
      ) {
        finalAlquiler = await patchAlquilerMontos(alquilerActual.id, {
          subTotal: freshResumen.basePrice,
          pagoPendiente: freshResumen.saldoPendiente,
        });
      }
      applyDerivedState(finalAlquiler, freshCuentas, freshMovimientos);
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al refrescar datos', 'error');
    } finally {
      setLoadingRefresh(false);
    }
  };
  const currentAlquiler = alqData || alquiler;
  const esEmpresa = esAlquilerEmpresa(currentAlquiler);
  const mostrarPrecios = puedeVerMontos(isAdmin, esEmpresa);

  const {
    basePrice,
    totalConsumos,
    totalFactura,
    totalPagado,
    saldoPendiente,
    movimientosVisibles,
  } = useMemo(
    () => buildAlquilerCuentaResumen({
      alquiler: currentAlquiler,
      cuentaItems,
      movimientos: cuentaMovimientos,
    }),
    [currentAlquiler, cuentaItems, cuentaMovimientos],
  );

  if (!alquiler || !currentAlquiler) return null;

  const saldoColor = saldoPendiente > 0.009
    ? 'var(--red, #e53935)'
    : saldoPendiente < -0.009
      ? 'var(--blue, #2563eb)'
      : 'var(--green, #43a047)';
  const saldoLabel = saldoPendiente < -0.009 ? 'Vuelto' : 'Saldo';
  const saldoValue = saldoPendiente < -0.009
    ? `S/ ${Math.abs(saldoPendiente).toFixed(2)}`
    : `S/ ${saldoPendiente.toFixed(2)}`;

  const ajustarMovimientoPagoConsumo = async (consumo, nuevoMonto) => {
    try {
      const movimientoPago = findMovimientoPagoConsumo(cuentaMovimientos, consumo);
      if (!movimientoPago?.id) return false;
      await patchMovimientoMonto(movimientoPago.id, Math.max(0, toMoneyNumber(nuevoMonto)), movimientoPago.metodoPago || undefined);
      return true;
    } catch {
      return false;
    }
  };

  const generarBoleta = async () => {
    try {
      const [cuentasRes, movsRes] = await Promise.allSettled([
        getCuentasByAlquiler(currentAlquiler.id),
        getMovimientosPorAlquiler(currentAlquiler.id),
      ]);

      const freshCuentas = cuentasRes.status === 'fulfilled' ? cuentasRes.value : [];
      const freshMovimientos = movsRes.status === 'fulfilled' ? movsRes.value : [];
      const resumenBoleta = buildAlquilerCuentaResumen({
        alquiler: currentAlquiler,
        cuentaItems: freshCuentas,
        movimientos: freshMovimientos,
      });

      generarBoletaCheckout(
        {
          ...currentAlquiler,
          subTotal: resumenBoleta.basePrice,
          pagoPendiente: resumenBoleta.saldoPendiente,
          totalPagadoCaja: resumenBoleta.totalPagado,
        },
        freshCuentas,
        resumenBoleta.movimientosVisibles,
        { isAdmin },
      );
      addToast('Boleta generada', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al generar boleta', 'error');
    }
  };

  const addConsumo = async () => {
    const { descripcion, precioUnit, cantidad } = newConsumo;
    if (!descripcion.trim() || Number(cantidad) < 1) return;

    const precio = mostrarPrecios ? toMoneyNumber(precioUnit) : 0;
    if (mostrarPrecios && (Number.isNaN(precio) || precio < 0)) {
      addToast('El precio unitario debe ser un numero valido', 'error');
      return;
    }

    try {
      await postCuenta(currentAlquiler.id, {
        descripcion: descripcion.trim(),
        precioUnit: precio,
        cantidad: Number(cantidad),
        estado: 'PENDIENTE',
      });
      await forceFullRefresh({ syncMontos: true });
      addToast('Consumo agregado', 'success');
      setNewConsumo({ descripcion: '', precioUnit: '', cantidad: 1 });
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al agregar consumo', 'error');
    }
  };

  const saveEditConsumo = async () => {
    if (!editPopover || !isAdmin) return;

    const precio = toMoneyNumber(editPopover.precioUnit);
    if (Number.isNaN(precio) || precio < 0) {
      setEditPopover(null);
      return;
    }

    const currentItem = cuentaItems.find(c => c.id === editPopover.id);
    if (!currentItem) {
      setEditPopover(null);
      return;
    }
    const nuevoSubTotal = precio * toMoneyNumber(currentItem.cantidad || 1);

    setEditPopover(null);
    try {
      await putCuenta(currentAlquiler.id, editPopover.id, {
        descripcion: currentItem.descripcion,
        precioUnit: precio,
        cantidad: currentItem.cantidad,
        estado: currentItem.estado,
      });
      const movimientoAjustado = currentItem.estado === 'PAGADO'
        ? await ajustarMovimientoPagoConsumo(currentItem, nuevoSubTotal)
        : true;
      await forceFullRefresh({ syncMontos: true });
      if (currentItem.estado === 'PAGADO' && !movimientoAjustado) {
        addToast('El precio se actualizo, pero no se pudo reconciliar automaticamente un movimiento de caja.', 'warning');
      }
      addToast('Precio actualizado', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al actualizar precio', 'error');
    }
  };

  const removeConsumo = async (id) => {
    const currentItem = cuentaItems.find(c => c.id === id);
    try {
      let movimientoAjustado = true;

      // Si está pagado, primero revertir a pendiente (misma lógica que el botón revertir)
      // para evitar que el backend genere un EGRESO al hacer DELETE sobre un ítem PAGADO.
      if (currentItem?.estado === 'PAGADO') {
        movimientoAjustado = await revertirConsumoAPendiente(currentItem);
      }

      await deleteCuenta(currentAlquiler.id, id);

      if (editPopover?.id === id) setEditPopover(null);
      await forceFullRefresh({ syncMontos: true });
      if (currentItem?.estado === 'PAGADO' && !movimientoAjustado) {
        addToast('El consumo se elimino, pero el movimiento de caja asociado requiere revision manual.', 'warning');
      }
      addToast('Consumo eliminado', 'info');
    } catch (error) {
      addToast(error?.response?.data?.message || 'No se pudo eliminar el consumo', 'error');
    }
  };

  const revertirConsumoAPendiente = async (consumo) => {
    await putCuenta(currentAlquiler.id, consumo.id, {
      descripcion: consumo.descripcion,
      precioUnit: consumo.precioUnit,
      cantidad: consumo.cantidad,
      estado: 'PENDIENTE',
    });
    return await ajustarMovimientoPagoConsumo(consumo, 0);
  };

  const revertConsumoToPending = async (consumo) => {
    try {
      const movimientoAjustado = await revertirConsumoAPendiente(consumo);
      await forceFullRefresh({ syncMontos: true });
      setPagoConsumoModal(null);
      if (!movimientoAjustado) {
        addToast('El consumo se revirtio, pero el movimiento de caja asociado no pudo anularse automaticamente.', 'warning');
      }
      addToast('Consumo revertido a pendiente', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'No se pudo revertir', 'error');
    }
  };

  const markConsumoAsPaid = async (consumo, metodo) => {
    try {
      await putCuenta(
        currentAlquiler.id,
        consumo.id,
        {
          descripcion: consumo.descripcion,
          precioUnit: consumo.precioUnit,
          cantidad: consumo.cantidad,
          estado: 'PAGADO',
        },
        metodo,
      );
      await forceFullRefresh({ syncMontos: true });
      setPagoConsumoModal(null);
      addToast('Consumo marcado como pagado', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'No se pudo marcar como pagado', 'error');
    }
  };

  const saveBasePrice = async () => {
    if (editBasePrice === null || !isAdmin) return;

    const subTotal = toMoneyNumber(editBasePrice);
    if (Number.isNaN(subTotal) || subTotal < 0) {
      setEditBasePrice(null);
      return;
    }

    setEditBasePrice(null);
    try {
      await patchAlquilerMontos(currentAlquiler.id, {
        subTotal,
        pagoPendiente: subTotal + totalConsumos - totalPagado,
      });
      await forceFullRefresh({ syncMontos: true });
      addToast('Precio base actualizado', 'success');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al actualizar', 'error');
    }
  };

  return (
    <>
      <Modal open onOpenChange={(open) => !open && onClose()} title="Cuenta del Alquiler" width={600}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Hab. {currentAlquiler.numeroHabitacion}</span>
            <span style={{ fontSize: 14 }}> - {currentAlquiler.nombreCliente}</span>
            {currentAlquiler.tipoAlquilerNombre && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{currentAlquiler.tipoAlquilerNombre}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn
              style={{ fontSize: 12, padding: '6px 16px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              icon={<RefreshCw size={14} />}
              onClick={() => forceFullRefresh()}
              disabled={loadingRefresh}
              title="Refrescar datos"
            >
              {loadingRefresh ? '↻' : 'Refrescar'}
            </Btn>
            <Btn
              style={{ fontSize: 12, padding: '6px 16px', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              icon={<FileText size={13} />}
              onClick={generarBoleta}
            >
              Generar Boleta
            </Btn>
          </div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -10px', padding: '0 10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 450 }}>
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
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2, #fafafa)' }}>
                <td style={{ ...tdCuenta, fontWeight: 600 }}>Alojamiento</td>
                {mostrarPrecios && (
                  <td style={{ ...tdCuenta, textAlign: 'right' }}>
                    {isAdmin && editBasePrice !== null ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        autoFocus
                        value={editBasePrice}
                        onChange={(e) => setEditBasePrice(e.target.value)}
                        onBlur={saveBasePrice}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveBasePrice();
                          if (e.key === 'Escape') setEditBasePrice(null);
                        }}
                        style={{ width: 80, textAlign: 'right', padding: '2px 6px', fontSize: 13, border: '1.5px solid var(--accent)', borderRadius: 'var(--r-sm, 4px)', outline: 'none' }}
                      />
                    ) : (
                      <span
                        onClick={isAdmin ? () => setEditBasePrice(basePrice.toFixed(2)) : undefined}
                        style={isAdmin ? { cursor: 'pointer', borderBottom: '1px dashed var(--accent)', paddingBottom: 1 } : undefined}
                        title={isAdmin ? 'Clic para editar precio base' : undefined}
                      >
                        S/ {basePrice.toFixed(2)}
                      </span>
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

              {cuentaItems.map((consumo) => {
                const itemTotal = getCuentaItemSubtotal(consumo);

                return (
                  <tr key={consumo.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdCuenta, whiteSpace: 'normal', minWidth: 120 }}>{consumo.descripcion}</td>
                    {mostrarPrecios && (
                      <td style={{ ...tdCuenta, textAlign: 'right' }}>
                        {isAdmin && editPopover?.id === consumo.id ? (
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            autoFocus
                            value={editPopover.precioUnit}
                            onChange={(e) => setEditPopover(prev => ({ ...prev, precioUnit: e.target.value }))}
                            onBlur={saveEditConsumo}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditConsumo();
                              if (e.key === 'Escape') setEditPopover(null);
                            }}
                            style={{ width: 72, textAlign: 'right', padding: '2px 6px', fontSize: 13, border: '1.5px solid var(--accent)', borderRadius: 'var(--r-sm, 4px)', outline: 'none' }}
                          />
                        ) : (
                          <span
                            onClick={isAdmin ? () => setEditPopover(prev => (
                              prev?.id === consumo.id
                                ? null
                                : { id: consumo.id, precioUnit: String(consumo.precioUnit) }
                            )) : undefined}
                            style={isAdmin ? { cursor: 'pointer', borderBottom: '1px dashed var(--accent)', paddingBottom: 1 } : undefined}
                            title={isAdmin ? 'Clic para editar precio' : undefined}
                          >
                            S/ {toMoneyNumber(consumo.precioUnit).toFixed(2)}
                          </span>
                        )}
                      </td>
                    )}
                    <td style={{ ...tdCuenta, textAlign: 'center' }}>{consumo.cantidad}</td>
                    {mostrarPrecios && <td style={{ ...tdCuenta, textAlign: 'right', fontWeight: 600 }}>S/ {itemTotal.toFixed(2)}</td>}
                    <td style={{ ...tdCuenta, textAlign: 'center' }}>
                      <span className={consumo.estado === 'PENDIENTE' ? s.badgeOrange : s.badgeGreen} style={{ fontSize: 10 }}>
                        {consumo.estado}
                      </span>
                    </td>
                    <td style={tdCuenta}>
                      {(currentAlquiler.estadoAlquiler === 'ACTIVO' || isAdmin) && (
                        <div className={s.actionRow} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {consumo.estado === 'PENDIENTE' && mostrarPrecios && currentAlquiler.estadoAlquiler === 'ACTIVO' && (
                            <button
                              onClick={() => {
                                setPagoConsumoModal(consumo);
                                setPagoConsumoMetodo('EFECTIVO');
                              }}
                              title="Marcar como pagado"
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--green, #43a047)', padding: 4 }}
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {consumo.estado === 'PAGADO' && currentAlquiler.estadoAlquiler === 'ACTIVO' && isAdmin && (
                            <button
                              onClick={() => setPagoConsumoModal({ ...consumo, revert: true })}
                              title="Revertir a pendiente"
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--orange, #f57c00)', padding: 4 }}
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}
                          {currentAlquiler.estadoAlquiler === 'ACTIVO' && (
                            <button
                              onClick={() => removeConsumo(consumo.id)}
                              title="Eliminar"
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red, #e53935)', padding: 4 }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mostrarPrecios && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, padding: '12px 10px 14px', borderTop: '2px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 240, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>Total</span><span>S/ {totalFactura.toFixed(2)}</span>
            </div>
            {totalPagado > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 240, fontSize: 13, color: 'var(--green, #43a047)' }}>
                <span>Ya cobrado</span><span>- S/ {totalPagado.toFixed(2)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: 240,
                fontSize: 15,
                fontWeight: 700,
                borderTop: '1px solid var(--border)',
                paddingTop: 6,
                marginTop: 2,
                color: saldoColor,
              }}
            >
              <span>{saldoLabel}</span><span>{saldoValue}</span>
            </div>
          </div>
        )}

        {mostrarPrecios && movimientosVisibles.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
            <div className={s.sectionLabel} style={{ marginBottom: 6 }}>
              Pagos en caja
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -10px', padding: '0 10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Concepto</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Monto</th>
                    <th style={thStyle}>Metodo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosVisibles.map((movimiento) => {
                    const monto = toMoneyNumber(movimiento.monto);
                    const esEgreso = movimiento.tipo === 'EGRESO';
                    const esPendiente = movimiento.tipo === 'PENDIENTE';
                    const prefijo = esPendiente ? '' : esEgreso ? '- ' : '+ ';
                    const color = esPendiente
                      ? 'var(--orange, #f57c00)'
                      : esEgreso
                        ? 'var(--red, #e53935)'
                        : 'var(--green, #43a047)';

                    return (
                      <tr key={movimiento.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ ...tdCuenta, fontSize: 12 }}>{formatDate(movimiento.fecha)}</td>
                        <td style={{ ...tdCuenta, fontSize: 12, whiteSpace: 'normal', minWidth: 100 }}>{movimiento.concepto}</td>
                        <td style={{ ...tdCuenta, fontSize: 12, textAlign: 'right', fontWeight: 600, color }}>
                          {prefijo}S/ {monto.toFixed(2)}
                        </td>
                        <td style={{ ...tdCuenta, fontSize: 12 }}>{movimiento.metodoPago}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentAlquiler.estadoAlquiler === 'ACTIVO' && (() => {
          const mostrarPrecioUnit = puedeVerMontos(isAdmin, esEmpresa);

          return (
            <>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div className={s.sectionLabel} style={{ marginBottom: 10 }}>
                  Agregar consumo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: mostrarPrecioUnit ? '2fr 1fr 0.7fr auto' : '2fr 0.7fr auto', gap: 8, alignItems: 'end' }}>
                  <Field label="Descripcion">
                    <input
                      style={inputStyle}
                      value={newConsumo.descripcion}
                      onChange={(e) => setNewConsumo(prev => ({ ...prev, descripcion: e.target.value }))}
                      placeholder="Ej: Agua mineral"
                    />
                  </Field>
                  {mostrarPrecioUnit && (
                    <Field label="Precio unit.">
                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="0.5"
                        value={newConsumo.precioUnit}
                        onChange={(e) => setNewConsumo(prev => ({ ...prev, precioUnit: e.target.value }))}
                        placeholder="0.00"
                      />
                    </Field>
                  )}
                  <Field label="Cant.">
                    <input
                      style={inputStyle}
                      type="number"
                      min="1"
                      value={newConsumo.cantidad}
                      onChange={(e) => setNewConsumo(prev => ({ ...prev, cantidad: e.target.value }))}
                      placeholder="1"
                    />
                  </Field>
                  <div style={{ marginBottom: 16 }}>
                    <Btn onClick={addConsumo} icon={<Plus size={14} />} disabled={loadingRefresh}>Agregar</Btn>
                  </div>
                </div>
              </div>
              {loadingRefresh && (
                <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, color: 'var(--accent)' }}>
                  ↻ Refrescando datos...
                </div>
              )}
            </>
          );
        })()}
      </Modal>

      <Modal open={!!pagoConsumoModal} onOpenChange={(open) => !open && setPagoConsumoModal(null)} title="Marcar consumo como pagado" width={420}>
        {pagoConsumoModal && (
          <>
            {pagoConsumoModal.revert ? (
              <>
                <div className={s.infoMuted} style={{ marginBottom: 20, textAlign: 'center', color: 'var(--orange)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    {pagoConsumoModal.descripcion}
                  </div>
                  <div>Revertir a PENDIENTE</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>S/ {toMoneyNumber(pagoConsumoModal.subTotal).toFixed(2)} se sumara al saldo</div>
                </div>
                <div className={s.modalFooter} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <Btn variant="ghost" onClick={() => setPagoConsumoModal(null)}>Cancelar</Btn>
                  <Btn variant="warning" onClick={() => revertConsumoToPending(pagoConsumoModal)}>Revertir</Btn>
                </div>
              </>
            ) : (
              <>
                <div className={s.infoMuted} style={{ marginBottom: 10 }}>
                  {pagoConsumoModal.descripcion} - S/ {toMoneyNumber(pagoConsumoModal.subTotal).toFixed(2)}
                </div>
                <Field label="Metodo de pago" required>
                  <select value={pagoConsumoMetodo} onChange={(e) => setPagoConsumoMetodo(e.target.value)} style={inputStyle}>
                    {METODOS_PAGO.map(metodo => <option key={metodo.value} value={metodo.value}>{metodo.label}</option>)}
                  </select>
                </Field>
                <div className={s.modalFooter} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <Btn variant="ghost" onClick={() => setPagoConsumoModal(null)}>Cancelar</Btn>
                  <Btn onClick={() => markConsumoAsPaid(pagoConsumoModal, pagoConsumoMetodo)}>Confirmar pago</Btn>
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

function formatDate(iso) {
  if (!iso) return '-';

  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
