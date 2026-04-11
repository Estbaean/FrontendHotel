import { useState, useMemo, useEffect } from 'react';
import { useHotel } from '../context/HotelContext.jsx';
import { useAuth } from '../context/AuthContext';
import { Field, Btn, Modal, inputStyle, useToast } from './UI/index.jsx';
import { COUNTRY_DIAL_OPTIONS, parseIntlPhone, buildIntlPhone } from '../utils/phone';
import { buildTiposDocPermitidos } from '../utils/formHelpers';
import s from '../styles/shared.module.css';

export default function ClienteFormModal({ open, onOpenChange, cliente, onSaved }) {
  const { userRole } = useAuth();
  const { addCliente, updateCliente, empresas, tiposDocumento } = useHotel();
  const addToast = useToast();
  const isAdmin = userRole === 'admin';
  const isEdit = Boolean(cliente);

  const tiposDocumentoPermitidos = useMemo(
    () => buildTiposDocPermitidos(tiposDocumento),
    [tiposDocumento],
  );

  const [form, setForm] = useState({
    nombre: '',
    numDocumento: '',
    tipoDocumento: '',
    telefono: '',
    telefonoCountry: 'PE',
    empresaEnabled: false,
    empresaId: '',
  });
  const [editOriginalHadEmpresa, setEditOriginalHadEmpresa] = useState(false);
  const [errors, setErrors] = useState({});

  // Sync form when modal opens or cliente changes
  useEffect(() => {
    if (!open) return;
    if (cliente) {
      const parsed = parseIntlPhone(cliente.telefono || '');
      const rawEmpresaId = cliente.empresaId
        ? String(cliente.empresaId)
        : (cliente.empresaNombre
            ? String(empresas.find((e) => e.nombre === cliente.empresaNombre)?.id || '')
            : '');
      // Si el empresaId no está en la lista (ej: placeholder "EMPRESA ELIMINADA"), ignorarlo
      const empresaId = empresas.some((e) => String(e.id) === rawEmpresaId) ? rawEmpresaId : '';
      const hadEmpresa = Boolean(empresaId);
      setEditOriginalHadEmpresa(hadEmpresa);
      setForm({
        nombre: cliente.nombre || '',
        numDocumento: cliente.numDocumento || '',
        tipoDocumento: cliente.tipoDocumento?.nombre
          || (typeof cliente.tipoDocumento === 'string' ? cliente.tipoDocumento : '')
          || tiposDocumentoPermitidos[0]?.nombre
          || '',
        telefono: parsed.number,
        telefonoCountry: parsed.countryCode,
        empresaEnabled: hadEmpresa,
        empresaId,
      });
    } else {
      setEditOriginalHadEmpresa(false);
      setForm({
        nombre: '',
        numDocumento: '',
        tipoDocumento: tiposDocumentoPermitidos[0]?.nombre || '',
        telefono: '',
        telefonoCountry: 'PE',
        empresaEnabled: false,
        empresaId: '',
      });
    }
    setErrors({});
  }, [open, cliente, empresas, tiposDocumentoPermitidos]);

  const validate = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Nombre requerido';
    if (!form.tipoDocumento) {
      e.tipoDocumento = 'Tipo de documento requerido';
    }
    const doc = form.numDocumento.trim();
    if (!doc) {
      e.numDocumento = 'Número de documento requerido';
    } else {
      const tipo = form.tipoDocumento?.toUpperCase();
      if (tipo === 'DNI' && !/^\d{8}$/.test(doc)) {
        e.numDocumento = 'DNI debe tener exactamente 8 dígitos';
      } else if (tipo === 'CE' && !/^[A-Za-z0-9]{8,12}$/.test(doc)) {
        e.numDocumento = 'CE debe tener entre 8 y 12 caracteres alfanuméricos';
      } else if (tipo === 'PASAPORTE' && !/^[A-Za-z0-9]{6,12}$/.test(doc)) {
        e.numDocumento = 'Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos';
      }
    }
    if (form.telefono.trim()) {
      const digits = form.telefono.replace(/\D/g, '');
      if (digits.length < 6 || digits.length > 15) {
        e.telefono = 'Teléfono debe tener entre 6 y 15 dígitos';
      }
    }
    if (form.empresaEnabled && !form.empresaId) e.empresaId = 'Seleccione una empresa';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const selectedTipo = tiposDocumentoPermitidos.find((td) => td.nombre === form.tipoDocumento);
    if (!selectedTipo) {
      addToast('Tipo de documento inválido', 'error');
      return;
    }

    const telefono = buildIntlPhone(form.telefonoCountry, form.telefono);
    const payload = {
      nombre: form.nombre.trim(),
      numDocumento: form.numDocumento.trim(),
      telefono,
      tipoDocumento: { id: selectedTipo.id, nombre: selectedTipo.nombre },
      empresaId: form.empresaEnabled && form.empresaId ? Number(form.empresaId) : null,
    };

    try {
      let saved;
      if (isEdit) {
        saved = await updateCliente(cliente.id, payload);
        addToast('Cliente actualizado', 'success');
      } else {
        saved = await addCliente(payload);
        addToast('Cliente creado', 'success');
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || (isEdit ? 'Error al actualizar cliente' : 'Error al guardar cliente'), 'error');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
      width={400}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Field label="Nombre" error={errors.nombre} required>
          <input
            style={inputStyle}
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            placeholder="Nombre completo"
          />
        </Field>

        <Field label="Tipo de documento" error={errors.tipoDocumento} required>
          <select
            style={inputStyle}
            value={form.tipoDocumento}
            onChange={(e) => setForm((p) => ({ ...p, tipoDocumento: e.target.value }))}
          >
            {tiposDocumentoPermitidos.map((td) => (
              <option key={td.id} value={td.nombre}>{td.nombre}</option>
            ))}
          </select>
        </Field>

        <Field label="Número de documento" error={errors.numDocumento} required>
          <input
            style={inputStyle}
            value={form.numDocumento}
            onChange={(e) => setForm((p) => ({ ...p, numDocumento: e.target.value }))}
            placeholder="DNI / CE / PASAPORTE"
          />
        </Field>

        <Field label="Teléfono" error={errors.telefono}>
          <div className={s.phoneGrid}>
            <select
              style={inputStyle}
              value={form.telefonoCountry}
              onChange={(e) => setForm((p) => ({ ...p, telefonoCountry: e.target.value }))}
            >
              {COUNTRY_DIAL_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input
              style={inputStyle}
              value={form.telefono}
              onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
              placeholder="Número"
            />
          </div>
        </Field>

        <Field label="Empresa" error={errors.empresaId}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={form.empresaEnabled}
                disabled={!isAdmin && isEdit && editOriginalHadEmpresa}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  if (!isAdmin && isEdit && editOriginalHadEmpresa && !enabled) return;
                  setForm((p) => ({
                    ...p,
                    empresaEnabled: enabled,
                    empresaId: enabled
                      ? (p.empresaId || (empresas[0] ? String(empresas[0].id) : ''))
                      : '',
                  }));
                }}
              />
              Pertenece a una empresa
            </label>
            {!isAdmin && isEdit && form.empresaEnabled && !editOriginalHadEmpresa && (
              <div style={{
                background: 'rgba(220,38,38,.10)',
                border: '1px solid rgba(220,38,38,.35)',
                borderRadius: 'var(--r-sm, 6px)',
                padding: '8px 12px',
                fontSize: 11.5,
                color: '#e57373',
                fontWeight: 500,
                lineHeight: 1.45,
              }}>
                ⚠ <strong>Irreversible:</strong> una vez guardado, solo un administrador podrá quitar o cambiar la empresa de este cliente.
              </div>
            )}
            {!isAdmin && isEdit && editOriginalHadEmpresa && (
              <span style={{ fontSize: 11, color: 'var(--text-xmuted)' }}>
                Solo un administrador puede quitar la empresa
              </span>
            )}
            <select
              style={{
                ...inputStyle,
                opacity: (form.empresaEnabled && (isAdmin || !editOriginalHadEmpresa)) ? 1 : 0.65,
                cursor: (form.empresaEnabled && (isAdmin || !editOriginalHadEmpresa)) ? 'pointer' : 'not-allowed',
              }}
              value={form.empresaId}
              disabled={!form.empresaEnabled || (!isAdmin && editOriginalHadEmpresa)}
              onChange={(e) => setForm((p) => ({ ...p, empresaId: e.target.value }))}
            >
              <option value="" disabled>Selecciona una empresa</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>{emp.nombre} ({emp.ruc})</option>
              ))}
            </select>
          </div>
        </Field>

        <div className={s.modalFooter}>
          <Btn onClick={handleSubmit}>Guardar</Btn>
        </div>
      </div>
    </Modal>
  );
}
