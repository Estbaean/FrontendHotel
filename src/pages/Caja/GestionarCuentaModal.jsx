import { useState, useEffect } from 'react';
import { Modal, Btn, useToast } from '../../components/UI/index.jsx';
import { Save, TrendingUp } from 'lucide-react';
import { getCuentasByAlquiler, putCuenta } from '../../api/consumos';
import { getAlquiler, patchAlquilerMontos } from '../../api/alquileres';
import { patchMovimientoMonto } from '../../api/caja';
import s from '../../styles/shared.module.css';

const thSt = { padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid var(--border)' };
const tdSt = { padding: '8px 8px', borderBottom: '1px solid var(--border)', fontSize: 13 };
const priceInput = { width: 90, textAlign: 'right', padding: '3px 6px', fontSize: 13, border: '1.5px solid var(--accent)', borderRadius: 6, outline: 'none', background: 'var(--bg)', color: 'var(--text)' };

export default function GestionarCuentaModal({ movimiento, onClose, onSuccess, onCobrar }) {
  const addToast = useToast();
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [precios, setPrecios] = useState({});
  const [basePrice, setBasePrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!movimiento?.alquilerId) return;
    let cancelled = false;
    setCuentas([]); setPrecios({}); setBasePrice('');
    setLoading(true);
    (async () => {
      try {
        const [alqRes, cuentasRes] = await Promise.allSettled([
          getAlquiler(movimiento.alquilerId),
          getCuentasByAlquiler(movimiento.alquilerId),
        ]);
        if (cancelled) return;
        const alq = alqRes.status === 'fulfilled' ? alqRes.value : null;
        const c = cuentasRes.status === 'fulfilled' ? cuentasRes.value : [];
        setCuentas(c);
        const init = {};
        c.forEach(item => { init[item.id] = String(parseFloat(item.precioUnit || 0).toFixed(2)); });
        setPrecios(init);
        if (alq) setBasePrice(String(parseFloat(alq.subTotal || 0).toFixed(2)));
      } catch {
        addToast('Error al cargar detalles del alquiler', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [movimiento, addToast]);

  if (!movimiento) return null;

  const totalConsumosEdit = cuentas.reduce(
    (s, c) => s + parseFloat(precios[c.id] || '0') * (c.cantidad || 1), 0
  );
  const baseNum = parseFloat(basePrice || '0');
  const nuevoTotal = baseNum + totalConsumosEdit;

  const saveAllPrices = async () => {
    const alquilerId = movimiento.alquilerId;
    const updatedCuentas = await Promise.all(
      cuentas.map(c =>
        putCuenta(alquilerId, c.id, {
          descripcion: c.descripcion,
          precioUnit: parseFloat(precios[c.id] || '0'),
          cantidad: c.cantidad,
          estado: c.estado,
        })
      )
    );
    setCuentas(updatedCuentas);
    const totalConsumos = updatedCuentas.reduce((s, c) => s + (parseFloat(c.subTotal) || 0), 0);
    const newTotal = baseNum + totalConsumos;
    await patchAlquilerMontos(alquilerId, { subTotal: baseNum, pagoPendiente: newTotal });
    await patchMovimientoMonto(movimiento.id, newTotal);
    return newTotal;
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
      const newTotal = await saveAllPrices();
      await onSuccess();
      onClose();
      onCobrar({ ...movimiento, monto: newTotal });
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
      {/* Info del alquiler */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 14, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
        {[
          ['Empresa', movimiento.nombreEmpresa, { fontWeight: 700, fontSize: 14 }],
          ['Cliente', movimiento.nombreCliente, { fontWeight: 600, fontSize: 13 }],
          ['Habitación', movimiento.numeroHabitacion, { fontWeight: 700, fontSize: 14, color: 'var(--accent)' }],
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
                <th style={thSt}>Descripción</th>
                <th style={{ ...thSt, textAlign: 'center' }}>Cant.</th>
                <th style={{ ...thSt, textAlign: 'right' }}>P. Unit</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Fila base — alojamiento */}
              <tr style={{ background: 'var(--surface-2, #fafafa)' }}>
                <td style={{ ...tdSt, fontWeight: 600 }}>Alojamiento</td>
                <td style={{ ...tdSt, textAlign: 'center' }}>1</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>
                  <input type="number" min="0" step="0.01" value={basePrice}
                    onChange={e => setBasePrice(e.target.value)} style={priceInput} />
                </td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>S/ {baseNum.toFixed(2)}</td>
              </tr>
              {/* Filas consumos */}
              {cuentas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdSt, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Sin consumos adicionales registrados
                  </td>
                </tr>
              ) : cuentas.map(c => (
                <tr key={c.id}>
                  <td style={tdSt}>{c.descripcion}</td>
                  <td style={{ ...tdSt, textAlign: 'center' }}>{c.cantidad}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    <input type="number" min="0" step="0.50"
                      value={precios[c.id] ?? ''}
                      onChange={e => setPrecios(prev => ({ ...prev, [c.id]: e.target.value }))}
                      style={priceInput} />
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>
                    S/ {(parseFloat(precios[c.id] || '0') * c.cantidad).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Resumen total */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, padding: '10px 8px 12px', borderTop: '2px solid var(--border)', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 230, fontSize: 13, color: 'var(--text-muted)' }}>
                <span>Alojamiento</span><span>S/ {baseNum.toFixed(2)}</span>
              </div>
              {cuentas.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: 230, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>Consumos</span><span>S/ {totalConsumosEdit.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 230, fontSize: 15, fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 3, color: '#e65100' }}>
                <span>Total a cobrar</span><span>S/ {nuevoTotal.toFixed(2)}</span>
              </div>
            </div>

          {/* Acciones */}
          <div className={s.modalFooter} style={{ marginTop: 4 }}>
            <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
            <Btn variant="ghost" icon={<Save size={13} />} onClick={handleGuardarPrecios} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar precios'}
            </Btn>
            <Btn icon={<TrendingUp size={13} />} onClick={handleGuardarYCobrar} disabled={submitting}>
              {submitting ? 'Procesando...' : `Guardar y cobrar · S/ ${nuevoTotal.toFixed(2)}`}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
