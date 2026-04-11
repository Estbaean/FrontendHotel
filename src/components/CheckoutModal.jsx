import { useState, useEffect } from 'react';
import { Modal, Btn, Field, inputStyle, useToast } from './UI/index.jsx';
import { getCuentasByAlquiler } from '../api/consumos';
import { esAlquilerEmpresa, puedeVerMontos, METODOS_PAGO } from '../utils/formHelpers';
import s from '../styles/shared.module.css';

export default function CheckoutModal({ alquiler, onClose, checkOut, isAdmin }) {
  const addToast = useToast();
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [cuentaItems, setCuentaItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!alquiler) return;
    setMetodoPago('EFECTIVO');
    setCuentaItems([]);
    setLoading(true);
    getCuentasByAlquiler(alquiler.id)
      .then(items => setCuentaItems(items.filter(c => c.estado === 'PENDIENTE')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [alquiler]);

  if (!alquiler) return null;

  const esEmpresa = esAlquilerEmpresa(alquiler);
  const verMontos = puedeVerMontos(isAdmin, esEmpresa);

  const handleCheckOut = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      await checkOut(alquiler.id, esEmpresa ? undefined : metodoPago);
      addToast('Check-out realizado con éxito', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al realizar check-out', 'error');
    } finally {
      setIsCheckingOut(false);
      onClose();
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Confirmar Check-out" width={480}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
        Hab. {alquiler.numeroHabitacion} — {alquiler.nombreCliente}
      </div>

      {verMontos ? (
        <div className={s.billBox} style={{ marginBottom: 16 }}>
          <div className={s.billRow}>
            <span>Base habitación</span>
            <span>S/ {parseFloat(alquiler.subTotal).toFixed(2)}</span>
          </div>
          {Number(alquiler.totalPagadoCaja || 0) > 0 && (
            <div className={s.billRow} style={{ color: 'var(--green, #43a047)' }}>
              <span title="Total acumulado de pagos ya registrados en caja para este alquiler">Ya pagado en caja</span>
              <span>− S/ {Number(alquiler.totalPagadoCaja || 0).toFixed(2)}</span>
            </div>
          )}
          {loading && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>Cargando consumos...</div>
          )}
          {!loading && cuentaItems.length > 0 && (
            <>
              <div className={s.sectionLabel} style={{ margin: '8px 0 4px' }}>
                Consumos pendientes
              </div>
              {cuentaItems.map(c => (
                <div key={c.id} className={s.billRow} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 8 }}>
                  <span>{c.descripcion} × {c.cantidad}</span>
                  <span>S/ {c.subTotal.toFixed(2)}</span>
                </div>
              ))}
            </>
          )}
          <div className={s.billTotal} style={{ fontSize: 15 }}>
            <span>Total a cobrar</span>
            <span style={{ color: parseFloat(alquiler.pagoPendiente) > 0 ? 'var(--red, #e53935)' : 'var(--green, #43a047)' }}>
              S/ {parseFloat(alquiler.pagoPendiente).toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        <div className={s.billBox} style={{ marginBottom: 16 }}>
          <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text)' }}>Cliente empresa</strong>
          Los montos de este alquiler son gestionados por administración. El check-out se procesará normalmente.
          {!loading && cuentaItems.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Consumos pendientes: {cuentaItems.length} item(s)
            </div>
          )}
        </div>
      )}

      {!esEmpresa && (
        <Field label="Método de Pago">
          <select style={inputStyle} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
            {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      )}

      <div className={s.modalFooter}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleCheckOut} disabled={isCheckingOut}>
          {isCheckingOut ? 'Procesando...' : 'Confirmar Check-out'}
        </Btn>
      </div>
    </Modal>
  );
}
