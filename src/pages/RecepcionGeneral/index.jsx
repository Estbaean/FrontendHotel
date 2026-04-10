import { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { ESTADOS } from '../../constants/estados';
import { Badge, Card, ConfirmDialog, RSelect, SearchInput, Popover, Modal, Btn, Field, inputStyle, filterLabel, PageHeader, useToast } from '../../components/UI/index.jsx';
import CheckInModal from '../../components/CheckInModal.jsx';
import { BedDouble, Layers, ChevronDown, LogIn, LogOut, Building2, User, Clock, ClipboardList, Check } from 'lucide-react';
import { esAlquilerEmpresa, puedeVerMontos, METODOS_PAGO } from '../../utils/formHelpers';
import { getCuentasByAlquiler } from '../../api/consumos';
import { getHabitacionesDisponibles } from '../../api/habitaciones';
import { useNavigate } from 'react-router-dom';

const ESTADO_KEYS = Object.keys(ESTADOS);

export default function RecepcionGeneral() {
  const { habitaciones, tiposHabitacion, pisos, tarifas, cambiarEstado, checkIn, checkOut, alquileres, userRole } = useHotel();
  const isAdmin = userRole === 'admin';
  const addToast = useToast();
  const navigate = useNavigate();
  const [fPiso,      setFPiso]      = useState('');
  const [fEstado,    setFEstado]    = useState('');
  const [busqueda,   setBusqueda]   = useState('');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [habitacionesDisponibles, setHabitacionesDisponibles] = useState([]);
  const [checkOutTarget, setCheckOutTarget] = useState(null);
  const [checkOutMetodo, setCheckOutMetodo] = useState('EFECTIVO');
  const [checkoutCuentaItems, setCheckoutCuentaItems] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState(null);

  const filtered = habitaciones.filter(h => {
    const mP = !fPiso   || String(h.piso) === fPiso;
    const mE = !fEstado || h.estado === fEstado;
    const q = busqueda.toLowerCase();
    const alq = busqueda ? alquileres.find(a => a.numeroHabitacion === h.numero && a.estadoAlquiler === 'ACTIVO') : null;
    const mB = !busqueda || h.numero.toLowerCase().includes(q) ||
      alq?.nombreCliente?.toLowerCase().includes(q) ||
      alq?.empresaNombre?.toLowerCase().includes(q) ||
      alq?.tipoAlquilerNombre?.toLowerCase().includes(q);
    return mP && mE && mB;
  });

  const openCheckIn = async () => {
    try {
      const disponibles = await getHabitacionesDisponibles();
      setHabitacionesDisponibles(disponibles);
    } catch {
      setHabitacionesDisponibles(habitaciones.filter(h => h.estado === 'DISPONIBLE'));
    }
    setCheckInOpen(true);
  };

  const handleCheckIn = async (checkInData) => {
    try {
      await checkIn(checkInData);
      addToast('Check-in realizado con éxito', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al registrar el check-in', 'error');
    }
  };

  const openCheckout = async (alquiler) => {
    setCheckOutTarget(alquiler);
    setCheckOutMetodo('EFECTIVO');
    setCheckoutCuentaItems([]);
    setCheckoutLoading(true);
    try {
      const items = await getCuentasByAlquiler(alquiler.id);
      setCheckoutCuentaItems(items.filter(c => c.estado === 'PENDIENTE'));
    } catch { /* show empty list */ } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!checkOutTarget || isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const metodo = esAlquilerEmpresa(checkOutTarget) ? undefined : checkOutMetodo;
      await checkOut(checkOutTarget.id, metodo);
      addToast('Check-out realizado con éxito', 'success');
      setCheckOutTarget(null);
      setCheckoutCuentaItems([]);
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al registrar el check-out', 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const stats = ESTADO_KEYS.reduce((acc, k) => {
    acc[k] = habitaciones.filter(h => h.estado === k).length;
    return acc;
  }, {});

  return (
    <div className="page-anim">
      <PageHeader title="Recepción General" subtitle={`Panel de habitaciones · ${habitaciones.length}`}>
        <Btn icon={<LogIn size={14} />} onClick={openCheckIn}>Check-In</Btn>
      </PageHeader>

      {/* Estadísticas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:12, marginBottom:24 }}>
        {[...ESTADO_KEYS, '__total__'].map(k => {
          const isTotal = k === '__total__';
          const e = isTotal ? null : ESTADOS[k];
          const count = isTotal ? habitaciones.length : stats[k];
          const label = isTotal ? 'TOTAL' : e.label;
          const dotColor = isTotal ? 'var(--accent)' : e.dot;
          const isActive = fEstado === k;
          return (
            <Card key={k} padding="14px 18px" style={{
              cursor: isTotal ? 'default' : 'pointer',
              transition: 'transform .12s, box-shadow .12s',
              outline: !isTotal && isActive ? `2px solid ${e.dot}` : 'none',
              outlineOffset: -2,
            }}
              onClick={() => !isTotal && setFEstado(fEstado===k?'':k)}
              onMouseEnter={ev => { if (!isTotal) { ev.currentTarget.style.transform = 'translateY(-1px)'; ev.currentTarget.style.boxShadow = 'var(--shadow-md)'; } }}
              onMouseLeave={ev => { if (!isTotal) { ev.currentTarget.style.transform = ''; ev.currentTarget.style.boxShadow = ''; } }}
              title={isTotal ? undefined : `Filtrar por ${label}`}
            >
              <div style={{ fontSize:26, fontWeight:800, color: isTotal?'var(--accent)':e.color, lineHeight:1, marginBottom:4 }}>
                {count}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:dotColor, flexShrink:0 }} />
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', color:'var(--text-xmuted)', textTransform:'uppercase' }}>{label}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Barra de herramientas */}
      <Card padding="12px 16px" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:180 }}>
            <label style={filterLabel}>Buscar</label>
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Habitación, cliente, empresa…" />
          </div>
          <div>
            <label style={filterLabel}>Piso</label>
            <RSelect
              value={fPiso}
              onValueChange={setFPiso}
              placeholder="Todos"
              options={pisos.map(p=>({ value:String(p), label:`Piso ${p}` }))}
            />
          </div>
          <div>
            <label style={filterLabel}>Estado</label>
            <RSelect
              value={fEstado}
              onValueChange={setFEstado}
              placeholder="Todos"
              options={ESTADO_KEYS.map(k=>({ value:k, label:k }))}
            />
          </div>
        </div>
      </Card>

      {/* Cuadrícula */}
      {filtered.length === 0 ? (
        <Card padding="60px 20px" style={{ textAlign:'center' }}>
          <Layers size={36} style={{ opacity:.25, marginBottom:10, display:'block', margin:'0 auto 10px' }} />
          <p style={{ color:'var(--text-muted)', fontWeight:500 }}>No se encontraron habitaciones</p>
        </Card>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:14 }}>
          {filtered.map((hab, i) => {
            const est  = ESTADOS[hab.estado] || ESTADOS.DISPONIBLE;
            const activeAlquiler = alquileres.find(a => a.numeroHabitacion === hab.numero && a.estadoAlquiler === 'ACTIVO');
            const alquilerEsEmpresa = esAlquilerEmpresa(activeAlquiler);
            const puedeVerMontoPendiente = puedeVerMontos(isAdmin, alquilerEsEmpresa);
            const isOcupada = hab.estado === 'OCUPADA' && activeAlquiler;

            // Time since check-in
            let tiempoStr = '';
            if (activeAlquiler?.fechaIngreso) {
              const diff = Date.now() - new Date(activeAlquiler.fechaIngreso).getTime();
              const hrs = Math.floor(diff / 3_600_000);
              const mins = Math.floor((diff % 3_600_000) / 60_000);
              tiempoStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            }

            // Overdue detection
            let excedido = false;
            let excedidoStr = '';
            if (isOcupada && activeAlquiler?.fechaPrevista) {
              const now = Date.now();
              const prevista = new Date(activeAlquiler.fechaPrevista).getTime();
              if (now > prevista) {
                excedido = true;
                const diff = now - prevista;
                const hrs = Math.floor(diff / 3_600_000);
                const mins = Math.floor((diff % 3_600_000) / 60_000);
                excedidoStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
              }
            }

            return (
              <div key={hab.id} style={{
                background:'var(--surface)', borderRadius:'var(--r-lg)',
                border: excedido ? '1.5px solid var(--red, #e53935)' : `1px solid ${est.border}`,
                boxShadow: excedido ? '0 0 12px rgba(229,57,53,.25)' : 'var(--shadow-sm)',
                overflow:'hidden', transition:'transform .15s ease, box-shadow .15s ease',
                animation: `cardIn .3s ease ${Math.min(i * 0.04, 0.6)}s both`,
                display: 'flex', flexDirection: 'column', minHeight: 200,
              }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='var(--shadow-md)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='var(--shadow-sm)'; }}
              >
                {/* Color bar */}
                <div style={{ height:3, background: excedido ? 'var(--red, #e53935)' : est.dot }} />

                <div style={{ padding:'12px 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Status bar + actions */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <Badge label={est.label} color={est.color} bg={est.bg} border={est.border} dot={est.dot} />
                  <div style={{ display:'flex', gap:5 }}>
                      {isOcupada ? (
                        // OCUPADA: Gestionar cuenta + Checkout — cambio directo de estado bloqueado
                        <>
                          <button
                            title="Gestionar cuenta (ir a Alquileres)"
                            onClick={() => navigate('/alquileres')}
                            style={{
                              width:24, height:24, borderRadius:'var(--r-sm)',
                              background:est.bg, border:`1px solid ${est.border}`,
                              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                              color:est.color,
                            }}
                          >
                            <ClipboardList size={12} />
                          </button>
                          <button
                            title="Hacer check-out"
                            onClick={() => openCheckout(activeAlquiler)}
                            style={{
                              width:24, height:24, borderRadius:'var(--r-sm)',
                              background:est.bg, border:`1px solid ${est.border}`,
                              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                              color:est.color,
                            }}
                          >
                            <LogOut size={12} />
                          </button>
                        </>
                      ) : (
                        // No ocupada: permitir cambio de estado manual
                        <>
                          {hab.estado === 'LIMPIEZA' && (
                            <button
                              title="Marcar como Disponible"
                              onClick={() => setEstadoConfirm({ id: hab.id, estado: 'DISPONIBLE', msg: `¿Marcar Hab. ${hab.numero} como Disponible? La habitación está limpia y lista.` })}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                padding: '3px 8px', borderRadius: 'var(--r-sm)',
                                background: 'var(--green-bg)', border: '1px solid var(--green-border, #a7f3d0)',
                                color: 'var(--green)', fontSize: 11, fontWeight: 700,
                                cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              <Check size={11} /> Disponible
                            </button>
                          )}
                          <Popover.Root>
                            <Popover.Trigger asChild>
                              <button
                                title="Cambiar estado"
                                style={{
                                  width:24, height:24, borderRadius:'var(--r-sm)',
                                  background:est.bg, border:`1px solid ${est.border}`,
                                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                                  color:est.color,
                                }}
                              >
                                <ChevronDown size={12} />
                              </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content
                                side="right"
                                align="start"
                                sideOffset={8}
                                style={{
                                  background:'var(--surface)', borderRadius:'var(--r-md)',
                                  border:'1px solid var(--border)', boxShadow:'var(--shadow-lg)',
                                  padding:'8px', width:140, zIndex:1000,
                                }}
                              >
                                <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:6, textAlign:'center' }}>
                                  Cambiar estado
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                  {ESTADO_KEYS.map(k=>(
                                    <button
                                      key={k}
                                      onClick={()=>{ setEstadoConfirm({ id: hab.id, estado: k, msg: `¿Cambiar Hab. ${hab.numero} a ${ESTADOS[k].label}?` }); }}
                                      disabled={k === hab.estado}
                                      style={{
                                        padding:'6px 8px', borderRadius:'var(--r-sm)',
                                        background: k === hab.estado ? est.bg : ESTADOS[k].bg,
                                        border:`1px solid ${ESTADOS[k].border}`,
                                        color: ESTADOS[k].color,
                                        fontSize:11, fontWeight:600, cursor:'pointer',
                                        opacity: k === hab.estado ? 0.5 : 1,
                                        textAlign:'left',
                                      }}
                                    >
                                      {ESTADOS[k].label}
                                    </button>
                                  ))}
                                </div>
                              </Popover.Content>
                            </Popover.Portal>
                          </Popover.Root>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Room number + type */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <BedDouble size={18} color={est.dot} strokeWidth={1.5} />
                    <span style={{ fontSize:26, fontWeight:800, color:est.color, lineHeight:1 }}>{hab.numero}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.3px' }}>
                      {hab.tipoHabitacion?.nombre}
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-xmuted)' }}>Piso {hab.piso}</span>
                  </div>

                  {/* Spacer to push footer down */}
                  <div style={{ flex: 1 }} />

                  {/* Guest info OR empty prompt */}
                  {isOcupada ? (
                    <div style={{
                      marginTop: 10, paddingTop: 10,
                      borderTop: `1px dashed color-mix(in srgb, ${est.dot} 35%, transparent)`,
                    }}>
                      {/* Guest row */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <User size={12} color="var(--text-muted)" />
                        <span style={{ fontSize:12, color:'var(--text)', fontWeight:600, lineHeight:1.2 }}>
                          {activeAlquiler.nombreCliente}
                        </span>
                      </div>

                      {/* Tags row: tipo + empresa + time */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:6 }}>
                        {activeAlquiler.tipoAlquilerNombre && activeAlquiler.tipoAlquilerNombre !== '—' && (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:3,
                            fontSize:9.5, fontWeight:700, letterSpacing:'.3px',
                            padding:'2px 6px', borderRadius:'var(--r-sm)',
                            background:'var(--surface-2)', color:'var(--text-2)',
                            textTransform:'uppercase',
                          }}>
                            {activeAlquiler.tipoAlquilerNombre}
                          </span>
                        )}
                        {alquilerEsEmpresa && (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:3,
                            fontSize:9.5, fontWeight:700, letterSpacing:'.3px',
                            padding:'2px 6px', borderRadius:'var(--r-sm)',
                            background:'var(--accent-light)', color:'var(--accent-dark)',
                            border:'1px solid var(--accent)',
                            textTransform:'uppercase',
                          }}>
                            <Building2 size={10} />
                            {isAdmin ? activeAlquiler.empresaNombre : 'Empresa'}
                          </span>
                        )}
                        {tiempoStr && (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:3,
                            fontSize:9.5, fontWeight:600, color:'var(--text-xmuted)',
                          }}>
                            <Clock size={10} />
                            {tiempoStr}
                          </span>
                        )}
                        {excedido && (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:3,
                            fontSize:9, fontWeight:700, color:'#fff',
                            background:'var(--red, #e53935)', padding:'1px 6px',
                            borderRadius:'var(--r-sm, 4px)', letterSpacing:'.5px',
                            animation: 'pulse-badge 1.5s ease-in-out infinite',
                          }}>
                            EXCEDIDO {excedidoStr}
                          </span>
                        )}
                      </div>

                      {/* Pending amount */}
                      <div style={{
                        marginTop:8, padding:'6px 8px', borderRadius:'var(--r-sm)',
                        background: `color-mix(in srgb, ${est.dot} 8%, transparent)`,
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                      }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.3px' }}>
                          Pendiente
                        </span>
                        {puedeVerMontoPendiente ? (
                          <span style={{
                            fontSize:13, fontWeight:800,
                            color: (activeAlquiler.pagoPendiente || 0) > 0 ? 'var(--red)' : 'var(--green)',
                          }}>
                            S/ {(activeAlquiler.pagoPendiente || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontSize:11, color:'var(--text-xmuted)', cursor:'help' }}
                            title="Monto gestionado por administración"
                          >Corporativo</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      marginTop: 10, paddingTop: 10,
                      borderTop: `1px dashed color-mix(in srgb, ${est.dot} 20%, transparent)`,
                      display:'flex', alignItems:'center', gap:6,
                      color:'var(--text-xmuted)', fontSize:10.5,
                    }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background: est.dot, opacity:.4 }} />
                      {hab.estado === 'DISPONIBLE' ? 'Sin huésped' : est.label.charAt(0) + est.label.slice(1).toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CheckInModal 
        open={checkInOpen} 
        onOpenChange={setCheckInOpen}
        habitacionesDisponibles={habitacionesDisponibles}
        tarifas={tarifas}
        tiposHabitacion={tiposHabitacion}
        pisos={pisos}
        onCheckIn={handleCheckIn}
      />

      {/* Check-out modal — igual que Alquileres */}
      <Modal open={!!checkOutTarget} onOpenChange={(open) => { if (!open) { setCheckOutTarget(null); setCheckoutCuentaItems([]); } }} title="Confirmar Check-out" width={480}>
        {checkOutTarget && (() => {
          const esEmpresaCheckout = esAlquilerEmpresa(checkOutTarget);
          const verMontosCheckout = puedeVerMontos(isAdmin, esEmpresaCheckout);
          return (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              Hab. {checkOutTarget.numeroHabitacion} — {checkOutTarget.nombreCliente}
            </div>
            {verMontosCheckout ? (
            <div style={{ background: 'var(--surface-2, #f5f5f5)', borderRadius: 'var(--r-md, 8px)', padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>Base habitación</span>
                <span>S/ {parseFloat(checkOutTarget.subTotal || 0).toFixed(2)}</span>
              </div>
              {Number(checkOutTarget.totalPagadoCaja || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: 'var(--green, #43a047)' }}>
                  <span>Ya pagado en caja</span>
                  <span>− S/ {Number(checkOutTarget.totalPagadoCaja || 0).toFixed(2)}</span>
                </div>
              )}
              {checkoutLoading && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>Cargando consumos...</div>
              )}
              {!checkoutLoading && checkoutCuentaItems.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', margin: '8px 0 4px' }}>
                    Consumos pendientes
                  </div>
                  {checkoutCuentaItems.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 2 }}>
                      <span>{c.descripcion} × {c.cantidad}</span>
                      <span>S/ {c.subTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </>
              )}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                <span>Total a cobrar</span>
                <span style={{ color: parseFloat(checkOutTarget.pagoPendiente) > 0 ? 'var(--red, #e53935)' : 'var(--green, #43a047)' }}>
                  S/ {parseFloat(checkOutTarget.pagoPendiente || 0).toFixed(2)}
                </span>
              </div>
            </div>
            ) : (
            <div style={{ background: 'var(--surface-2, #f5f5f5)', borderRadius: 'var(--r-md, 8px)', padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text)' }}>Cliente empresa</strong>
              Los montos de este alquiler son gestionados por administración. El check-out se procesará normalmente.
              {!checkoutLoading && checkoutCuentaItems.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12 }}>Consumos pendientes: {checkoutCuentaItems.length} item(s)</div>
              )}
            </div>
            )}
            {verMontosCheckout && !esEmpresaCheckout && (
            <Field label="Método de Pago">
              <select style={inputStyle} value={checkOutMetodo} onChange={e => setCheckOutMetodo(e.target.value)}>
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => { setCheckOutTarget(null); setCheckoutCuentaItems([]); }}>Cancelar</Btn>
              <Btn icon={<LogOut size={14} />} onClick={handleCheckOut} disabled={isCheckingOut}>
                {isCheckingOut ? 'Procesando...' : 'Confirmar Check-out'}
              </Btn>
            </div>
          </>
          );
        })()}
      </Modal>

      <ConfirmDialog
        open={!!estadoConfirm}
        onOpenChange={open => !open && setEstadoConfirm(null)}
        onConfirm={async () => {
          if (!estadoConfirm) return;
          try { await cambiarEstado(estadoConfirm.id, estadoConfirm.estado); addToast(`Estado cambiado a ${estadoConfirm.estado}`, 'success'); }
          catch { addToast('Error al cambiar estado', 'error'); }
          setEstadoConfirm(null);
        }}
        title="Cambiar estado"
        message={estadoConfirm?.msg || ''}
        confirmLabel="Sí, cambiar"
        variant="primary"
      />
    </div>
  );
}
