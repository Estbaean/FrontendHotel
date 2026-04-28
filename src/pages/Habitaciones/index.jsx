import { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useAuth } from '../../context/AuthContext';
import { ESTADOS } from '../../constants/estados';
import {
  Btn, Badge, Card, Table, tdStyle, EditBtn, DeleteBtn,
  Modal, ConfirmDialog, RSelect,
  EmptyState, Pagination, Field, inputStyle, inputFocus, inputBlur,
  useToast, PopoverMenu, PageHeader,
} from '../../components/UI/index.jsx';
import PageToolbar from '../../components/PageToolbar';
import { Plus, BedDouble, FileText } from 'lucide-react';
import { getReporteMensualHabitacion } from '../../api/alquileres';
import { generarReporteMensualHabitacion } from '../../utils/reportesPdf';
import s from '../../styles/shared.module.css';

const PER_PAGE = 8;
const empty = { numero:'', piso:'', tipoHabitacionId:'', descripcion:'', estado:'DISPONIBLE' };

export default function Habitaciones() {
  const { userRole } = useAuth();
  const { habitaciones, tiposHabitacion, pisos, addHabitacion, updateHabitacion, deleteHabitacion, cambiarEstado } = useHotel();
  const readOnly = userRole === 'recepcion';
  const addToast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(empty);
  const [errors,    setErrors]    = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [estadoConfirm, setEstadoConfirm] = useState(null); // { id, estado, msg }
  const [page,      setPage]      = useState(1);
  const [fEstado,   setFEstado]   = useState('');
  const [fPiso,     setFPiso]     = useState('');

  const [busqueda,  setBusqueda]  = useState('');

  const [reporteMensualHab, setReporteMensualHab] = useState(null);
  const [reporteMes, setReporteMes] = useState(String(new Date().getMonth() + 1));
  const [reporteAnio, setReporteAnio] = useState(String(new Date().getFullYear()));
  const [reporteLoading, setReporteLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setEditId(null); setForm(empty); setErrors({}); setModalOpen(true); };
  const openEdit = (h) => {
    setEditId(h.id);
    setForm({
      numero: h.numero,
      piso: String(h.piso),
      tipoHabitacionId: String(h.tipoHabitacion?.id || ''),
      descripcion: h.descripcion || '',
      estado: h.estado,
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.numero.trim()) e.numero = 'Campo requerido';
    if (form.piso === '')    e.piso = 'Selecciona un piso';
    if (!form.tipoHabitacionId) e.tipoHabitacionId = 'Selecciona un tipo';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const tipoHab = tiposHabitacion.find(t => String(t.id) === form.tipoHabitacionId);
    const payload = {
      numero: form.numero.trim(),
      piso: Number(form.piso),
      descripcion: form.descripcion,
      estado: form.estado,
      tipoHabitacion: tipoHab
        ? { id: tipoHab.id, nombre: tipoHab.nombre }
        : { id: Number(form.tipoHabitacionId) },
    };

    setSubmitting(true);
    try {
      editId ? await updateHabitacion(editId, payload) : await addHabitacion(payload);
      addToast(editId ? 'Habitación actualizada' : 'Habitación creada', 'success');
      setModalOpen(false);
    } catch (error) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message;
      if (status === 409) {
        addToast(msg || 'Conflicto: verifica que el número no esté duplicado y que todos los campos sean válidos.', 'error');
      } else {
        addToast(msg || 'Error al guardar la habitación', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = habitaciones.filter(h => {
    const tipoNombre = h.tipoHabitacion?.nombre || '';
    return (!fEstado || h.estado === fEstado)
      && (!fPiso    || String(h.piso) === fPiso)
      && (!busqueda || h.numero.toLowerCase().includes(busqueda.toLowerCase()) || tipoNombre.toLowerCase().includes(busqueda.toLowerCase()));
  });

  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const ESTADO_KEYS = Object.keys(ESTADOS);
  const handleEstadoChange = (id, nuevoEstado) => {
    const hab = habitaciones.find(h => h.id === id);
    setEstadoConfirm({ id, estado: nuevoEstado, msg: `¿Cambiar estado de Hab. ${hab?.numero || ''} a ${nuevoEstado}?` });
  };
  const confirmEstadoChange = async () => {
    if (!estadoConfirm) return;
    try {
      await cambiarEstado(estadoConfirm.id, estadoConfirm.estado);
      addToast(`Estado cambiado a ${estadoConfirm.estado}`, 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al cambiar el estado', 'error');
    }
    setEstadoConfirm(null);
  };

  const handleGenerarReporteMensual = async () => {
    if (!reporteMensualHab) return;
    setReporteLoading(true);
    try {
      const alqs = await getReporteMensualHabitacion(reporteMensualHab.id, Number(reporteMes), Number(reporteAnio));
      generarReporteMensualHabitacion(reporteMensualHab, alqs, Number(reporteMes), Number(reporteAnio));
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al generar el reporte', 'error');
    } finally {
      setReporteLoading(false);
      setReporteMensualHab(null);
    }
  };

  return (
    <div className="page-anim">
      <PageHeader title="Habitaciones" subtitle={`Gestión de habitaciones · ${filtered.length}`}>
        {!readOnly && <Btn icon={<Plus size={14}/>} onClick={openNew}>Nueva habitación</Btn>}
      </PageHeader>

      {/* Filtros */}
      <PageToolbar>
        <PageToolbar.Row inline>
          <PageToolbar.Search value={busqueda} onChange={v=>{setBusqueda(v); setPage(1);}} placeholder="Número de habitación…" />
          <PageToolbar.Filter label="Estado" value={fEstado} onChange={v=>{setFEstado(v); setPage(1);}} placeholder="Todos" options={ESTADO_KEYS.map(k=>({value:k,label:k}))} />
          <PageToolbar.Filter label="Piso" value={fPiso} onChange={v=>{setFPiso(v); setPage(1);}} placeholder="Todos" options={pisos.map(p=>({value:String(p),label:`Piso ${p}`}))} />
        </PageToolbar.Row>
      </PageToolbar>

      <Card>
        {paged.length === 0 ? (
          <EmptyState message="No se encontraron habitaciones" icon={<BedDouble size={40}/>} />
        ) : (
          <Table headers={['Nro','Número','Tipo','Piso','Estado','']}>
            {paged.map((hab, idx) => {
              const est = ESTADOS[hab.estado] || ESTADOS.DISPONIBLE;
              return (
                <tr key={hab.id}
                >
                  <td style={{ ...tdStyle, color:'var(--text-xmuted)', width:36, fontSize:12 }}>{(page-1)*PER_PAGE+idx+1}</td>
                  <td style={{ ...tdStyle, fontWeight:700 }}>{hab.numero}</td>
                  <td style={tdStyle}><span style={{ fontSize:12.5 }}>{hab.tipoHabitacion?.nombre ?? '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize:12.5 }}>Piso {hab.piso}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <Badge label={est.label} color={est.color} bg={est.bg} border={est.border} dot={est.dot} />
                      <PopoverMenu
                        trigger={
                          <button style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--orange-bg)', color:'var(--orange)', border:'1px solid var(--orange-border)', borderRadius:'var(--r-sm)', padding:'3px 9px', fontSize:10.5, fontWeight:700, cursor:'pointer' }}>
                            ⚙ Cambiar
                          </button>
                        }
                      >
                        <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:140 }}>
                          {ESTADO_KEYS.filter(k => k !== hab.estado).map(k => {
                            const e = ESTADOS[k];
                            return (
                              <button
                                key={k}
                                onClick={() => handleEstadoChange(hab.id, k)}
                                style={{
                                  display:'flex', alignItems:'center', gap:8,
                                  padding:'7px 10px', borderRadius:'var(--r-sm)',
                                  border:'none', background:'transparent', cursor:'pointer',
                                  fontSize:12.5, fontWeight:600, color: e.color,
                                  textAlign:'left', width:'100%',
                                  transition:'background .12s',
                                }}
                                onMouseEnter={ev => ev.currentTarget.style.background = e.bg}
                                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                              >
                                <span style={{ width:8, height:8, borderRadius:'50%', background:e.dot, flexShrink:0 }} />
                                {e.label}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverMenu>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, width: 'auto' }}>
                    <div className={s.actionRow} style={{ flexWrap:'wrap' }}>
                      <Btn variant="ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                        icon={<FileText size={12} />}
                        onClick={() => setReporteMensualHab(hab)}
                        title="Reporte de alquileres finalizados por habitación">
                      </Btn>
                      {!readOnly && (
                        <>
                          <EditBtn   onClick={()=>openEdit(hab)} />
                          <DeleteBtn onClick={()=>setConfirmId(hab.id)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        <div style={{ padding:'0 16px 4px' }}>
          <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </div>
      </Card>

      {readOnly ? null : (
        <>
          {/* MODAL */}
          <Modal open={modalOpen} onOpenChange={setModalOpen} title={editId ? 'Editar habitación' : 'Nueva habitación'} width={520}>
            <Field label="Número" error={errors.numero} required>
              <input style={inputStyle} value={form.numero} onChange={e=>set('numero',e.target.value)} placeholder="Ej: 101, 101A, 101B" onFocus={inputFocus} onBlur={inputBlur} />
            </Field>
            <div className="form-grid-row" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Tipo de Habitación" error={errors.tipoHabitacionId} required>
                <RSelect value={form.tipoHabitacionId} onValueChange={v=>set('tipoHabitacionId',v)} placeholder="Seleccionar" options={tiposHabitacion.map(t=>({value:String(t.id),label:t.nombre}))} triggerStyle={{ width:'100%', minWidth:'unset' }} />
              </Field>
              <Field label="Piso" error={errors.piso} required>
                <input style={inputStyle} value={form.piso} onChange={e=>set('piso',e.target.value)} placeholder="Ej: 1" type="number" onFocus={inputFocus} onBlur={inputBlur} />
              </Field>
            </div>
            <Field label="Descripción">
              <input style={inputStyle} value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} placeholder="Opcional" onFocus={inputFocus} onBlur={inputBlur} />
            </Field>
            <Field label="Estado">
              <RSelect value={form.estado} onValueChange={v=>set('estado',v)} options={ESTADO_KEYS.map(k=>({value:k,label:k}))} triggerStyle={{ width:'100%', minWidth:'unset' }} />
            </Field>
            <div className={s.modalFooterBorder}>
              <Btn variant="ghost" onClick={()=>setModalOpen(false)}>Cancelar</Btn>
              <Btn onClick={handleSubmit} disabled={submitting}>{editId?'Guardar cambios':'Crear habitación'}</Btn>
            </div>
          </Modal>

          <ConfirmDialog
            open={!!confirmId}
            onOpenChange={open=>!open&&setConfirmId(null)}
            onConfirm={async ()=>{ try { await deleteHabitacion(confirmId); addToast('Habitación eliminada', 'info'); } catch (error) { const msg = error?.response?.data?.message; addToast(msg || 'Error al eliminar la habitación', 'error'); } setConfirmId(null); }}
            message="¿Eliminar esta habitación? Esta acción no se puede deshacer."
          />

          <ConfirmDialog
            open={!!estadoConfirm}
            onOpenChange={open=>!open&&setEstadoConfirm(null)}
            onConfirm={confirmEstadoChange}
            title="Cambiar estado"
            message={estadoConfirm?.msg || ''}
            confirmLabel="Sí, cambiar"
            variant="primary"
          />
        </>
      )}

      {/* Reporte mensual — visible para todos los roles */}
      <Modal open={!!reporteMensualHab} onOpenChange={open => !open && setReporteMensualHab(null)} title="Reporte Mensual de Habitación" width={380}>
        {reporteMensualHab && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Hab. <strong>{reporteMensualHab.numero}</strong> — {reporteMensualHab.tipoHabitacion?.nombre} · Piso {reporteMensualHab.piso}
            </div>
            <div className={s.formGrid2}>
              <Field label="Mes">
                <select value={reporteMes} onChange={e => setReporteMes(e.target.value)} style={inputStyle}>
                  {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                    <option key={i+1} value={String(i+1)}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Año">
                <select value={reporteAnio} onChange={e => setReporteAnio(e.target.value)} style={inputStyle}>
                  {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className={s.modalFooter}>
              <Btn variant="ghost" onClick={() => setReporteMensualHab(null)}>Cancelar</Btn>
              <Btn icon={<FileText size={14} />} onClick={handleGenerarReporteMensual} disabled={reporteLoading}>
                {reporteLoading ? 'Generando…' : 'Descargar PDF'}
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
