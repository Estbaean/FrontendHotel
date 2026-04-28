import { findMovimientoPagoConsumo, isMovimientoCajaActivo } from './cajaMovimientos';

export function toMoneyNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCuentaItemSubtotal(item) {
  if (!item) return 0;

  const subTotal = toMoneyNumber(item.subTotal);
  if (item.subTotal !== undefined && item.subTotal !== null && item.subTotal !== '') {
    return subTotal;
  }

  return toMoneyNumber(item.precioUnit) * toMoneyNumber(item.cantidad || 1);
}

export function getMovimientosPagadosTotal(movimientos = []) {
  return (movimientos || []).reduce((sum, movimiento) => {
    if (!movimiento) return sum;

    const tipo = movimiento.tipo;
    if (tipo === 'INGRESO' || tipo === 'INGRESO_EXTRA') {
      return sum + toMoneyNumber(movimiento.monto);
    }

    return sum;
  }, 0);
}

export function getMovimientosVisiblesCuenta(cuentaItems = [], movimientos = []) {
  const ignoredIds = new Set();

  (cuentaItems || [])
    .filter(item => item?.estado === 'PENDIENTE')
    .forEach((item) => {
      const candidato = findMovimientoPagoConsumo(
        (movimientos || []).filter(movimiento => !ignoredIds.has(movimiento?.id)),
        item,
      );

      if (candidato?.id != null) {
        ignoredIds.add(candidato.id);
      }
    });

  return {
    movimientosVisibles: (movimientos || []).filter(movimiento => !ignoredIds.has(movimiento?.id) && isMovimientoCajaActivo(movimiento)),
    movimientosIgnorados: (movimientos || []).filter(movimiento => ignoredIds.has(movimiento?.id)),
  };
}

export function buildAlquilerCuentaResumen({ alquiler, cuentaItems = [], movimientos = [] } = {}) {
  const basePrice = toMoneyNumber(alquiler?.subTotal);
  const totalConsumos = (cuentaItems || []).reduce((sum, item) => sum + getCuentaItemSubtotal(item), 0);
  const totalFactura = basePrice + totalConsumos;
  const { movimientosVisibles, movimientosIgnorados } = getMovimientosVisiblesCuenta(cuentaItems, movimientos);
  const totalPagado = getMovimientosPagadosTotal(movimientosVisibles);
  const saldoPendiente = totalFactura - totalPagado;

  return {
    basePrice,
    totalConsumos,
    totalFactura,
    totalPagado,
    saldoPendiente,
    movimientosVisibles,
    movimientosIgnorados,
  };
}

export function hasMoneyDifference(left, right, epsilon = 0.009) {
  return Math.abs(toMoneyNumber(left) - toMoneyNumber(right)) > epsilon;
}
