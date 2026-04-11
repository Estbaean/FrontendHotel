import { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useAuth } from '../../context/AuthContext';
import { ESTADOS } from '../../constants/estados';
import { Badge, Card, ConfirmDialog, Popover, Btn, PageHeader, useToast } from '../../components/UI/index.jsx';
import PageToolbar from '../../components/PageToolbar';
import CheckInModal from '../../components/CheckInModal.jsx';
import { BedDouble, Layers, ChevronDown, LogIn, LogOut, Building2, User, Clock, ClipboardList, Check, Tag, ChevronUp } from 'lucide-react';
import { esAlquilerEmpresa, puedeVerMontos } from '../../utils/formHelpers';
import { getHabitacionesDisponibles } from '../../api/habitaciones';
import CheckoutModal from '../../components/CheckoutModal.jsx';
import { useNavigate } from 'react-router-dom';
import c from './RecepcionGeneral.module.css';

const ESTADO_KEYS = Object.keys(ESTADOS);

export default function RecepcionGeneral() {
  const { userRole } = useAuth();
  const { habitaciones, tiposHabitacion, tiposAlquiler, pisos, tarifas, cambiarEstado, checkIn, checkOut, alquileres } = useHotel();
  const isAdmin = userRole === 'admin';
  const addToast = useToast();
  const navigate = useNavigate();
  const [fPiso,      setFPiso]      = useState('');
  const [fEstado,    setFEstado]    = useState('');
  const [busqueda,   setBusqueda]   = useState('');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [habitacionesDisponibles, setHabitacionesDisponibles] = useState([]);
  const [checkOutTarget, setCheckOutTarget] = useState(null);
  const [estadoConfirm, setEstadoConfirm] = useState(null);
  const [showTarifas, setShowTarifas] = useState(false);

  // Matriz de tarifas: { tipoHabitacionId -> { tipoAlquilerId -> precio } }
  const tarifaMatrix = useMemo(() => {
    const m = {};
    tarifas.forEach(t => {
      const hId = t.tipoHabitacion?.id;
      const aId = t.tipoAlquiler?.id;
      if (!hId || !aId) return;
      if (!m[hId]) m[hId] = {};
      m[hId][aId] = t.precio;
    });
    return m;
  }, [tarifas]);

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

  const stats = ESTADO_KEYS.reduce((acc, k) => {
    acc[k] = habitaciones.filter(h => h.estado === k).length;
    return acc;
  }, {});

  return (
    <div className="page-anim">
      <PageHeader title="Recepción General" subtitle={`Panel de habitaciones · ${habitaciones.length}`}>
        <Btn variant="ghost" icon={<Tag size={14} />} onClick={() => setShowTarifas(o => !o)}>
          {showTarifas ? 'Ocultar tarifas' : 'Ver tarifas'}
        </Btn>
        <Btn icon={<LogIn size={14} />} onClick={openCheckIn}>Check-In</Btn>
      </PageHeader>

      {/* Panel de tarifas */}
      {showTarifas && (
        <div className={c.tarifasPanel}>
          <div className={c.tarifasPanelHeader}>
            <Tag size={13} />
            <span>Tarifas vigentes</span>
            <button className={c.tarifasPanelClose} onClick={() => setShowTarifas(false)} aria-label="Cerrar tarifas">
              <ChevronUp size={14} />
            </button>
          </div>
          {tiposAlquiler.length === 0 || tiposHabitacion.length === 0 ? (
            <p className={c.tarifasEmpty}>No hay tarifas configuradas.</p>
          ) : (
            <div className={c.tarifasScroll}>
              <table className={c.tarifasTable}>
                <thead>
                  <tr>
                    <th className={c.tarifasTh} style={{ textAlign: 'left' }}>Tipo de habitación</th>
                    {tiposAlquiler.map(ta => (
                      <th key={ta.id} className={c.tarifasTh}>{ta.nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tiposHabitacion.map((th, i) => (
                    <tr key={th.id} className={i % 2 === 0 ? c.tarifasTrEven : ''}>
                      <td className={c.tarifasTdLabel}>{th.nombre}</td>
                      {tiposAlquiler.map(ta => {
                        const precio = tarifaMatrix[th.id]?.[ta.id];
                        return (
                          <td key={ta.id} className={c.tarifasTd}>
                            {precio != null
                              ? <span className={c.tarifasPrecio}>S/ {Number(precio).toFixed(2)}</span>
                              : <span className={c.tarifasSinConfig}>—</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas */}
      <div className={c.statsGrid}>
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
              outline: !isTotal && isActive ? `2px solid ${e.dot}` : 'none',
              outlineOffset: -2,
            }}
              className={isTotal ? undefined : c.roomCard}
              onClick={() => !isTotal && setFEstado(fEstado===k?'':k)}
              title={isTotal ? undefined : `Filtrar por ${label}`}
            >
              <div className={c.statCount} style={{ color: isTotal?'var(--accent)':e.color }}>
                {count}
              </div>
              <div className={c.statLabel}>
                <span className={c.statDot} style={{ background:dotColor }} />
                <span className={c.statText}>{label}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Barra de herramientas */}
      <PageToolbar>
        <PageToolbar.Row inline>
          <PageToolbar.Search value={busqueda} onChange={setBusqueda} placeholder="Habitación, cliente, empresa…" />
          <PageToolbar.Filter label="Piso" value={fPiso} onChange={setFPiso} placeholder="Todos" options={pisos.map(p=>({ value:String(p), label:`Piso ${p}` }))} />
          <PageToolbar.Filter label="Estado" value={fEstado} onChange={setFEstado} placeholder="Todos" options={ESTADO_KEYS.map(k=>({ value:k, label:k }))} />
        </PageToolbar.Row>
      </PageToolbar>

      {/* Cuadrícula */}
      {filtered.length === 0 ? (
        <Card padding="60px 20px" style={{ textAlign:'center' }}>
          <Layers size={36} style={{ opacity:.25, marginBottom:10, display:'block', margin:'0 auto 10px' }} />
          <p style={{ color:'var(--text-muted)', fontWeight:500 }}>No se encontraron habitaciones</p>
        </Card>
      ) : (
        <div className={c.roomGrid}>
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
              <div key={hab.id} className={c.roomCard} style={{
                border: excedido ? '1.5px solid var(--red, #e53935)' : `1px solid ${est.border}`,
                boxShadow: excedido ? '0 0 12px rgba(229,57,53,.25)' : undefined,
                animation: `cardIn .3s ease ${Math.min(i * 0.04, 0.6)}s both`,
              }}
              >
                {/* Color bar */}
                <div className={c.colorBar} style={{ background: excedido ? 'var(--red, #e53935)' : est.dot }} />

                <div className={c.roomBody}>
                  {/* Status bar + actions */}
                  <div className={c.statusRow}>
                    <Badge label={est.label} color={est.color} bg={est.bg} border={est.border} dot={est.dot} />
                  <div className={c.actionGroup}>
                      {isOcupada ? (
                        // OCUPADA: Gestionar cuenta + Checkout — cambio directo de estado bloqueado
                        <>
                          <button
                            title="Gestionar cuenta (ir a Alquileres)"
                            onClick={() => navigate('/alquileres')}
                            className={c.iconBtn}
                            style={{ background:est.bg, border:`1px solid ${est.border}`, color:est.color }}
                          >
                            <ClipboardList size={12} />
                          </button>
                          <button
                            title="Hacer check-out"
                            onClick={() => setCheckOutTarget(activeAlquiler)}
                            className={c.iconBtn}
                            style={{ background:est.bg, border:`1px solid ${est.border}`, color:est.color }}
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
                              className={c.readyBtn}
                            >
                              <Check size={11} /> Disponible
                            </button>
                          )}
                          <Popover.Root>
                            <Popover.Trigger asChild>
                              <button
                                title="Cambiar estado"
                                className={c.iconBtn}
                                style={{ background:est.bg, border:`1px solid ${est.border}`, color:est.color }}
                              >
                                <ChevronDown size={12} />
                              </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content
                                side="right"
                                align="start"
                                sideOffset={8}
                                className={c.popoverContent}
                              >
                                <div className={c.popoverTitle}>
                                  Cambiar estado
                                </div>
                                <div className={c.popoverList}>
                                  {ESTADO_KEYS.map(k=>(
                                    <button
                                      key={k}
                                      onClick={()=>{ setEstadoConfirm({ id: hab.id, estado: k, msg: `¿Cambiar Hab. ${hab.numero} a ${ESTADOS[k].label}?` }); }}
                                      disabled={k === hab.estado}
                                      className={c.popoverBtn}
                                      style={{
                                        background: k === hab.estado ? est.bg : ESTADOS[k].bg,
                                        border:`1px solid ${ESTADOS[k].border}`,
                                        color: ESTADOS[k].color,
                                        opacity: k === hab.estado ? 0.5 : 1,
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
                  <div className={c.roomNumberRow}>
                    <BedDouble size={18} color={est.dot} strokeWidth={1.5} />
                    <span className={c.roomNumber} style={{ color:est.color }}>{hab.numero}</span>
                  </div>
                  <div className={c.roomMeta}>
                    <span className={c.roomType}>
                      {hab.tipoHabitacion?.nombre}
                    </span>
                    <span className={c.roomFloor}>Piso {hab.piso}</span>
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
                      <div className={c.guestRow}>
                        <User size={12} color="var(--text-muted)" />
                        <span className={c.guestName}>
                          {activeAlquiler.nombreCliente}
                        </span>
                      </div>

                      {/* Tags row: tipo + empresa + time */}
                      <div className={c.tagsRow}>
                        {activeAlquiler.tipoAlquilerNombre && activeAlquiler.tipoAlquilerNombre !== '—' && (
                          <span className={c.tagMuted}>
                            {activeAlquiler.tipoAlquilerNombre}
                          </span>
                        )}
                        {alquilerEsEmpresa && (
                          <span className={c.tagAccent}>
                            <Building2 size={10} />
                            {isAdmin ? activeAlquiler.empresaNombre : 'Empresa'}
                          </span>
                        )}
                        {tiempoStr && (
                          <span className={c.tagTime}>
                            <Clock size={10} />
                            {tiempoStr}
                          </span>
                        )}
                        {excedido && (
                          <span className={c.tagExcedido}>
                            EXCEDIDO {excedidoStr}
                          </span>
                        )}
                      </div>

                      {/* Pending amount */}
                      <div className={c.pendingRow} style={{
                        background: `color-mix(in srgb, ${est.dot} 8%, transparent)`,
                      }}>
                        <span className={c.pendingLabel}>
                          Pendiente
                        </span>
                        {puedeVerMontoPendiente ? (
                          <span className={c.pendingAmount} style={{
                            color: (activeAlquiler.pagoPendiente || 0) > 0 ? 'var(--red)' : 'var(--green)',
                          }}>
                            S/ {(activeAlquiler.pagoPendiente || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className={c.pendingCorp}
                            title="Monto gestionado por administración"
                          >Corporativo</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={c.emptyFooter} style={{
                      borderTop: `1px dashed color-mix(in srgb, ${est.dot} 20%, transparent)`,
                    }}>
                      <span className={c.emptyDot} style={{ background: est.dot }} />
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

      <CheckoutModal
        alquiler={checkOutTarget}
        onClose={() => setCheckOutTarget(null)}
        checkOut={checkOut}
        isAdmin={isAdmin}
      />

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
