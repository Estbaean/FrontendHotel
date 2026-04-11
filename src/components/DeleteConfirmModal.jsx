import { useState, useEffect } from 'react';
import { Modal, Btn, Field, inputStyle, useToast } from './UI/index.jsx';
import { Trash2, AlertTriangle } from 'lucide-react';
import s from '../styles/shared.module.css';

/**
 * Generic two-step delete modal with preview + keyword confirmation.
 *
 * Props:
 *  - open, onClose, onSuccess  — standard modal lifecycle
 *  - title                     — modal title for step 1 (step 2 always shows "Confirmar eliminación")
 *  - warningText               — body text for the red warning box
 *  - todoLabel / todoDesc      — text for "delete all" radio
 *  - rangoLabel / rangoDesc    — text for "delete by range" radio
 *  - emptyMessage              — toast when preview returns 0
 *  - previewFn(desde?, hasta?) — API call that returns { cantidad, periodo, ...extra }
 *  - deleteFn(desde?, hasta?)  — API call that returns { eliminados, ... }
 *  - entityName                — used in success toast, e.g. "movimiento(s)" → "3 movimiento(s) eliminado(s)"
 *  - renderPreviewExtra(preview) — optional: render extra rows in the preview summary (e.g. totals for caja)
 *  - radioName                 — unique name for radio group to avoid conflicts if multiple modals exist
 */
export default function DeleteConfirmModal({
  open, onClose, onSuccess,
  title = 'Eliminar historial',
  warningText = 'Los registros eliminados no se pueden recuperar.',
  todoLabel = 'Eliminar todo el historial',
  todoDesc = 'Borra todos los registros',
  rangoLabel = 'Eliminar por rango de fechas',
  rangoDesc = 'Solo borra registros dentro de un período específico',
  emptyMessage = 'No hay registros en ese período.',
  previewFn,
  deleteFn,
  entityName = 'registro(s)',
  renderPreviewExtra,
  radioName = 'deleteMode',
}) {
  const addToast = useToast();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const KEYWORD = mode === 'todo' ? 'ELIMINAR TODO' : 'ELIMINAR RANGO';

  useEffect(() => {
    if (open) { setStep(1); setMode('todo'); setDesde(''); setHasta(''); setPreview(null); setConfirmText(''); }
  }, [open]);

  const handlePreview = async () => {
    if (mode === 'rango' && (!desde || !hasta)) {
      addToast('Seleccioná ambas fechas para el rango.', 'error');
      return;
    }
    setPreviewLoading(true);
    try {
      const p = mode === 'rango' ? await previewFn(desde, hasta) : await previewFn();
      if (p.cantidad === 0) { addToast(emptyMessage, 'warning'); return; }
      setPreview(p);
      setConfirmText('');
      setStep(2);
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al obtener preview.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmText !== KEYWORD) return;
    setSubmitting(true);
    try {
      const result = mode === 'rango' ? await deleteFn(desde, hasta) : await deleteFn();
      addToast(`${result.eliminados} ${entityName} eliminado(s).`, 'info');
      onClose();
      await onSuccess();
    } catch (error) {
      addToast(error?.response?.data?.message || 'Error al eliminar.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }}
      title={step === 1 ? title : '⚠️ Confirmar eliminación'} width={520}>
      {step === 1 ? (
        <>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            background: 'var(--red-bg, #fbe9e7)', border: '1.5px solid var(--red, #e53935)',
            borderRadius: 'var(--r-md, 8px)', padding: '12px 16px', marginBottom: 16,
          }}>
            <AlertTriangle size={22} color="var(--red, #e53935)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red, #e53935)', marginBottom: 4 }}>Acción irreversible</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: warningText }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[
              { value: 'todo', label: todoLabel, desc: todoDesc },
              { value: 'rango', label: rangoLabel, desc: rangoDesc },
            ].map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 'var(--r-md, 8px)', cursor: 'pointer',
                border: `1.5px solid ${mode === opt.value ? 'var(--red, #e53935)' : 'var(--border)'}`,
                background: mode === opt.value ? 'var(--red-bg, #fbe9e7)' : 'var(--surface)',
              }}>
                <input type="radio" name={radioName} value={opt.value} checked={mode === opt.value} onChange={() => setMode(opt.value)} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {mode === 'rango' && (
            <div className={s.formGrid2} style={{ marginBottom: 16 }}>
              <Field label="Desde" required>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Hasta" required>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inputStyle} />
              </Field>
            </div>
          )}

          <div className={s.modalFooter} style={{ marginTop: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="danger" onClick={handlePreview}
              disabled={previewLoading || (mode === 'rango' && (!desde || !hasta))}>
              {previewLoading ? 'Cargando...' : 'Ver resumen antes de eliminar'}
            </Btn>
          </div>
        </>
      ) : (
        <>
          {preview && (
            <div style={{
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: 'var(--r-md, 8px)', padding: '16px', marginBottom: 16,
            }}>
              <div className={s.sectionLabel} style={{ marginBottom: 10 }}>Resumen de eliminación</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Período</div>
                <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{preview.periodo}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registros a eliminar</div>
                <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--red, #e53935)' }}>{preview.cantidad}</div>
                {renderPreviewExtra && renderPreviewExtra(preview)}
              </div>
            </div>
          )}

          <div style={{
            background: 'var(--red-bg, #fbe9e7)', border: '1.5px solid var(--red, #e53935)',
            borderRadius: 'var(--r-md, 8px)', padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: 'var(--red, #e53935)', fontWeight: 600, textAlign: 'center',
          }}>
            Esta acción no se puede deshacer
          </div>

          <Field label={<>Para confirmar, escribí <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{KEYWORD}</code></>} required>
            <input type="text" value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              placeholder={KEYWORD}
              style={{ ...inputStyle, borderColor: confirmText === KEYWORD ? 'var(--red, #e53935)' : undefined, fontWeight: 700, letterSpacing: 1 }}
              autoComplete="off" />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => { setStep(1); setConfirmText(''); }}>← Volver</Btn>
            <Btn variant="danger" icon={<Trash2 size={14} />} onClick={handleConfirm}
              disabled={confirmText !== KEYWORD || submitting}>
              {submitting ? 'Eliminando...' : 'Eliminar'}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
