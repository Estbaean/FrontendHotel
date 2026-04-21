// ── Sub-DTOs (nested objects in responses) ──────────────────────────
export type RolDTO = {
  id: number;
  nombre: 'ROLE_ADMINISTRADOR' | 'ROLE_RECEPCIONISTA';
  descripcion?: string;
};

export type TipoDocumentoDTO = {
  id: number;
  nombre: 'DNI' | 'CE' | 'PASAPORTE';
};

export type TipoHabitacionDTO = {
  id: number;
  nombre: string; // SIMPLE, DOBLE, etc.
};

export type TipoAlquilerDTO = {
  id: number;
  nombre: string;
  unidad: 'HORA' | 'DIA';
  multiplicador: number;
};

// ── Main DTOs (match backend responses exactly) ─────────────────────
export type UsuarioDTO = {
  id: number;
  nombre: string;
  numDocumento: string;
  telefono?: string;
  tipoDocumento: TipoDocumentoDTO;
  rol: RolDTO;
};

export type ClienteDTO = {
  id: number;
  nombre: string;
  numDocumento: string;
  telefono?: string;
  tipoDocumento: TipoDocumentoDTO;
  empresaId?: number;
  empresaNombre?: string;
};

export type HabitacionDTO = {
  id: number;
  piso: number;
  numero: string;
  descripcion?: string;
  estado: 'DISPONIBLE' | 'OCUPADA' | 'LIMPIEZA' | 'MANTENIMIENTO';
  tipoHabitacion: TipoHabitacionDTO;
};

export type TarifaDTO = {
  id: number;
  precio: number;
  tipoHabitacionId: number;
  tipoAlquilerId: number;
  tipoHabitacion: TipoHabitacionDTO;
  tipoAlquiler: TipoAlquilerDTO;
};

export type EmpresaDTO = {
  id: number;
  nombre: string;
  ruc: string;
  telefono?: string;
};

export type AlquilerResponseDTO = {
  id: number;
  numeroHabitacion: string;
  nombreCliente: string;
  empresaNombre?: string;
  tipoAlquilerNombre?: string;
  totalPagadoCaja?: number;
  subTotal: number;
  pagoPendiente: number;
  fechaIngreso: string;
  fechaPrevista: string;
  fechaSalida?: string;
  estadoAlquiler: 'ACTIVO' | 'FINALIZADO';
  estadoHabitacion: 'DISPONIBLE' | 'OCUPADA' | 'LIMPIEZA' | 'MANTENIMIENTO';
  huespedes?: string[];
  // Campos para cálculo de preview
  precioFijado?: number;
  cantTiempo?: number;
  tipoAlquilerUnidad?: 'HORA' | 'DIA';
  tipoAlquilerMultiplicador?: number;
};

export type CuentaAlquilerDTO = {
  id: number;
  descripcion: string;
  precioUnit: number;
  cantidad: number;
  subTotal: number;
  estado: 'PENDIENTE' | 'PAGADO';
  alquilerId: number;
};

export type MovimientoCajaResponseDTO = {
  id: number;
  tipo: 'INGRESO' | 'INGRESO_EXTRA' | 'EGRESO' | 'PENDIENTE';
  monto: number;
  metodoPago: 'YAPE' | 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'PLIN';
  concepto: string;
  fecha: string;
  nombreUsuario: string;
  numeroHabitacion?: string;
  nombreCliente?: string;
  nombreEmpresa?: string;
  alquilerId?: number;
};

export type ResumenCajaDTO = {
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  cantidadMovimientos: number;
  movimientos: MovimientoCajaResponseDTO[];
};

// ── Request DTOs ────────────────────────────────────────────────────
export type LoginRequest = {
  numDocumento: string;
  password: string;
  rol?: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  numDocumento: string;
  nombre: string;
  rol: string;
};

export type CheckInRequestDTO = {
  idCliente: number;
  idHabitacion: number;
  idTipoAlquiler: number;
  cantTiempo: number;
  adelanto?: number;
  metodoPago?: 'YAPE' | 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'PLIN';
  idHuespedes?: number[];
};

export type GastoRequestDTO = {
  concepto: string;
  monto: number;
  metodoPago: 'YAPE' | 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'PLIN';
};

