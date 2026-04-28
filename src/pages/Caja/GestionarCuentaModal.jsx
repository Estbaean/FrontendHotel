import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, useToast } from '../../components/UI/index.jsx';
import { Save, TrendingUp } from 'lucide-react';
import { getCuentasByAlquiler, putCuenta } from '../../api/consumos';
import { getAlquiler, patchAlquilerMontos } from '../../api/alquileres';
import { getMovimientosPorAlquiler, patchMovimientoMonto } from '../../api/caja';
import { buildAlquilerCuentaResumen, getCuentaItemSubtotal, toMoneyNumber } from '../../utils/alquilerCuenta';
import s from '../../styles/shared.module.css';

const thSt = { padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid var(--border)' };
const tdSt = { padding: '8px 8px', borderBottom: '1px solid var(--border)', fontSize: 13 };
const priceInput = { width: 90, textAlign: 'right', padding: '3px 6px', fontSize: 13, border: '1.5px solid var(--accent)', borderRadius: 6, outline: 'none', background: 'var(--bg)', color: 'var(--text)' };

export default function GestionarCuentaModal({ movimiento, onClose, onSuccess, onCobrar, refreshAlquiler }) {
  const addToast = useToast();
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [alquilerData, setAlquilerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [precios, setPrecios] = useState({});
  const [basePrice, setBasePrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!movimiento?.alquilerId) return;

    let cancelled = false;
    setCuentas([]);
    setMovimientos([]);
    setAlquilerData(null);
    setPrecios({});
    setBasePrice('');
    setLoading(true);

    (async () => {
      try {
        const [alqRes, cuentasRes, movimientosRes] = await Promise.allSettled([
          getAlquiler(movimiento.alquilerId),
          getCuentasByAlquiler(movimiento.alquilerId),
          getMovimientosPorAlquiler(movimiento.alquilerId),
        ]);

        if (cancelled) return;

        const alquiler = alqRes.status === 'fulfilled' ? alqRes.value : null;
        const cuentasData = cuentasRes.status === 'fulfilled' ? cuentasRes.value : [];
        const movimientosData = movimientosRes.status === 'fulfilled' ? movimientosRes.value : [];

        setAlquilerData(alquiler);
        setCuentas(cuentasData);
        setMovimientos(movimientosData);

        const initialPrices = {};
        cuentasData.forEach((item) => {
          initialPrices[item.id] = String(toMoneyNumber(item.precioUnit).toFixed(2));
        });
        setPrecios(initialPrices);
        if (alquiler) setBasePrice(String(toMoneyNumber(alquiler.subTotal).toFixed(2)));
      } catch {
        addToast('Error al cargar detalles del alquiler', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [movimiento, addToast]);

  const baseNum = toMoneyNumber(basePrice);
  const previewCuentaItems = useMemo(
    () => cuentas.map((cuenta) => {
      const precioUnit = toMoneyNumber(precios[cuenta.id] ?? cuenta.precioUnit);
      return {
        ...cuenta,
        precioUnit,
        subTotal: precioUnit * toMoneyNumber(cuenta.cantidad || 1),
      };
    }),
    [cuentas, precios],
  );
  const resumenPreview = useMemo(
    () => buildAlquilerCuentaResumen({
      alquiler: { ...(alquilerData || {}), subTotal: baseNum },
      cuentaItems: previewCuentaItems,
      movimientos,
    }),
    [alquilerData, baseNum, previewCuentaItems, movimientos],
  );
  const totalConsumosEdit = previewCuentaItems.reduce((sum, cuenta) => sum + getCuentaItemSubtotal(cuenta), 0);
  const pendienteCobro = Math.max(0, resumenPreview.saldoPendiente);

  if (!movimiento) return null;

  const saveAllPrices = async () => {
    const alquilerId = movimiento.alquilerId;
    const updatedCuentas = await Promise.all(
      cuentas.map((cuenta) =>
        putCuenta(alquilerId, cuenta.id, {
          descripcion: cuenta.descripcion,
          precioUnit: toMoneyNumber(precios[cuenta.id]),
          cantidad: cuenta.cantidad,
          estado: cuenta.estado,
        }),
      ),
    );

    const freshMovimientos = await getMovimientosPorAlquiler(alquilerId);
    const nextResumen = buildAlquilerCuentaResumen({
      alquiler: { ...(alquilerData || {}), subTotal: baseNum },
      cuentaItems: updatedCuentas,
      movimientos: freshMovimientos,
    });

    const updatedAlquiler = await patchAlquilerMontos(alquilerId, {
      subTotal: baseNum,
      pagoPendiente: nextResumen.saldoPendiente,
    });
    await patchMovimientoMonto(movimiento.id, Math.max(0, nextResumen.saldoPendiente));

    setCuentas(updatedCuentas);
    setMovimientos(freshMovimientos);
    setAlquilerData(updatedAlquiler);
    await refreshAlquiler?.(alquilerId);

    return {
      alquiler: updatedAlquiler,
      saldoPendiente: nextResumen.saldoPendiente,
      pendienteCobro: Math.max(0, nextResumen.saldoPendiente),
    };
  };

  const handleGuardarPrecios = async () => {
    setSubmitting(true);
    try {
      await saveAllPrices();
      addToast('Precios guardados correctamente', 'success');
      await onSuccess();
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al guardar precios', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuardarYCobrar = async () => {
    setSubmitting(true);
    try {
      const result = await saveAllPrices();
      await onSuccess();
      onClose();
      onCobrar({ ...movimiento, monto: result.pendienteCobro });
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al procesar', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title="Gestionar cuenta empresa"
      width={580}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 14, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
        {[
          ['Empresa', movimiento.nombreEmpresa, { fontWeight: 700, fontSize: 14 }],
          ['Cliente', movimiento.nombreCliente, { fontWeight: 600, fontSize: 13 }],
          ['Habitacion', movimiento.numeroHabitacion, { fontWeight: 700, fontSize: 14, color: 'var(--accent)' }],
          ['Checkout', new Date(movimiento.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }), { fontSize: 12 }],
        ].map(([label, value, style]) => (
          <div key={label}>
            <div className={s.sectionLabel} style={{ marginBottom: 2 }}>{label}</div>
            <div style={style}>{value || '—'}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Cargando consumos...</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 2 }}>
            <thead>
              <tr>
                <th style={thSt}>Descripcion</th>
                <th style={{ ...thSt, textAlign: 'center' }}>Cant.</th>
                <th style={{ ...thSt, textAlign: 'right' }}>P. Unit</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: 'var(--surface-2, #fafafa)' }}>
                <td style={{ ...tdSt, fontWeight: 600 }}>Alojamiento</td>
                <td style={{ ...tdSt, textAlign: 'center' }}>1</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={basePrice}
                    onChange={e => setBasePrice(e.target.value)}
                    style={priceInput}
                  />
                </td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>S/ {baseNum.toFixed(2)}</td>
              </tr>

              {cuentas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdSt, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Sin consumos adicionales registrados
                  </td>
                </tr>
              ) : cuentas.map((cuenta) => (
                <tr key={cuenta.id}>
                  <td style={tdSt}>{cuenta.descripcion}</td>
                  <td style={{ ...tdSt, textAlign: 'center' }}>{cuenta.cantidad}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={precios[cuenta.id] ?? ''}
                      onChange={e => setPrecios(prev => ({ ...prev, [cuenta.id]: e.target.value }))}
                      style={priceInput}
                    />
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>
                    S/ {(toMoneyNumber(precios[cuenta.id]) * toMoneyNumber(cuenta.cantidad || 1)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, padding: '10px 8px 12px', borderTop: '2px solid var(--border)', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 240, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>Alojamiento</span><span>S/ {baseNum.toFixed(2)}</span>
            </div>
            {cuentas.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 240, fontSize: 13, color: 'var(--text-muted)' }}>
                <span>Consumos</span><span>S/ {totalConsumosEdit.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 240, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>Total cargos</span><span>S/ {resumenPreview.totalFactura.toFixed(2)}</span>
            </div>
            {resumenPreview.totalPagado > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 240, fontSize: 13, color: 'var(--green, #43a047)' }}>
                <span>Ya cobrado</span><span>- S/ {resumenPreview.totalPagado.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 240, fontSize: 15, fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 3, color: pendienteCobro > 0 ? '#e65100' : 'var(--green, #43a047)' }}>
              <span>Pendiente a cobrar</span><span>S/ {pendienteCobro.toFixed(2)}</span>
            </div>
          </div>

          <div className={s.modalFooter} style={{ marginTop: 4 }}>
            <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
            <Btn variant="ghost" icon={<Save size={13} />} onClick={handleGuardarPrecios} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar precios'}
            </Btn>
            <Btn icon={<TrendingUp size={13} />} onClick={handleGuardarYCobrar} disabled={submitting || pendienteCobro <= 0.009}>
              {submitting ? 'Procesando...' : `Guardar y cobrar · S/ ${pendienteCobro.toFixed(2)}`}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
