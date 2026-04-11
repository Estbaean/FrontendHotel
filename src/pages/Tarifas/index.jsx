import { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useAuth } from '../../context/AuthContext';
import { Table, Btn, Field, Modal, ConfirmDialog, Card, EmptyState, Pagination, EditBtn, DeleteBtn, PageHeader, tdStyle, inputStyle, useToast } from '../../components/UI/index.jsx';
import PageToolbar from '../../components/PageToolbar';
import { Plus, DollarSign } from 'lucide-react';
import { sanitizeDecimal } from '../../utils/formHelpers';
import styles from './Tarifas.module.css';
import s from '../../styles/shared.module.css';

const PER_PAGE = 12;

export default function Tarifas() {
  const { userRole } = useAuth();
  const { tarifas, tiposHabitacion, tiposAlquiler, addTarifa, updateTarifa, deleteTarifa, incrementarTarifasPorcentaje } = useHotel();
  const addToast = useToast();
  const isAdmin = userRole === 'admin';

  const [filterTipoAlq, setFilterTipoAlq] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ precio: '', tipoHabitacionId: '', tipoAlquilerId: '' });
  const [confirmId, setConfirmId] = useState(null);
  const [errors, setErrors] = useState({});
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [incrementoPorcentaje, setIncrementoPorcentaje] = useState('');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter tarifas
  const filtered = useMemo(() => {
    let result = tarifas;
    if (filterTipoAlq && filterTipoAlq !== '0') {
      result = result.filter(t => t.tipoAlquiler?.id === parseInt(filterTipoAlq));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.tipoHabitacion?.nombre?.toLowerCase().includes(q) ||
        t.tipoAlquiler?.nombre?.toLowerCase().includes(q) ||
        String(t.precio).includes(q)
      );
    }
    return result;
  }, [tarifas, filterTipoAlq, search]);

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openNew = () => {
    setEditId(null);
    setForm({ precio: '', tipoHabitacionId: '', tipoAlquilerId: '' });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      precio: String(item.precio ?? ''),
      tipoHabitacionId: String(item.tipoHabitacion?.id ?? ''),
      tipoAlquilerId: String(item.tipoAlquiler?.id ?? ''),
    });
    setErrors({});
    setModalOpen(true);
  };

  const handlePrecioChange = (rawValue) => {
    setForm((prev) => ({ ...prev, precio: sanitizeDecimal(rawValue) }));
  };

  const validate = () => {
    const errs = {};
    const precioNum = Number(form.precio);
    const habId = Number(form.tipoHabitacionId);
    const alqId = Number(form.tipoAlquilerId);
    
    if (!form.precio || isNaN(precioNum) || precioNum <= 0) errs.precio = 'Precio válido requerido';
    if (!form.tipoHabitacionId || habId <= 0) errs.tipoHabitacionId = 'Seleccione tipo de habitación válido';
    if (!form.tipoAlquilerId || alqId <= 0) errs.tipoAlquilerId = 'Seleccione tipo de alquiler válido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const tipoHabId = Number(form.tipoHabitacionId);
    const tipoAlqId = Number(form.tipoAlquilerId);
    const precioNum = Number(form.precio);
    
    // Double-check IDs are valid numbers before sending
    if (tipoHabId <= 0 || tipoAlqId <= 0 || precioNum <= 0) {
      addToast('Verifica que todos los campos estén correctamente seleccionados', 'error');
      return;
    }

    const payload = {
      precio: precioNum,
      tipoHabitacionId: tipoHabId,
      tipoAlquilerId: tipoAlqId,
    };

    const alreadyExists = tarifas.some((t) => (
      t.tipoHabitacion?.id === payload.tipoHabitacionId
      && t.tipoAlquiler?.id === payload.tipoAlquilerId
      && t.id !== editId
    ));

    if (alreadyExists) {
      addToast('Ya existe una tarifa para esa combinación de habitación y alquiler', 'error');
      return;
    }

    setSubmitting(true);
    try {
      editId ? await updateTarifa(editId, payload) : await addTarifa(payload);
      addToast(editId ? 'Tarifa actualizada' : 'Tarifa creada', 'success');
      setModalOpen(false);
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      addToast(backendMessage || 'Error al guardar la tarifa', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTarifa(confirmId);
      addToast('Tarifa eliminada', 'info');
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      addToast(backendMessage || 'Error al eliminar la tarifa', 'error');
    }
    setConfirmId(null);
  };

  const handleIncrementoMasivo = async () => {
    const porcentaje = Number(incrementoPorcentaje);
    if (!porcentaje || porcentaje <= 0) {
      addToast('Ingrese un porcentaje válido mayor a 0', 'error');
      return;
    }
    setBulkConfirmOpen(true);
  };

  const confirmIncrementoMasivo = async () => {
    setBulkConfirmOpen(false);
    const porcentaje = Number(incrementoPorcentaje);
    try {
      await incrementarTarifasPorcentaje(porcentaje);
      addToast('Tarifas incrementadas correctamente', 'success');
      setBulkModalOpen(false);
      setIncrementoPorcentaje('');
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      addToast(backendMessage || 'No se pudo aplicar el incremento', 'error');
    }
  };

  const tipoAlqOptions = [
    { value: '0', label: 'Todos los Tipos Alq.' },
    ...tiposAlquiler.map(t => ({ value: String(t.id), label: t.nombre })),
  ];

  return (
    <div className="page-anim">
      <PageHeader title="Tarifas" subtitle={`Precios por tipo de habitación y alquiler · ${filtered.length}`}>
        {isAdmin && (
          <>
            <Btn variant="ghost" onClick={() => setBulkModalOpen(true)}>
              Aumentar %
            </Btn>
            <Btn icon={<Plus size={14} />} onClick={openNew}>
              Nueva Tarifa
            </Btn>
          </>
        )}
      </PageHeader>

      <PageToolbar>
        <PageToolbar.Row inline>
          <PageToolbar.Search value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Precio, tipo…" />
          <PageToolbar.Filter label="Tipo de Alquiler" value={filterTipoAlq || '0'} onChange={v => { setFilterTipoAlq(v); setPage(1); }} options={tipoAlqOptions} />
        </PageToolbar.Row>
      </PageToolbar>

      <Card>
        {paged.length === 0 ? (
          <EmptyState
            message="No hay tarifas que coincidan con los filtros"
            icon={<DollarSign size={40} />}
          />
        ) : (
          <Table headers={['Tipo Habitación', 'Tipo Alquiler', 'Precio', '']}>
            {paged.map(tarifa => (
              <tr key={tarifa.id}>
                <td style={tdStyle}>{tarifa.tipoHabitacion?.nombre || '—'}</td>
                <td style={tdStyle}>{tarifa.tipoAlquiler?.nombre || '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', width: 160 }}>
                  <strong style={{ fontSize: 16, color: 'var(--accent-dark)' }}>S/ {Number(tarifa.precio).toFixed(2)}</strong>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {isAdmin && (
                    <div className={s.actionRow}>
                      <EditBtn onClick={() => openEdit(tarifa)} />
                      <DeleteBtn onClick={() => setConfirmId(tarifa.id)} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div style={{ padding: '0 16px 4px' }}>
          <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </div>
      </Card>

      <Modal open={modalOpen && isAdmin} onOpenChange={setModalOpen} title={editId ? 'Editar Tarifa' : 'Nueva Tarifa'}>
        <Field label="Tipo de Habitación" error={errors.tipoHabitacionId} required>
          <select
            value={form.tipoHabitacionId}
            onChange={e => setForm({ ...form, tipoHabitacionId: e.target.value })}
            style={inputStyle}
          >
            <option value="">Seleccione...</option>
            {tiposHabitacion.map(t => <option key={t.id} value={String(t.id)}>{t.nombre}</option>)}
          </select>
        </Field>

        <Field label="Tipo de Alquiler" error={errors.tipoAlquilerId} required>
          <select
            value={form.tipoAlquilerId}
            onChange={e => setForm({ ...form, tipoAlquilerId: e.target.value })}
            style={inputStyle}
          >
            <option value="">Seleccione...</option>
            {tiposAlquiler.map(t => <option key={t.id} value={String(t.id)}>{t.nombre}</option>)}
          </select>
        </Field>

        <Field label="Precio (S/)" error={errors.precio} required>
          <div className={styles.priceInputWrap}>
            <span className={styles.pricePrefix}>S/</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.precio}
              onChange={e => handlePrecioChange(e.target.value)}
              placeholder="0.00"
              className={styles.priceInput}
            />
          </div>
        </Field>

        <div className={s.modalFooter}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Btn>
          <Btn onClick={handleSubmit} disabled={submitting}>{editId ? 'Actualizar' : 'Crear'}</Btn>
        </div>
      </Modal>

      <Modal open={bulkModalOpen && isAdmin} onOpenChange={setBulkModalOpen} title="Aumentar tarifas por porcentaje">
        <Field label="Porcentaje (%)" required>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={incrementoPorcentaje}
            onChange={(e) => setIncrementoPorcentaje(e.target.value)}
            placeholder="Ej: 8"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', fontSize: 14,
              color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit',
            }}
          />
        </Field>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>
          Esta acción incrementa todas las tarifas actuales con el porcentaje indicado.
        </p>
        <div className={s.modalFooter}>
          <Btn variant="ghost" onClick={() => setBulkModalOpen(false)}>Cancelar</Btn>
          <Btn onClick={handleIncrementoMasivo}>Aplicar incremento</Btn>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={setConfirmId}
        onConfirm={handleDelete}
        message="¿Eliminar esta tarifa? Esta acción no se puede deshacer."
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        onConfirm={confirmIncrementoMasivo}
        title="Incremento masivo"
        confirmLabel="Sí, aplicar"
        variant="primary"
        message={`¿Confirmar aumento de ${incrementoPorcentaje}% en TODAS las tarifas? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}

