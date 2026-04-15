import { useState, useCallback } from "react";
import CheckInClienteList from "./CheckInClienteList.jsx";
import { useHotel } from "../context/HotelContext.jsx";
import { useAuth } from "../context/AuthContext";
import { Modal, Btn, Field, inputStyle, inputFocus, inputBlur } from "./UI/index.jsx";
import { LogIn } from "lucide-react";
import { sanitizeDecimal, METODOS_PAGO } from "../utils/formHelpers";
import s from './CheckInModal.module.css';

export default function CheckInModal({
  open,
  onOpenChange,
  habitacionesDisponibles,
  tarifas,
  tiposHabitacion,
  pisos,
  onCheckIn,
}) {
  const { userRole } = useAuth();
  const { tiposAlquiler } = useHotel();
  const isAdmin = userRole === 'admin';

  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState([]);
  const [representativeId, setRepresentativeId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [tipoAlquilerId, setTipoAlquilerId] = useState('');
  const [isAddClienteOpen, setIsAddClienteOpen] = useState(false);
  const [filterPiso, setFilterPiso] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [cantTiempo, setCantTiempo] = useState(1);
  const [adelanto, setAdelanto] = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');

  // Selected client (first one — backend accepts one client per check-in)
  const selectedCliente = clientes.find((c) => c.id === representativeId) || clientes[0];
  const clienteEsEmpresa = Boolean((selectedCliente?.empresaNombre && selectedCliente?.empresaNombre !== '—') || selectedCliente?.empresaId);
  const canViewTarifa = isAdmin || !clienteEsEmpresa;

  // Validaciones
  const canProceedStep1 = !isAddClienteOpen && clientes.length > 0 && !!selectedCliente && clientes.every(c => c.nombre?.trim());
  const canProceedStep2 = !!tipoAlquilerId && cantTiempo > 0;
  const canProceedStep3 = !!selectedRoomId;
  const canFinish = canProceedStep3 && canProceedStep2 && canProceedStep1;

  const handleAdelantoChange = (rawValue) => {
    setAdelanto(sanitizeDecimal(rawValue));
  };

  // Get tarifa for the selected room and tipo alquiler
  const selectedRoom = habitacionesDisponibles.find(r => r.id === selectedRoomId);
  const matchingTarifa = tarifas.find(t =>
    t.tipoHabitacion?.id === selectedRoom?.tipoHabitacion?.id &&
    t.tipoAlquiler?.id === Number(tipoAlquilerId)
  );
  const estimatedPrice = matchingTarifa ? matchingTarifa.precio * cantTiempo : 0;

  const filteredRooms = habitacionesDisponibles.filter((room) => {
    const matchesPiso = !filterPiso || String(room.piso) === filterPiso;
    const matchesTipo = !filterTipo || String(room.tipoHabitacion?.id) === filterTipo;
    return matchesPiso && matchesTipo;
  });

  const resetForm = useCallback(() => {
    setStep(1);
    setClientes([]);
    setRepresentativeId(null);
    setSelectedRoomId(null);
    setTipoAlquilerId('');
    setFilterPiso("");
    setFilterTipo("");
    setCantTiempo(1);
    setAdelanto('');
    setMetodoPago('EFECTIVO');
  }, []);

  const handleFinish = () => {
    if (!canFinish || !selectedCliente) return;

    const checkInData = {
      idCliente: selectedCliente.id,
      idHabitacion: selectedRoomId,
      idTipoAlquiler: Number(tipoAlquilerId),
      cantTiempo,
      metodoPago: clienteEsEmpresa ? undefined : metodoPago,
      idHuespedes: clientes.map(c => c.id),
    };
    if (!clienteEsEmpresa && adelanto && Number(adelanto) > 0) {
      checkInData.adelanto = Number(adelanto);
    }

    onCheckIn(checkInData);
    resetForm();
    onOpenChange(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const STEPS = [
    { num: 1, label: 'Cliente' },
    { num: 2, label: 'Modalidad' },
    { num: 3, label: 'Habitación' },
    { num: 4, label: 'Resumen' },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title={`Check-In — ${STEPS.find(s => s.num === step)?.label || ''}`}
      width={700}
      aria-describedby="checkin-desc"
      description="Registro de check-in de huéspedes"
    >
      {/* Barra de progreso */}
      <div className={s.stepper}>
        {STEPS.map(({ num, label }, i) => (
          <div key={num} className={`${s.stepperItem} ${step === num ? s.active : ''} ${step > num ? s.done : ''}`}>
            <div className={s.stepperCircle}>{step > num ? '✓' : num}</div>
            <span className={s.stepperLabel}>{label}</span>
            {i < STEPS.length - 1 && <div className={s.stepperLine} />}
          </div>
        ))}
      </div>

      {/* PASO 1: CLIENTES */}
      {step === 1 && (
        <div className={s.stepWrapper}>
          <div className={s.stepHeader}>
            <h3>Paso 1 de 4: Cliente</h3>
            <p className={s.stepDescription}>Seleccione o registre al huésped principal</p>
          </div>

          <div className={s.stepContent}>
            <CheckInClienteList
              clientes={clientes}
              onClientesChange={setClientes}
              onAddModeChange={setIsAddClienteOpen}
              representativeId={representativeId}
              onRepresentativeChange={setRepresentativeId}
            />
          </div>

          <div className={s.stepFooter}>
            <Btn variant="ghost" onClick={handleClose}>
              Cancelar
            </Btn>
            <Btn disabled={!canProceedStep1} onClick={() => setStep(2)}>
              Siguiente →
            </Btn>
          </div>
        </div>
      )}

      {/* PASO 2: TIPO DE ALQUILER + DURACIÓN */}
      {step === 2 && (() => {
        const selectedTipo = tiposAlquiler.find(t => String(t.id) === tipoAlquilerId);
        const unidad = selectedTipo?.unidad || 'DIA';
        const mult = selectedTipo?.multiplicador || 1;

        /* Derive human-readable unit label from nombre */
        const unitLabel = (() => {
          if (!selectedTipo) return 'unidades de tiempo';
          const n = selectedTipo.nombre.toUpperCase();
          if (n.includes('HORA')) return cantTiempo === 1 ? 'hora' : 'horas';
          if (n.includes('NOCHE')) return cantTiempo === 1 ? 'noche' : 'noches';
          if (n.includes('SEMANA')) return cantTiempo === 1 ? 'semana' : 'semanas';
          if (n.includes('MES')) return cantTiempo === 1 ? 'mes' : 'meses';
          return cantTiempo === 1 ? 'día' : 'días';
        })();

        /* Live preview of salida estimada */
        const salidaPreview = (() => {
          if (!selectedTipo) return null;
          const now = new Date();
          const totalMs = unidad === 'HORA'
            ? cantTiempo * mult * 3600000
            : cantTiempo * mult * 86400000;
          const target = new Date(now.getTime() + totalMs);
          const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
          const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
          const hh = String(target.getHours()).padStart(2, '0');
          const mi = String(target.getMinutes()).padStart(2, '0');
          return `${dias[target.getDay()]} ${target.getDate()} de ${meses[target.getMonth()]} ${target.getFullYear()} — ${hh}:${mi}`;
        })();

        return (
        <div className={s.stepWrapper}>
          <div className={s.stepHeader}>
            <h3>Paso 2 de 4: Tipo de Alquiler + Duración</h3>
            <p className={s.stepDescription}>Seleccione modalidad y cantidad de tiempo</p>
          </div>

          <div className={s.stepContent}>
            {/* Chips de tipo de alquiler */}
            <div className={s.tipoChips}>
              {tiposAlquiler.map((tipo) => (
                <button
                  key={tipo.id}
                  type="button"
                  className={`${s.tipoChip} ${tipoAlquilerId === String(tipo.id) ? s.tipoChipSelected : ''}`}
                  onClick={() => setTipoAlquilerId(String(tipo.id))}
                >
                  {tipo.nombre}
                </button>
              ))}
            </div>

            {/* Duración — solo mostrar cuando hay tipo seleccionado */}
            {selectedTipo && (
              <div className={s.duracionBox}>
                <div className={s.duracionLabel}>
                  Cantidad de <strong>{unitLabel}</strong>
                </div>
                <div className={s.duracionControl}>
                  <button
                    type="button"
                    className={s.durStep}
                    onClick={() => setCantTiempo(Math.max(1, cantTiempo - 1))}
                    aria-label="Disminuir"
                  >−</button>
                  <span className={s.durValue}>{cantTiempo}</span>
                  <button
                    type="button"
                    className={s.durStep}
                    onClick={() => setCantTiempo(cantTiempo + 1)}
                    aria-label="Aumentar"
                  >+</button>
                </div>

                {salidaPreview && (
                  <div className={s.salidaPill}>
                    <span className={s.salidaPillIcon}>🕐</span>
                    <div>
                      <div className={s.salidaPillLabel}>Salida estimada</div>
                      <div className={s.salidaPillDate}>{salidaPreview}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!tipoAlquilerId && (
              <p className={s.tipoHint}>Seleccioná una modalidad para continuar</p>
            )}
          </div>

          <div className={s.stepFooter}>
            <Btn variant="ghost" onClick={() => setStep(1)}>
              ← Atrás
            </Btn>
            <Btn disabled={!canProceedStep2} onClick={() => setStep(3)}>
              Siguiente →
            </Btn>
          </div>
        </div>
        );
      })()}

      {/* PASO 3: HABITACIÓN */}
      {step === 3 && (
        <div className={s.stepWrapper}>
          <div className={s.stepHeader}>
            <h3>Paso 3 de 4: Habitación</h3>
            <p className={s.stepDescription}>Seleccione una habitación disponible</p>
          </div>

          <div className={s.stepContent}>
            <div className={s.filtersRow}>
              <Field label="Piso">
                <select value={filterPiso} onChange={(e) => setFilterPiso(e.target.value)} style={inputStyle}>
                  <option value="">Todos los pisos</option>
                  {pisos?.map((p) => (
                    <option key={p} value={String(p)}>
                      Piso {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo Habitación">
                <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} style={inputStyle}>
                  <option value="">Todos los tipos</option>
                  {tiposHabitacion?.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className={s.roomsSection}>
              {filteredRooms.length === 0 ? (
                <div className={s.emptyRooms}>
                  <p>No hay habitaciones disponibles con estos filtros</p>
                </div>
              ) : (
                <div className={s.roomsGrid}>
                  {filteredRooms.map((room) => {
                    const isSelected = selectedRoomId === room.id;
                    return (
                      <button
                        key={room.id}
                        className={`${s.roomBtn} ${isSelected ? s.selected : ''}`}
                        onClick={() => setSelectedRoomId(isSelected ? null : room.id)}
                        title={`Habitación ${room.numero} - ${room.tipoHabitacion?.nombre}`}
                      >
                        <div className={s.roomNumber}>{room.numero}</div>
                        <div className={s.roomType}>{room.tipoHabitacion?.nombre?.split(" ")[0] || "Tipo"}</div>
                        <div className={s.roomFloor}>Piso {room.piso}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={s.stepFooter}>
            <Btn variant="ghost" onClick={() => setStep(2)}>
              ← Atrás
            </Btn>
            <Btn disabled={!canProceedStep3} onClick={() => setStep(4)}>
              Siguiente →
            </Btn>
          </div>
        </div>
      )}

      {/* PASO 4: RESUMEN + PAGO */}
      {step === 4 && (
        <div className={s.stepWrapper}>
          <div className={s.stepHeader}>
            <h3>Paso 4 de 4: Resumen y Pago</h3>
            <p className={s.stepDescription}>Verifique los datos y configure el pago</p>
          </div>

          <div className={s.stepContent}>
            <div className={s.summarySection}>
              <h4 className={s.summaryTitle}>Datos del check-in</h4>
              <div className={s.summaryRows}>
                {selectedCliente?.empresaNombre && selectedCliente?.empresaNombre !== '—' && (
                  <div className={s.summaryRow}>
                    <span className={s.roomNum}>Empresa</span>
                    <span className={s.roomRental} style={{ textAlign: 'right', fontWeight: 700 }}>
                      {selectedCliente.empresaNombre}
                    </span>
                  </div>
                )}
                <div className={s.summaryRow} style={{ alignItems: 'flex-start' }}>
                  <span className={s.roomNum} style={{ paddingTop: 2 }}>
                    {clientes.length === 1 ? 'Huésped' : `Huéspedes (${clientes.length})`}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>
                    {clientes.map((c, i) => {
                      const esTitular = c.id === (representativeId || clientes[0]?.id);
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {clientes.length > 1 && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                              background: esTitular ? 'var(--accent)' : 'var(--surface-2, #f0f0f0)',
                              color: esTitular ? '#fff' : 'var(--text-muted)',
                              borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>{i + 1}</span>
                          )}
                          <span className={s.roomRental} style={{ margin: 0 }}>
                            {c.nombre}
                            {clientes.length > 1 && esTitular && (
                              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light, #e3f2fd)', borderRadius: 4, padding: '1px 5px' }}>
                                titular
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={s.summaryRow}>
                  <span className={s.roomNum}>Habitación</span>
                  <span className={s.roomRental} style={{ textAlign: 'right' }}>
                    {selectedRoom ? `${selectedRoom.numero} — ${selectedRoom.tipoHabitacion?.nombre}` : '—'}
                  </span>
                </div>
                <div className={s.summaryRow}>
                  <span className={s.roomNum}>Modalidad</span>
                  <span className={s.roomRental} style={{ textAlign: 'right' }}>
                    {tiposAlquiler.find(t => String(t.id) === tipoAlquilerId)?.nombre || '—'} × {cantTiempo}
                  </span>
                </div>
                <div className={s.summaryRow}>
                  <span className={s.roomNum}>Tarifa</span>
                  <span className={s.roomPrice}>
                    {canViewTarifa
                      ? (matchingTarifa ? `S/ ${matchingTarifa.precio.toFixed(2)} /und` : 'Sin tarifa')
                      : 'Tarifa corporativa (solo admin)'}
                  </span>
                </div>
              </div>
              {matchingTarifa && canViewTarifa && (
                <div className={s.summaryTotal}>
                  <strong>Total estimado:</strong>
                  <strong className={s.totalAmount}>S/ {estimatedPrice.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {!clienteEsEmpresa && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Método de pago">
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} style={inputStyle}>
                    {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label="Adelanto (opcional)">
                  <div className={s.checkinAmountWrap}>
                    <span className={s.checkinAmountPrefix}>S/</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={adelanto}
                      onChange={(e) => handleAdelantoChange(e.target.value)}
                      placeholder="0.00"
                      style={inputStyle}
                      className={s.checkinAmountInput}
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                </Field>
              </div>
            )}
          </div>

          <div className={s.stepFooter}>
            <Btn variant="ghost" onClick={() => setStep(3)}>
              ← Atrás
            </Btn>
            <Btn disabled={!canFinish} variant="primary" icon={<LogIn size={14} />} onClick={handleFinish}>
              Confirmar Check-In
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
