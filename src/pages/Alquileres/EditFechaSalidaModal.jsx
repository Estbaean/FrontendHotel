import { useState, useMemo, useEffect } from 'react';
import { Modal, Btn, useToast } from '../../components/UI/index.jsx';
import { Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { patchAlquilerFechaSalida } from '../../api/alquileres';
import { formatToDatetimeLocal, calcularCantTiempoFrontend } from '../../utils/formHelpers';
import s from '../../styles/shared.module.css';

/**
 * Modal dedicado para editar la fecha de salida de un alquiler.
 * Muestra preview en tiempo real del nuevo costo basado en la cantidad de tiempo.
 */
export default function EditFechaSalidaModal({ alquiler, onClose, onSuccess }) {
  const addToast = useToast();
  
  // Reset state when alquiler prop changes (fixes stale data between alquileres)
  const fechaSalidaAcordada = useMemo(() => alquiler?.fechaPrevista || alquiler?.fechaSalida, [alquiler?.id]);
  const [newFecha, setNewFecha] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync input to current alquiler's acordada fecha on mount/prop change
  useEffect(() => {
    if (alquiler?.id && fechaSalidaAcordada) {
      setNewFecha(formatToDatetimeLocal(fechaSalidaAcordada));
    }
  }, [alquiler?.id, fechaSalidaAcordada]);

  const fechaSalidaBaseFormateada = fechaSalidaAcordada 
    ? new Date(fechaSalidaAcordada).toLocaleString('es-PE', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      })
    : '—';

  // 1. Extraemos los datos usando optional chaining (?.) para que no falle antes del return temprano
  const precioFijado = parseFloat(alquiler?.precioFijado || 0);
  const cantTiempoActual = alquiler?.cantTiempo || 0;
  const unidad = alquiler?.tipoAlquilerUnidad || 'DIA';
  const multiplicador = alquiler?.tipoAlquilerMultiplicador || 1;
  const pagoPendienteActual = parseFloat(alquiler?.pagoPendiente || 0);
  const [isFocused, setIsFocused] = useState(false);
  const isInvalidDate = (alquiler && alquiler.fechaIngreso)
    ? new Date(newFecha + ':00Z').getTime() <= new Date(alquiler.fechaIngreso).getTime()
    : false;
const fechaIngresoFormateada = (alquiler && alquiler.fechaIngreso)
    ? new Date(alquiler.fechaIngreso).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : '';

  // 2. Colocamos el useMemo ANTES del return temprano
  const preview = useMemo(() => {
    if (!newFecha || !alquiler) return null;
    
    try {
      const fechaSalidaUTC = newFecha + ':00Z';
      const cantTiempoNuevo = calcularCantTiempoFrontend(
        unidad,
        multiplicador,
        alquiler.fechaIngreso,
        fechaSalidaUTC
      );
      
      if (cantTiempoNuevo <= 0) return null;

      const subTotalNuevo = precioFijado * cantTiempoNuevo;
      const subTotalActual = parseFloat(alquiler.subTotal || 0);
      
      // FIXED: Only adjust alojamiento subtotal, preserve extras/pagos
      // nuevoPendiente = pendienteActual + delta_subtotal_alojamiento
      const pagoPendienteNuevo = pagoPendienteActual + (subTotalNuevo - subTotalActual);

      return {
        cantTiempoNuevo,
        subTotalNuevo,
        pagoPendienteNuevo,
        cambioSubTotal: subTotalNuevo - subTotalActual,
        cambioContable: pagoPendienteNuevo - pagoPendienteActual,
      };
    } catch (error) {
      console.error('Error calculating preview:', error);
      return null;
    }
  }, [newFecha, alquiler, precioFijado, unidad, multiplicador, pagoPendienteActual]);

  // 3. AHORA SÍ hacemos el return temprano de forma segura
  if (!alquiler) return null;

  const handleSave = async () => {
    if (!newFecha || !preview) {
      addToast('Por favor verifica la fecha', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const isoFecha = newFecha + ':00Z'; // Convert to UTC ISO
      const updated = await patchAlquilerFechaSalida(alquiler.id, isoFecha);
      addToast('Fecha de salida actualizada correctamente', 'success');
      onSuccess?.(updated);
      onClose();
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al actualizar fecha', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (fechaSalidaAcordada) {
      setNewFecha(formatToDatetimeLocal(fechaSalidaAcordada));
    }
    onClose();
  };

  return (
    <Modal open onOpenChange={(o) => !o && handleCancel()} title="Editar Fecha de Salida" width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Input de Fecha */}
          <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-2)' }}>
          Cambiar fecha de salida programada
        </label>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          Fecha acordada/programada: {fechaSalidaBaseFormateada}
        </div>
        <input
          type="datetime-local"
          value={newFecha}
          onChange={(e) => setNewFecha(e.target.value)}
          min={formatToDatetimeLocal(alquiler.fechaIngreso)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            border: '1.5px solid',
            borderColor: isInvalidDate 
              ? 'var(--error, #ef4444)'
              : isFocused 
                ? 'var(--accent, #f59e0b)'
                : 'var(--border, #d1d5db)',
            borderRadius: 'var(--r-sm, 6px)',
            outline: 'none',
            transition: 'border-color 0.2s ease',
            backgroundColor: '#fff',
          }}
        />
        <div style={{ 
          fontSize: 11, 
          marginTop: 4,
          color: isInvalidDate ? 'var(--error, #ef4444)' : 'var(--text-muted)' 
        }}>
          Debe ser posterior a la fecha de ingreso ({fechaIngresoFormateada})
        </div>
      </div>

        {/* Preview Side-by-Side */}
        {preview && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            padding: 12,
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-sm, 6px)',
            border: '1px solid var(--border)',
          }}>
            
            {/* Actual */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Actual
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Cantidad:</span>{' '}
                <span style={{ fontWeight: 600 }}>{cantTiempoActual} {unidad.toLowerCase()}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>{' '}
                <span style={{ fontWeight: 600 }} className={s.amountAccent}>
                  S/ {parseFloat(alquiler.subTotal || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Pendiente:</span>{' '}
                <span style={{ fontWeight: 600 }} className={pagoPendienteActual > 0 ? s.amountNegative : s.amountPositive}>
                  S/ {pagoPendienteActual.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Nuevo */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Nuevo
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Cantidad:</span>{' '}
                <span style={{ fontWeight: 600 }}>{preview.cantTiempoNuevo} {unidad.toLowerCase()}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>{' '}
                <span style={{ fontWeight: 600 }} className={s.amountAccent}>
                  S/ {preview.subTotalNuevo.toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Pendiente:</span>{' '}
                <span style={{ fontWeight: 600 }} 
                  className={preview.pagoPendienteNuevo > 0 ? s.amountNegative : s.amountPositive}>
                  S/ {preview.pagoPendienteNuevo.toFixed(2)}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* Resumen de Cambios */}
        {preview && (
          <div style={{
            padding: 12,
            background: preview.cambioSubTotal > 0 ? 'rgba(229, 57, 53, 0.08)' : 'rgba(67, 160, 71, 0.08)',
            borderLeft: `3px solid ${preview.cambioSubTotal > 0 ? 'var(--red)' : 'var(--green)'}`,
            borderRadius: 'var(--r-sm, 6px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertCircle size={16} style={{ color: preview.cambioSubTotal > 0 ? 'var(--red)' : 'var(--green)' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Cambio en el costo</span>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Diferencia subtotal alojamiento:</span>{' '}
              <span style={{ 
                fontWeight: 600,
                color: preview.cambioSubTotal > 0 ? 'var(--red)' : 'var(--green)'
              }}>
                {preview.cambioSubTotal > 0 ? '+' : ''} S/ {preview.cambioSubTotal.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Diferencia pendiente:</span>{' '}
              <span style={{ 
                fontWeight: 600,
                color: preview.cambioContable > 0 ? 'var(--red)' : 'var(--green)'
              }}>
                {preview.cambioContable > 0 ? '+' : ''} S/ {preview.cambioContable.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className={s.modalFooter}>
          <Btn variant="ghost" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Btn>
          <Btn 
            variant="primary" 
            onClick={handleSave} 
            disabled={!preview || isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Calendar size={14} />
            {isLoading ? 'Guardando...' : 'Guardar cambios'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
