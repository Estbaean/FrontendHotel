import { useState, useEffect } from 'react';
import { Modal, Btn, Field, inputStyle, useToast } from '../../components/UI/index.jsx';
import { postEgreso, postIngresoExtra, patchMovimientoMonto, cobrarMovimientoEmpresa, cobrarLoteEmpresaPorIds } from '../../api/caja';
import { sanitizeDecimal, METODOS_PAGO } from '../../utils/formHelpers';
import s from '../../styles/shared.module.css';

/* ─── Registrar Egreso / Ingreso Extra ─── */
export function MovimientoFormModal({ open, tipo, onClose, onSuccess }) {
  const addToast = useToast();
  const [form, setForm] = useState({ monto: '', concepto: '', metodoPago: 'EFECTIVO' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setForm({ monto: '', concepto: '', metodoPago: 'EFECTIVO' }); setErrors({}); }
  }, [open]);

  const validate = () => {
    const errs = {};
    if (!form.monto || isNaN(form.monto) || Number(form.monto) <= 0) errs.monto = 'Monto válido requerido';
    if (!form.concepto.trim()) errs.concepto = 'Concepto requerido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const payload = { monto: Number(form.monto), concepto: form.concepto, metodoPago: form.metodoPago };
    setSubmitting(true);
    try {
      if (tipo === 'EGRESO') await postEgreso(payload);
      else await postIngresoExtra(payload);
      addToast(tipo === 'EGRESO' ? 'Egreso registrado.' : 'Ingreso registrado.', 'success');
      await onSuccess();
      onClose();
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'No se pudo registrar movimiento en backend.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={tipo === 'EGRESO' ? 'Registrar Egreso' : 'Ingreso Extra'}>
      <Field label="Monto (S/)" error={errors.monto} required>
        <div className={s.amountInputWrap}>
          <span className={s.amountPrefix}>S/</span>
          <input type="text" inputMode="decimal" value={form.monto}
            onChange={e => setForm(prev => ({ ...prev, monto: sanitizeDecimal(e.target.value) }))}
            placeholder="0.00" className={s.amountInput} />
        </div>
      </Field>
      <Field label="Concepto" error={errors.concepto} required>
        <input type="text" value={form.concepto}
          onChange={e => setForm(prev => ({ ...prev, concepto: e.target.value }))}
          placeholder="Descripción del movimiento" style={inputStyle} />
      </Field>
      <Field label="Método de Pago">
        <select value={form.metodoPago} onChange={e => setForm(prev => ({ ...prev, metodoPago: e.target.value }))} style={inputStyle}>
          {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>
      <div className={s.modalFooter}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSubmit} disabled={submitting}>{tipo === 'EGRESO' ? 'Registrar Egreso' : 'Registrar Ingreso'}</Btn>
      </div>
    </Modal>
  );
}

/* ─── Editar monto modal (admin) ─── */
export function EditMontoModal({ movimiento, onClose, onSuccess }) {
  const addToast = useToast();
  const [montoValue, setMontoValue] = useState('');
  const [metodoPago, setMetodoPago] = useState('');

  useEffect(() => {
    if (movimiento) {
      setMontoValue(String(parseFloat(movimiento.monto).toFixed(2)));
      setMetodoPago(movimiento.metodoPago || '');
    }
  }, [movimiento]);

  const handleSave = async () => {
    const val = Number(montoValue);
    if (!val || val <= 0) { addToast('Monto inválido', 'error'); return; }
    try {
      await patchMovimientoMonto(movimiento.id, val, metodoPago || undefined);
      addToast('Movimiento actualizado', 'success');
      onClose();
      await onSuccess();
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al actualizar movimiento', 'error');
    }
  };

  return (
    <Modal open={!!movimiento} onOpenChange={(o) => !o && onClose()} title="Editar movimiento" width={380}>
      {movimiento && (
        <>
          <div className={s.infoMuted}>
            {movimiento.concepto} — {movimiento.tipo === 'EGRESO' ? 'Egreso' : 'Ingreso'}
          </div>
          <Field label="Nuevo monto (S/)" required>
            <div className={s.amountInputWrap}>
              <span className={s.amountPrefix}>S/</span>
              <input type="text" inputMode="decimal" value={montoValue}
                onChange={e => setMontoValue(sanitizeDecimal(e.target.value))}
                placeholder="0.00" className={s.amountInput} />
            </div>
          </Field>
          <Field label="Método de Pago">
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={inputStyle}>
              <option value="">Sin cambios</option>
              {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <div className={s.modalFooter}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={handleSave}>Guardar</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Cobrar empresa individual ─── */
export function CobrarModal({ movimiento, onClose, onSuccess }) {
  const addToast = useToast();
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (movimiento) setMetodo('EFECTIVO'); }, [movimiento]);

  const handleCobrar = async () => {
    if (!movimiento) return;
    setSubmitting(true);
    try {
      await cobrarMovimientoEmpresa(movimiento.id, metodo);
      addToast('Pago de empresa registrado.', 'success');
      onClose();
      await onSuccess();
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al registrar el pago.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!movimiento} onOpenChange={(o) => !o && onClose()} title="Registrar Pago de Empresa" width={380}>
      {movimiento && (
        <>
          <div className={s.infoMuted}>
            {movimiento.nombreEmpresa} &middot; {movimiento.nombreCliente} &middot; S/ {parseFloat(movimiento.monto).toFixed(2)}
          </div>
          <Field label="Método de Pago" required>
            <select value={metodo} onChange={e => setMetodo(e.target.value)} style={inputStyle}>
              {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <div className={s.modalFooter}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={handleCobrar} disabled={submitting}>Confirmar Pago</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Cobrar lote empresa ─── */
export function CobrarLoteModal({ open, onClose, onSuccess, pendientes, totalPendiente, filtroEmpresaNombre }) {
  const addToast = useToast();
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) setMetodo('EFECTIVO'); }, [open]);

  const handleCobrar = async () => {
    if (pendientes.length === 0) return;
    setSubmitting(true);
    try {
      const ids = pendientes.map(m => m.id);
      await cobrarLoteEmpresaPorIds(ids, metodo);
      addToast(`${pendientes.length} movimiento(s) cobrados correctamente.`, 'success');
      onClose();
      await onSuccess();
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al cobrar en lote.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Cobrar todo lo filtrado" width={420}>
      <div className={s.infoMuted} style={{ marginBottom: 4 }}>
        Se registrarán como <strong>INGRESO</strong> todos los movimientos PENDIENTE
        {filtroEmpresaNombre
          ? <> de <strong>{filtroEmpresaNombre}</strong></>
          : ' visibles en la tabla'
        } en el período seleccionado.
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e65100', marginBottom: 14 }}>
        {pendientes.length} movimiento(s) &middot; Total: S/ {totalPendiente.toFixed(2)}
      </div>
      <Field label="Método de Pago" required>
        <select value={metodo} onChange={e => setMetodo(e.target.value)} style={inputStyle}>
          {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>
      <div className={s.modalFooter}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleCobrar} disabled={submitting}>Confirmar Pago en Lote</Btn>
      </div>
    </Modal>
  );
}
