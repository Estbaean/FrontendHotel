import { useState, useMemo, useEffect } from 'react';
import {
  Btn, Card, Table, tdStyle, EditBtn, DeleteBtn,
  Modal, ConfirmDialog, EmptyState, Pagination,
  Field, inputStyle, inputFocus, inputBlur, SwitchField,
  PageHeader, SearchInput, useToast,
} from './UI/index.jsx';
import { FilterLabel } from './Filters';
import { Plus } from 'lucide-react';
import { COUNTRY_DIAL_OPTIONS, parseIntlPhone, buildIntlPhone } from '../utils/phone';
import s from '../styles/shared.module.css';

const PER_PAGE = 10;

export default function GenericCRUD({
  items, onAdd, onUpdate, onDelete,
  columns, formFields, emptyMsg, emptyIcon,
  modalTitle = 'Registro',
  readOnly = false,
  showVisible = false,
  elevatedInputs = false,
  pageTitle,
  pageSubtitle,
  searchPlaceholder = 'Buscar…',
  searchKeys,
  toolbarPrefix,
  hideToolbarAdd = false,
  triggerNew = 0,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState({});
  const [errors,    setErrors]    = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const addToast = useToast();

  const keys = searchKeys ?? columns.map(c => c.key);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item =>
      keys.some(k => String(item[k] ?? '').toLowerCase().includes(q))
    );
  }, [items, search, keys]);

  const buildEmpty = () => {
    const obj = {};
    if (showVisible) obj.visible = true;
    formFields.forEach(f => {
      if (f.type === 'phoneIntl') {
        obj[f.key] = '';
        obj[`${f.key}Country`] = 'PE';
        return;
      }
      if (f.type === 'optionalSelectToggle') {
        obj[f.key] = '';
        obj[`${f.key}Enabled`] = false;
        return;
      }
      if (!(f.key in obj)) obj[f.key] = '';
    });
    return obj;
  };

  const openNew  = () => { setEditId(null); setForm(buildEmpty()); setErrors({}); setModalOpen(true); };
  useEffect(() => { if (triggerNew > 0) openNew(); }, [triggerNew]);
  const openEdit = (item) => {
    setEditId(item.id);
    const obj = {};
    if (showVisible) obj.visible = item.visible ?? true;
    formFields.forEach(f => {
      if (f.type === 'phoneIntl') {
        const parsed = parseIntlPhone(item[f.key] ?? '');
        obj[f.key] = parsed.number;
        obj[`${f.key}Country`] = parsed.countryCode;
      } else if (f.type === 'optionalSelectToggle') {
        const value = item[f.key] != null ? String(item[f.key]) : '';
        obj[f.key] = value;
        obj[`${f.key}Enabled`] = Boolean(value);
      } else {
        obj[f.key] = item[f.key] ?? '';
      }
    });
    setForm(obj); setErrors({}); setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    formFields.forEach(f => { if (f.required && !String(form[f.key] ?? '').trim()) e[f.key] = `${f.label} es requerido`; });
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const payload = { ...form };
    formFields.forEach((f) => {
      if (f.type === 'phoneIntl') {
        payload[f.key] = buildIntlPhone(form[`${f.key}Country`], form[f.key]);
        delete payload[`${f.key}Country`];
      }
      if (f.type === 'optionalSelectToggle') {
        const enabled = !!form[`${f.key}Enabled`];
        payload[f.key] = enabled && String(form[f.key] ?? '').trim() ? form[f.key] : null;
        delete payload[`${f.key}Enabled`];
      }
      if (f.type === 'number' && payload[f.key] !== '' && payload[f.key] !== null && payload[f.key] !== undefined) {
        const num = Number(payload[f.key]);
        if (!isNaN(num)) payload[f.key] = num;
      }
    });
    setSubmitting(true);
    try {
      editId ? await onUpdate(editId, payload) : await onAdd(payload);
      addToast(editId ? 'Registro actualizado' : 'Registro creado', 'success');
      setModalOpen(false);
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al guardar el registro', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const controlStyle = elevatedInputs
    ? { ...inputStyle, boxShadow: 'var(--shadow-sm)', borderColor: 'var(--border)' }
    : inputStyle;

  return (
    <div className="page-anim">
      {pageTitle && (
        <PageHeader title={pageTitle} subtitle={pageSubtitle ? `${pageSubtitle} · ${filtered.length}` : `${filtered.length}`}>
          {!readOnly && <Btn icon={<Plus size={14}/>} onClick={openNew}>Nuevo</Btn>}
        </PageHeader>
      )}

      <Card padding="12px 16px" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: toolbarPrefix ? 'center' : 'flex-end' }}>
          {toolbarPrefix}
          <div style={{ flex: 1, minWidth: 180 }}>
            {!toolbarPrefix && <FilterLabel small>Buscar</FilterLabel>}
            <SearchInput
              value={search}
              onChange={v => { setSearch(v); setPage(1); }}
              placeholder={searchPlaceholder}
            />
          </div>
          {!pageTitle && !readOnly && !hideToolbarAdd && (
            <Btn icon={<Plus size={14}/>} onClick={openNew} style={{ marginBottom: 1 }}>Nuevo</Btn>
          )}
        </div>
      </Card>

      <Card>
        {paged.length === 0 ? (
          <EmptyState message={emptyMsg} icon={emptyIcon} />
        ) : (
          <Table headers={[...columns.map(c=>c.label),'']}>
            {paged.map(item => (
              <tr key={item.id}>
                {columns.map(col => (
                  <td key={col.key} style={tdStyle}>
                    {col.render ? col.render(item) : (item[col.key] ?? '—')}
                  </td>
                ))}
                <td style={{ ...tdStyle, width: readOnly ? 0 : 80, padding: readOnly ? 0 : 'inherit' }}>
                  {!readOnly && (
                    <div className={s.actionRow}>
                      <EditBtn   onClick={()=>openEdit(item)} />
                      <DeleteBtn onClick={()=>setConfirmId(item.id)} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div style={{ padding:'0 16px 4px' }}>
          <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </div>
      </Card>

{readOnly ? null : (
        <Modal open={modalOpen} onOpenChange={setModalOpen} title={editId ? `Editar ${modalTitle}` : `Nuevo/a ${modalTitle}`} width={460}>
          {formFields.map(f => (
            <Field key={f.key} label={f.label} error={errors[f.key]} required={f.required}>
              {f.type === 'select' ? (
                <select
                  style={controlStyle}
                  value={form[f.key] ?? ''}
                  onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                >
                  <option value="">{f.placeholder || 'Selecciona una opción'}</option>
                  {f.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : f.type === 'optionalSelectToggle' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={!!form[`${f.key}Enabled`]}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setForm((p) => {
                          const next = { ...p, [`${f.key}Enabled`]: enabled };
                          if (!enabled) next[f.key] = '';
                          else if (!next[f.key] && f.options?.length) next[f.key] = f.options[0].value;
                          return next;
                        });
                      }}
                    />
                    {f.toggleLabel || 'Habilitar campo'}
                  </label>
                  <select
                    style={{ ...controlStyle, opacity: form[`${f.key}Enabled`] ? 1 : 0.65, cursor: form[`${f.key}Enabled`] ? 'pointer' : 'not-allowed' }}
                    value={form[f.key] ?? ''}
                    disabled={!form[`${f.key}Enabled`]}
                    onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  >
                    <option value="" disabled>{f.placeholder || 'Selecciona una opción'}</option>
                    {f.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ) : f.type === 'textarea' ? (
                <textarea
                  style={{ ...controlStyle, minHeight: 80, resize: 'vertical' }}
                  value={form[f.key] ?? ''}
                  onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                  rows={f.rows ?? 3}
                />
              ) : f.type === 'phoneIntl' ? (
                <div className={s.phoneGrid}>
                  <select
                    style={controlStyle}
                    value={form[`${f.key}Country`] ?? 'PE'}
                    onChange={e=>setForm(p=>({...p,[`${f.key}Country`]:e.target.value}))}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  >
                    {COUNTRY_DIAL_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>{`${opt.code} ${opt.dialCode}`}</option>
                    ))}
                  </select>
                  <input
                    style={controlStyle}
                    type="text"
                    value={form[f.key] ?? ''}
                    onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.placeholder || 'Número'}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>
              ) : (
                <input
                  style={controlStyle}
                  type={f.type ?? 'text'}
                  value={form[f.key] ?? ''}
                  onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                />
              )}
            </Field>
          ))}
          {showVisible && (
            <Field label="Visible">
              <SwitchField
                checked={!!form.visible}
                onCheckedChange={v=>setForm(p=>({...p,visible:v}))}
                label={form.visible ? 'Visible' : 'Oculto'}
              />
            </Field>
          )}
          <div className={s.modalFooterBorder}>
            <Btn variant="ghost" onClick={()=>setModalOpen(false)}>Cancelar</Btn>
            <Btn onClick={handleSubmit} disabled={submitting}>{editId ? 'Guardar cambios' : 'Crear'}</Btn>
          </div>
        </Modal>
      )}
      {readOnly ? null : (
        <ConfirmDialog
          open={!!confirmId}
          onOpenChange={open=>!open&&setConfirmId(null)}
          onConfirm={async ()=>{ try { await onDelete(confirmId); addToast('Registro eliminado', 'info'); } catch (error) { const msg = error?.response?.data?.message; addToast(msg || 'Error al eliminar', 'error'); } setConfirmId(null); }}
        />
      )}
    </div>
  );
}

