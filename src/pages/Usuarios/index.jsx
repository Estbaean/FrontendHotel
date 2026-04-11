import { useState, useEffect, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { Table, Btn, Field, Modal, ConfirmDialog, EmptyState, Pagination, Card, tdStyle, inputStyle, PageHeader, useToast } from '../../components/UI/index.jsx';
import PageToolbar from '../../components/PageToolbar';
import { UserCog, Plus, KeyRound } from 'lucide-react';
import { getRecepcionistas, postRecepcionista, putRecepcionista, resetRecepcionistaPassword } from '../../api/usuarios';
import { COUNTRY_DIAL_OPTIONS, parseIntlPhone, buildIntlPhone } from '../../utils/phone';
import { buildTiposDocPermitidos } from '../../utils/formHelpers';
import s from '../../styles/shared.module.css';

const PER_PAGE = 10;

export default function Usuarios() {
  const { tiposDocumento } = useHotel();
  const addToast = useToast();
  const tiposDocumentoPermitidos = useMemo(() => buildTiposDocPermitidos(tiposDocumento), [tiposDocumento]);

  const [recepcionistas, setRecepcionistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterTipoDoc, setFilterTipoDoc] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);

  // Reset password modal
  const [resetModal, setResetModal] = useState(null); // user id
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await getRecepcionistas();
        if (!alive) return;
        setRecepcionistas(Array.isArray(data) ? data : []);
      } catch {
        if (!alive) return;
        setRecepcionistas([]);
        addToast('No se pudo cargar recepcionistas desde el backend.', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [addToast]);

  const openNew = () => {
    setEditId(null);
    setForm({
      nombre: '',
      numDocumento: '',
      password: '',
      telefono: '',
      telefonoCountry: 'PE',
      tipoDocumento: tiposDocumentoPermitidos[0]?.nombre || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (user) => {
    const parsedPhone = parseIntlPhone(user.telefono || '');
    setEditId(user.id);
    setForm({
      nombre: user.nombre,
      telefono: parsedPhone.number,
      telefonoCountry: parsedPhone.countryCode,
      tipoDocumento: user.tipoDocumento?.nombre || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.nombre?.trim()) e.nombre = 'Nombre requerido';
    if (!editId) {
      if (!form.numDocumento?.trim()) e.numDocumento = 'N° Documento requerido';
      if (!form.password?.trim()) e.password = 'Contraseña requerida';
    }
    if (!form.tipoDocumento) e.tipoDocumento = 'Tipo documento requerido';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const telefonoCompleto = buildIntlPhone(form.telefonoCountry, form.telefono);
      if (editId) {
        const payload = { nombre: form.nombre, telefono: telefonoCompleto, tipoDocumento: form.tipoDocumento };
        try {
          const updated = await putRecepcionista(editId, payload);
          setRecepcionistas(p => p.map(r => r.id === editId ? updated : r));
          addToast('Recepcionista actualizado.', 'success');
        } catch (error) {
          const msg = error?.response?.data?.message;
          addToast(msg || 'No se pudo actualizar. Verifica backend/permisos.', 'error');
          return;
        }
      } else {
        const payload = {
          nombre: form.nombre,
          numDocumento: form.numDocumento,
          password: form.password,
          telefono: telefonoCompleto,
          tipoDocumento: form.tipoDocumento,
        };
        try {
          const created = await postRecepcionista(payload);
          setRecepcionistas(p => [...p, created]);
          addToast('Recepcionista creado.', 'success');
        } catch (error) {
          const msg = error?.response?.data?.message;
          addToast(msg || 'No se pudo crear. Verifica backend/permisos.', 'error');
          return;
        }
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || !resetModal) return;
    try {
      await resetRecepcionistaPassword(resetModal, newPassword);
      addToast('Contraseña reseteada.', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'No se pudo resetear contraseña.', 'error');
      return;
    }
    setResetModal(null);
    setNewPassword('');
  };

  const filtered = useMemo(() => {
    let list = recepcionistas;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.nombre?.toLowerCase().includes(q) ||
        u.numDocumento?.toLowerCase().includes(q) ||
        u.telefono?.toLowerCase().includes(q)
      );
    }
    if (filterTipoDoc) list = list.filter(u => u.tipoDocumento?.nombre === filterTipoDoc);
    return list;
  }, [recepcionistas, search, filterTipoDoc]);

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="page-anim">
      <PageHeader title="Usuarios" subtitle={`Gestión de recepcionistas · ${filtered.length}`}>
        <Btn icon={<Plus size={14} />} onClick={openNew}>Nuevo Recepcionista</Btn>
      </PageHeader>

      <PageToolbar>
        <PageToolbar.Row inline>
          <PageToolbar.Search value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Nombre, documento, teléfono…" />
          <PageToolbar.Filter label="Tipo documento" value={filterTipoDoc} onChange={v => { setFilterTipoDoc(v); setPage(1); }} options={tiposDocumentoPermitidos.map(td => ({ value: td.nombre, label: td.nombre }))} placeholder="Todos" />
        </PageToolbar.Row>
      </PageToolbar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-2)', fontSize: 14 }}>Cargando recepcionistas…</div>
      ) : paged.length === 0 ? (
        <EmptyState message="No hay recepcionistas en backend" icon={<UserCog size={48} />} />
      ) : (
        <Card>
          <Table headers={['Nombre', 'Documento', 'Tipo Doc.', 'Teléfono', 'Rol', '']}>
            {paged.map(u => (
              <tr key={u.id}
              >
                <td style={tdStyle}><span style={{ fontWeight: 600 }}>{u.nombre}</span></td>
                <td style={tdStyle}>{u.numDocumento}</td>
                <td style={tdStyle}>{u.tipoDocumento?.nombre || '—'}</td>
                <td style={tdStyle}>{u.telefono || '—'}</td>
                <td style={tdStyle}>
                  <span className={s.badgeAccent}>
                    Recepcionista
                  </span>
                </td>
                <td style={{ ...tdStyle, width: 140 }}>
                  <div className={s.actionRow}>
                    <Btn variant="ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => openEdit(u)}>Editar</Btn>
                    <Btn variant="ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => { setResetModal(u.id); setNewPassword(''); }}
                      icon={<KeyRound size={12} />}>
                      Clave
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <div style={{ padding: '0 16px 4px' }}>
            <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editId ? 'Editar Recepcionista' : 'Nuevo Recepcionista'} width={440}>
        <Field label="Nombre completo" error={errors.nombre} required>
          <input style={inputStyle} value={form.nombre || ''} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre del recepcionista" />
        </Field>
        {!editId && (
          <>
            <Field label="N° Documento" error={errors.numDocumento} required>
              <input style={inputStyle} value={form.numDocumento || ''} onChange={e => setForm(p => ({ ...p, numDocumento: e.target.value }))} placeholder="Documento de identidad" />
            </Field>
            <Field label="Contraseña" error={errors.password} required>
              <input style={inputStyle} type="password" value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Contraseña inicial" />
            </Field>
          </>
        )}
        <Field label="Tipo Documento" error={errors.tipoDocumento} required>
          <select style={inputStyle} value={form.tipoDocumento || ''} onChange={e => setForm(p => ({ ...p, tipoDocumento: e.target.value }))}>
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
              value={form.telefonoCountry || 'PE'}
              onChange={e => setForm(p => ({ ...p, telefonoCountry: e.target.value }))}
            >
              {COUNTRY_DIAL_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
            <input
              style={inputStyle}
              value={form.telefono || ''}
              onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              placeholder="Número"
            />
          </div>
        </Field>
        <div className={s.modalFooter}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Btn>
          <Btn onClick={handleSubmit} disabled={submitting}>{editId ? 'Guardar cambios' : 'Crear'}</Btn>
        </div>
      </Modal>

      {/* Reset Password Modal — ResetPasswordRequestDTO: {newPassword} */}
      <Modal open={!!resetModal} onOpenChange={(open) => !open && setResetModal(null)} title="Resetear Contraseña" width={380}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Asigna una nueva contraseña para este recepcionista.
        </p>
        <Field label="Nueva contraseña" required>
          <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva contraseña" />
        </Field>
        <div className={s.modalFooter}>
          <Btn variant="ghost" onClick={() => setResetModal(null)}>Cancelar</Btn>
          <Btn onClick={handleResetPassword}>Resetear</Btn>
        </div>
      </Modal>
    </div>
  );
}
