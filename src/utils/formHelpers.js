/** Payment method options used across the entire app */
export const METODOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
];

/**
 * Sanitize decimal input (allow only digits + one dot, max 2 decimals).
 * Returns the cleaned string — caller decides where to store it.
 */
export function sanitizeDecimal(rawValue) {
  const normalized = String(rawValue || '').replace(',', '.');
  const cleaned = normalized.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const safe = parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join('')}`
    : cleaned;
  const [intPart = '', decPart = ''] = safe.split('.');
  return safe.includes('.')
    ? `${intPart}.${decPart.slice(0, 2)}`
    : intPart;
}

/**
 * Build tiposDocumentoPermitidos from the context's tiposDocumento array.
 * Filters to only ['DNI', 'CE', 'PASAPORTE'] with a static fallback.
 */
export function buildTiposDocPermitidos(tiposDocumento) {
  const ALLOWED = ['DNI', 'CE', 'PASAPORTE'];
  const source =
    Array.isArray(tiposDocumento) && tiposDocumento.length
      ? tiposDocumento
      : [
          { id: 1, nombre: 'DNI' },
          { id: 2, nombre: 'CE' },
          { id: 3, nombre: 'PASAPORTE' },
        ];
  return source.filter((td) => ALLOWED.includes(td?.nombre));
}

/** Check if an alquiler belongs to an empresa (consistent pattern) */
export function esAlquilerEmpresa(a) {
  return Boolean(a?.empresaNombre && a.empresaNombre !== '—');
}

/** Check if the current role can see empresa monetary data */
export function puedeVerMontos(isAdmin, esEmpresa) {
  return isAdmin || !esEmpresa;
}

/**
 * Converts ISO datetime string or Date to HTML5 datetime-local format (YYYY-MM-DDTHH:mm).
 * Handles timezone conversion and parse errors gracefully.
 * Used for datetime input elements that expect local time format.
 * 
 * @param {string|Date} isoDateTime - ISO datetime string or Date object
 * @returns {string} Formatted datetime-local string (YYYY-MM-DDTHH:mm) or current time on error
 */
export function formatToDatetimeLocal(isoDateTime) {
  try {
    const dateObj = new Date(isoDateTime || new Date());
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    // Fallback to current time if parse fails
    const now = new Date();
    return now.toISOString().substring(0, 16);
  }
}

/**
 * Calcula la cantidad de tiempo entre dos fechas basándose en unidad y multiplicador.
 * Replica la lógica del backend para preview instantáneo.
 * 
 * @param {string} unidad - 'HORA' o 'DIA'
 * @param {number} multiplicador - Multiplicador del tipo de alquiler (ej: 2 para "cada 2 horas")
 * @param {string|Date} inicio - Fecha de ingreso (ISO string o Date)
 * @param {string|Date} fin - Fecha de salida (ISO string o Date)
 * @returns {number} Cantidad de tiempo a cobrar (mínimo 1)
 */
export function calcularCantTiempoFrontend(unidad, multiplicador, inicio, fin) {
  try {
    const startDate = new Date(inicio + (inicio.includes('T') ? '' : 'T00:00:00Z'));
    const endDate = new Date(fin + (fin.includes('T') ? '' : 'T00:00:00Z'));
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return 0; // Invalid dates
    }
    
    let duracion = 0;
    if (unidad?.toUpperCase() === 'HORA') {
      // Calcular horas: diferencia en ms / (1000 * 60 * 60)
      duracion = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    } else if (unidad?.toUpperCase() === 'DIA') {
      // Calcular días: diferencia en ms / (1000 * 60 * 60 * 24)
      duracion = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    } else {
      return 0; // Unknown unit
    }
    
    // Math.ceil(duracion / multiplicador), mínimo 1
    const cant = Math.ceil(duracion / multiplicador);
    return cant <= 0 ? 1 : cant;
  } catch {
    return 0;
  }
}
