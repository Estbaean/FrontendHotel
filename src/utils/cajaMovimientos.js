function toCajaNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCajaText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasSameMonto(left, right, epsilon = 0.009) {
  return Math.abs(toCajaNumber(left) - toCajaNumber(right)) <= epsilon;
}

function getCuentaMonto(cuentaItem) {
  if (!cuentaItem) return 0;
  if (cuentaItem.subTotal !== undefined && cuentaItem.subTotal !== null && cuentaItem.subTotal !== '') {
    return toCajaNumber(cuentaItem.subTotal);
  }
  return toCajaNumber(cuentaItem.precioUnit) * toCajaNumber(cuentaItem.cantidad || 1);
}

export function isMovimientoCajaIngreso(movimiento) {
  return movimiento?.tipo === 'INGRESO' || movimiento?.tipo === 'INGRESO_EXTRA';
}

export function isMovimientoCajaEgreso(movimiento) {
  return movimiento?.tipo === 'EGRESO';
}

export function isMovimientoCajaPendiente(movimiento) {
  return movimiento?.tipo === 'PENDIENTE';
}

export function sumMovimientosCajaIngresos(movimientos = []) {
  return (movimientos || []).reduce(
    (sum, movimiento) => sum + (isMovimientoCajaIngreso(movimiento) ? toCajaNumber(movimiento?.monto) : 0),
    0,
  );
}

export function sumMovimientosCajaEgresos(movimientos = []) {
  return (movimientos || []).reduce(
    (sum, movimiento) => sum + (isMovimientoCajaEgreso(movimiento) ? toCajaNumber(movimiento?.monto) : 0),
    0,
  );
}

export function findMovimientoPagoConsumo(movimientos = [], cuentaItem) {
  const montoObjetivo = getCuentaMonto(cuentaItem);
  const descripcion = normalizeCajaText(cuentaItem?.descripcion);
  const ingresos = (movimientos || [])
    .filter(movimiento => isMovimientoCajaIngreso(movimiento) && toCajaNumber(movimiento?.monto) > 0.009)
    .sort((left, right) => new Date(right?.fecha || 0).getTime() - new Date(left?.fecha || 0).getTime());

  if (ingresos.length === 0 || montoObjetivo <= 0) return null;

  const exactosPorTexto = ingresos.filter((movimiento) => {
    const concepto = normalizeCajaText(movimiento?.concepto);
    return hasSameMonto(movimiento?.monto, montoObjetivo) && descripcion && concepto.includes(descripcion);
  });
  if (exactosPorTexto.length > 0) return exactosPorTexto[0];

  const exactosPorMonto = ingresos.filter(movimiento => hasSameMonto(movimiento?.monto, montoObjetivo));
  if (exactosPorMonto.length === 1) return exactosPorMonto[0];

  return null;
}

/** Movimiento con monto realmente positivo (no anulado a 0) */
export function isMovimientoCajaActivo(movimiento) {
  return toCajaNumber(movimiento?.monto) > 0.009;
}

/** Filtra movimientos cuya anulación dejó el monto en ~0 */
export function filterMovimientosActivos(movimientos = []) {
  return (movimientos || []).filter(isMovimientoCajaActivo);
}
