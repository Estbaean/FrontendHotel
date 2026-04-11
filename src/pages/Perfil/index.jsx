import { useState, useCallback, useEffect } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useAuth } from '../../context/AuthContext';
import { Card, Field, Btn, Modal, useToast } from '../../components/UI/index.jsx';
import { User, KeyRound, Pencil } from 'lucide-react';
import { getMe, updateMe, changePassword } from '../../api/usuarios';
import { COUNTRY_DIAL_OPTIONS, parseIntlPhone, buildIntlPhone } from '../../utils/phone';
import { buildTiposDocPermitidos } from '../../utils/formHelpers';
import s from '../../styles/shared.module.css';

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 'var(--r-md, 8px)',
  border: '1px solid var(--border)', fontSize: 14,
  color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit',
};

export default function Perfil() {
  const { userName, userRole } = useAuth();
  const { tiposDocumento } = useHotel();
  const addToast = useToast();
  const tiposDocumentoPermitidos = buildTiposDocPermitidos(tiposDocumento);

  const [perfil, setPerfil] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await getMe();
        if (!alive) return;
        setPerfil(me);
      } catch {
        if (alive) addToast('Error al cargar perfil', 'error');
      } finally {
        if (alive) setLoadingProfile(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Edit profile modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});

  // Change password modal
  const [passOpen, setPassOpen] = useState(false);
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });
  const [passErrors, setPassErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const openEditProfile = () => {
    if (!perfil) return;
    const parsedPhone = parseIntlPhone(perfil.telefono || '');
    setEditForm({
      nombre: perfil.nombre,
      telefono: parsedPhone.number,
      telefonoCountry: parsedPhone.countryCode,
      numDocumento: perfil.numDocumento,
      tipoDocumento: perfil.tipoDocumento?.nombre || tiposDocumentoPermitidos[0]?.nombre || '',
    });
    setEditErrors({});
    setEditOpen(true);
  };

  const handleEditSubmit = useCallback(async () => {
    const e = {};
    if (!editForm.nombre?.trim()) e.nombre = 'Nombre requerido';
    if (!editForm.tipoDocumento) e.tipoDocumento = 'Tipo documento requerido';
    setEditErrors(e);
    if (Object.keys(e).length) return;

    // ActualizarPerfilRequestDTO: {nombre, telefono, numDocumento, tipoDocumento}
    const telefonoCompleto = buildIntlPhone(editForm.telefonoCountry, editForm.telefono);
    const payload = {
      nombre: editForm.nombre,
      telefono: telefonoCompleto,
      numDocumento: editForm.numDocumento,
      tipoDocumento: editForm.tipoDocumento || null,
    };
    setSubmitting(true);
    try {
      const updated = await updateMe(payload);
      setPerfil(updated);
      setEditOpen(false);
      addToast('Perfil actualizado', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al actualizar perfil', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [editForm, tiposDocumento]);

  const handleChangePassword = useCallback(async () => {
    const e = {};
    if (!passForm.currentPassword?.trim()) e.currentPassword = 'Requerido';
    if (!passForm.newPassword?.trim()) e.newPassword = 'Requerido';
    else if (passForm.newPassword.length < 6) e.newPassword = 'Mínimo 6 caracteres';
    if (!passForm.confirmPassword?.trim()) e.confirmPassword = 'Requerido';
    else if (passForm.newPassword !== passForm.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
    setPassErrors(e);
    if (Object.keys(e).length) return;

    // CambiarPasswordRequestDTO: {currentPassword, newPassword}
    setSubmitting(true);
    try {
      await changePassword({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword });
      setPassOpen(false);
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      addToast('Contraseña cambiada con éxito', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al cambiar contraseña', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [passForm]);

  return (
    <div className="page-anim">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Mi Perfil</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>Datos de tu cuenta</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn icon={<Pencil size={14} />} onClick={openEditProfile}>Editar Perfil</Btn>
          <Btn icon={<KeyRound size={14} />} variant="ghost" onClick={() => { setPassOpen(true); setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setPassErrors({}); }}>Cambiar Contraseña</Btn>
        </div>
      </div>

      {loadingProfile ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando perfil…</p>
      ) : !perfil ? (
        <p style={{ color: 'var(--red, #e53935)' }}>No se pudo cargar el perfil.</p>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Profile Card */}
        <Card padding="28px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-light)',
              border: '2px solid var(--accent-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={24} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{perfil.nombre}</div>
              <span style={{
                padding: '2px 10px', borderRadius: 'var(--r-sm, 4px)', fontSize: 11, fontWeight: 600,
                background: perfil.rol?.nombre === 'ROLE_ADMINISTRADOR' ? 'var(--accent-light, #e3f2fd)' : 'var(--green-bg, #e8f5e9)',
                color: perfil.rol?.nombre === 'ROLE_ADMINISTRADOR' ? 'var(--accent)' : 'var(--green, #43a047)',
              }}>
                {perfil.rol?.nombre === 'ROLE_ADMINISTRADOR' ? 'Administrador' : 'Recepcionista'}
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <InfoRow label="N° Documento" value={`${perfil.tipoDocumento?.nombre || ''} ${perfil.numDocumento}`} />
            <InfoRow label="Teléfono" value={perfil.telefono || '—'} />
          </div>
        </Card>
      </div>
      )}

      {/* Edit Profile Modal — ActualizarPerfilRequestDTO */}
      <Modal open={editOpen} onOpenChange={setEditOpen} title="Editar Perfil" width={420}>
        <Field label="Nombre" error={editErrors.nombre} required>
          <input style={inputStyle} value={editForm.nombre || ''} onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))} />
        </Field>
        <Field label="N° Documento">
          <input style={inputStyle} value={editForm.numDocumento || ''} onChange={e => setEditForm(p => ({ ...p, numDocumento: e.target.value }))} />
        </Field>
        <Field label="Tipo Documento">
          <select style={inputStyle} value={editForm.tipoDocumento || ''} onChange={e => setEditForm(p => ({ ...p, tipoDocumento: e.target.value }))}>
            <option value="" disabled>Seleccionar...</option>
            {tiposDocumentoPermitidos.map(td => (
              <option key={td.id} value={td.nombre}>{td.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label="Teléfono">
          <div className={s.phoneGrid}>
            <select
              style={inputStyle}
              value={editForm.telefonoCountry || 'PE'}
              onChange={e => setEditForm(p => ({ ...p, telefonoCountry: e.target.value }))}
            >
              {COUNTRY_DIAL_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
            <input
              style={inputStyle}
              value={editForm.telefono || ''}
              onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
              placeholder="Número"
            />
          </div>
        </Field>
        <div className={s.modalFooter}>
          <Btn variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Btn>
          <Btn onClick={handleEditSubmit} disabled={submitting}>Guardar cambios</Btn>
        </div>
      </Modal>

      {/* Change Password Modal — CambiarPasswordRequestDTO */}
      <Modal open={passOpen} onOpenChange={setPassOpen} title="Cambiar Contraseña" width={380}>
        <Field label="Contraseña actual" error={passErrors.currentPassword} required>
          <input style={inputStyle} type="password" value={passForm.currentPassword} onChange={e => setPassForm(p => ({ ...p, currentPassword: e.target.value }))} />
        </Field>
        <Field label="Nueva contraseña" error={passErrors.newPassword} required>
          <input style={inputStyle} type="password" value={passForm.newPassword} onChange={e => setPassForm(p => ({ ...p, newPassword: e.target.value }))} />
        </Field>
        <Field label="Confirmar nueva contraseña" error={passErrors.confirmPassword} required>
          <input style={inputStyle} type="password" value={passForm.confirmPassword || ''} onChange={e => setPassForm(p => ({ ...p, confirmPassword: e.target.value }))} />
        </Field>
        <div className={s.modalFooter}>
          <Btn variant="ghost" onClick={() => setPassOpen(false)}>Cancelar</Btn>
          <Btn onClick={handleChangePassword} disabled={submitting}>Cambiar</Btn>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className={s.summaryLabel}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}
