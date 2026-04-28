import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, Field, inputStyle, useToast } from './UI/index.jsx';
import { getCuentasByAlquiler } from '../api/consumos';
import { getMovimientosPorAlquiler } from '../api/caja';
import { getAlquiler } from '../api/alquileres';
import { buildAlquilerCuentaResumen, getCuentaItemSubtotal } from '../utils/alquilerCuenta';
import { esAlquilerEmpresa, puedeVerMontos, METODOS_PAGO } from '../utils/formHelpers';
import s from '../styles/shared.module.css';

export default function CheckoutModal({ alquiler, onClose, checkOut, isAdmin }) {
  const addToast = useToast();
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alqData, setAlqData] = useState(alquiler);
  const [cuentaItems, setCuentaItems] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  useEffect(() => {
    if (!alquiler) return;
    setAlqData(prev => ({ ...(prev || {}), ...alquiler }));
  }, [
    alquiler?.id,
    alquiler?.subTotal,
    alquiler?.pagoPendiente,
    alquiler?.totalPagadoCaja,
    alquiler?.estadoAlquiler,
  ]);

  useEffect(() => {
    if (!alquiler?.id) return;

    let cancelled = false;
    setMetodoPago('EFECTIVO');
    setCuentaItems([]);
    setMovimientos([]);
    setLoading(true);

    (async () => {
      const [alqRes, cuentasRes, movsRes] = await Promise.allSettled([
        getAlquiler(alquiler.id),
        getCuentasByAlquiler(alquiler.id),
        getMovimientosPorAlquiler(alquiler.id),
      ]);

      if (cancelled) return;
      setAlqData(alqRes.status === 'fulfilled' && alqRes.value ? alqRes.value : alquiler);
      setCuentaItems(cuentasRes.status === 'fulfilled' ? cuentasRes.value : []);
      setMovimientos(movsRes.status === 'fulfilled' ? movsRes.value : []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [alquiler?.id]);
  const currentAlquiler = alqData || alquiler;
  const esEmpresa = esAlquilerEmpresa(currentAlquiler);
  const verMontos = puedeVerMontos(isAdmin, esEmpresa);
  const consumosPendientes = useMemo(
    () => cuentaItems.filter(item => item.estado === 'PENDIENTE'),
    [cuentaItems],
  );
  const { basePrice, totalPagado, saldoPendiente } = useMemo(
    () => buildAlquilerCuentaResumen({
      alquiler: currentAlquiler,
      cuentaItems,
      movimientos,
    }),
    [currentAlquiler, cuentaItems, movimientos],
  );

  if (!alquiler || !currentAlquiler) return null;

  const saldoColor = saldoPendiente > 0.009
    ? 'var(--red, #e53935)'
    : saldoPendiente < -0.009
      ? 'var(--blue, #2563eb)'
      : 'var(--green, #43a047)';
  const saldoValue = saldoPendiente < -0.009
    ? `Vuelto S/ ${Math.abs(saldoPendiente).toFixed(2)}`
    : `S/ ${saldoPendiente.toFixed(2)}`;

  const handleCheckOut = async () => {
    if (isCheckingOut) return;

    setIsCheckingOut(true);
    try {
      await checkOut(currentAlquiler.id, esEmpresa ? undefined : metodoPago);
      addToast('Check-out realizado con exito', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al realizar check-out', 'error');
    } finally {
      setIsCheckingOut(false);
      onClose();
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Confirmar Check-out" width={480}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
        Hab. {currentAlquiler.numeroHabitacion} - {currentAlquiler.nombreCliente}
      </div>

      {verMontos ? (
        <div className={s.billBox} style={{ marginBottom: 16 }}>
          <div className={s.billRow}>
            <span>Base habitacion</span>
            <span>S/ {basePrice.toFixed(2)}</span>
          </div>
          {totalPagado > 0 && (
            <div className={s.billRow} style={{ color: 'var(--green, #43a047)' }}>
              <span title="Total acumulado de pagos ya registrados en caja para este alquiler">Ya pagado en caja</span>
              <span>- S/ {totalPagado.toFixed(2)}</span>
            </div>
          )}
          {loading && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>Cargando consumos...</div>
          )}
          {!loading && consumosPendientes.length > 0 && (
            <>
              <div className={s.sectionLabel} style={{ margin: '8px 0 4px' }}>
                Consumos pendientes
              </div>
              {consumosPendientes.map((consumo) => (
                <div key={consumo.id} className={s.billRow} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 8 }}>
                  <span>{consumo.descripcion} x {consumo.cantidad}</span>
                  <span>S/ {getCuentaItemSubtotal(consumo).toFixed(2)}</span>
                </div>
              ))}
            </>
          )}
          <div className={s.billTotal} style={{ fontSize: 15 }}>
            <span>Total a cobrar</span>
            <span style={{ color: saldoColor }}>
              {saldoValue}
            </span>
          </div>
        </div>
      ) : (
        <div className={s.billBox} style={{ marginBottom: 16 }}>
          <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text)' }}>Cliente empresa</strong>
          Los montos de este alquiler son gestionados por administracion. El check-out se procesara normalmente.
          {!loading && consumosPendientes.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Consumos pendientes: {consumosPendientes.length} item(s)
            </div>
          )}
        </div>
      )}

      {!esEmpresa && (
        <Field label="Metodo de Pago">
          <select style={inputStyle} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
            {METODOS_PAGO.map(metodo => <option key={metodo.value} value={metodo.value}>{metodo.label}</option>)}
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
