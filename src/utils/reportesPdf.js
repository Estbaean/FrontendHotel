import { jsPDF } from 'jspdf';
import { buildAlquilerCuentaResumen } from './alquilerCuenta';
import { isMovimientoCajaEgreso, isMovimientoCajaIngreso, isMovimientoCajaPendiente, filterMovimientosActivos } from './cajaMovimientos';

const BRAND_NAME = 'ARROYO Hospedaje';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/* ─── Paleta de colores ─── */
const C = {
  accent:    [212, 134, 12],
  accentDk:  [169, 107, 8],
  green:     [22, 163, 74],
  red:       [220, 38, 38],
  blue:      [37, 99, 235],
  dark:      [28, 25, 23],
  mid:       [68, 64, 60],
  muted:     [120, 113, 108],
  line:      [214, 211, 209],
  bg:        [250, 250, 249],
  headerBg:  [212, 134, 12],
  headerTxt: [255, 255, 255],
};

/* ─── Helpers responsivos (portrait / landscape) ─── */

function writeHeader(doc, title, subtitle) {
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date();
  const dia = DIAS_LARGO[now.getDay()];
  const dd = now.getDate();
  const mes = MESES[now.getMonth()];
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const generatedAt = `${dia} ${dd} de ${mes} de ${yyyy} — ${hh}:${mi}`;

  /* Barra superior con color de marca */
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND_NAME, 14, 12);

  /* Timestamp alineado a la derecha */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(210, 245, 240);
  doc.text(`Generado: ${generatedAt}`, pageW - 14, 18, { align: 'right' });

  /* Título debajo de la barra */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.dark);
  doc.text(title, 14, 38);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.muted);
    doc.text(subtitle, 14, 44);
    return 52;
  }
  return 46;
}

function drawTableHeader(doc, y, columns, fontSize = 8) {
  const tableW = doc.internal.pageSize.getWidth() - 28;
  doc.setFillColor(...C.headerBg);
  doc.rect(14, y - 5, tableW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(...C.headerTxt);

  let x = 14;
  columns.forEach((col) => {
    const align = col.align || 'left';
    const textX = align === 'right' ? x + col.width - 3 : x + 2;
    doc.text(col.label.toUpperCase(), textX, y, align === 'right' ? { align: 'right' } : undefined);
    x += col.width;
  });

  doc.setTextColor(0);
  return y + 8;
}

function drawRowBg(doc, y, index, rowH = 8) {
  const tableW = doc.internal.pageSize.getWidth() - 28;
  if (index % 2 === 0) {
    doc.setFillColor(248, 250, 249);
    doc.rect(14, y - 4.5, tableW, rowH, 'F');
  }
}

/** Considera empresa solo si el campo tiene valor real (no nulo, vacío ni "—") */
function tieneEmpresa(nombre) {
  return Boolean(nombre && nombre !== '—');
}

/* Pills de resumen — usadas en reportes de finalizados */
function drawSummaryPills(doc, y, pills) {
  const pillW = 54;
  const pillH = 10;
  const pillGap = 5;
  pills.forEach((p, i) => {
    const px = 14 + i * (pillW + pillGap);
    doc.setFillColor(...p.bg);
    doc.setDrawColor(...p.color);
    doc.setLineWidth(0.4);
    doc.roundedRect(px, y - 6, pillW, pillH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...p.color);
    doc.text(p.label, px + pillW / 2, y, { align: 'center' });
  });
  doc.setLineWidth(0.2);
  doc.setTextColor(0);
  return y + pillH + 2;
}

function formatDateOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE');
}

function formatDateDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = DIAS_CORTO[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dia} ${dd}/${mm}/${yyyy}`;
}

function formatDateTimeDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = DIAS_CORTO[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dia} ${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function normalizeDateForFilename() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/* ═══════════════════════════════════════════════════════════
   REPORTE DE CAJA
   ═══════════════════════════════════════════════════════════ */
export function descargarReporteCajaMovimientos(movimientos, filtros = {}) {
  const doc = new jsPDF();
  const isAdminExport = filtros?.isAdmin !== false;
  const resumen = filtros?.resumen || {};
  const movs = filterMovimientosActivos(movimientos);
  let y = writeHeader(doc, 'Reporte de Caja', null);

  /* ─── Filtros aplicados ─── */
  const filtroLines = [];
  if (filtros?.desde && filtros?.hasta) filtroLines.push(`Periodo: ${filtros.desde} — ${filtros.hasta}`);
  else if (filtros?.desde) filtroLines.push(`Desde: ${filtros.desde}`);
  else if (filtros?.hasta) filtroLines.push(`Hasta: ${filtros.hasta}`);
  else filtroLines.push('Periodo: Todo');
  if (filtros?.filtroTipo) filtroLines.push(`Tipo: ${filtros.filtroTipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}`);  
  if (filtros?.filtroEmpresa) filtroLines.push(`Empresa: ${filtros.filtroEmpresa}`);
  if (filtros?.search) filtroLines.push(`Búsqueda: "${filtros.search}"`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  filtroLines.forEach(line => {
    doc.text(line, 14, y);
    y += 4.5;
  });
  y += 4;

  const totalIngresos = Number(resumen.totalIngresos || 0);
  const totalEgresos = Number(resumen.totalEgresos || 0);
  const balance = Number(resumen.balance || 0);
  const movimientosCount = Number(resumen.cantidadMovimientos || 0);

  /* Tarjetas de resumen */
  const cardW = 43;
  const cardH = 22;
  const cardGap = 2;
  const cards = [
    { label: 'INGRESOS',    value: `S/ ${totalIngresos.toFixed(2)}`, color: C.green },
    { label: 'EGRESOS',     value: `S/ ${totalEgresos.toFixed(2)}`,  color: C.red },
    { label: 'BALANCE',     value: `S/ ${balance.toFixed(2)}`,       color: balance >= 0 ? C.accent : C.red },
    { label: 'MOVIMIENTOS', value: String(movimientosCount),          color: C.mid },
  ];

  cards.forEach((card, i) => {
    const x = 14 + i * (cardW + cardGap);
    /* Fondo sutil */
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(...C.line);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
    /* Línea de color arriba */
    doc.setFillColor(...card.color);
    doc.rect(x, y, cardW, 2.5, 'F');
    /* Etiqueta */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(card.label, x + 3, y + 9);
    /* Valor */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 3, y + 17);
  });

  doc.setTextColor(0);
  y += cardH + 10;

  const columns = [
    { label: 'Fecha', width: 34 },
    { label: 'Tipo', width: 16 },
    { label: 'Concepto', width: 52 },
    { label: 'Cliente', width: 38 },
    { label: 'Método', width: 24 },
    { label: 'Monto', width: 18, align: 'right' },
  ];

  y = drawTableHeader(doc, y, columns);

  doc.setFontSize(8.5);

  movs.forEach((row, idx) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
      y = drawTableHeader(doc, y, columns);
      doc.setFontSize(8.5);
    }

    drawRowBg(doc, y, idx);

    const fecha = formatDateDay(row?.fecha);
    const tipo = String(row?.tipo || '—');
    const descripcion = String(row?.concepto || '—').slice(0, 30);
    const esCorporativo = Boolean(row?.nombreEmpresa && row.nombreEmpresa !== '—');
    const ocultar = !isAdminExport && esCorporativo;
    const clienteNombre = String(row?.nombreCliente || '—').slice(0, 20);
    const empresaNom = esCorporativo ? String(row.nombreEmpresa).slice(0, 18) : '';
    const metodo = (ocultar || esCorporativo) ? '' : String(row?.metodoPago || '—');
    const monto = Number(row?.monto || 0);
    const esEgreso = isMovimientoCajaEgreso(row);
    const esPendiente = isMovimientoCajaPendiente(row);
    const montoStr = ocultar ? '—' : `${tipo === 'EGRESO' ? '-' : ''}S/ ${monto.toFixed(2)}`;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.mid);
    doc.text(fecha, 16, y);

    const isEgreso = tipo === 'EGRESO';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(isEgreso ? C.red : C.green));
    doc.text(isEgreso ? 'Egreso' : 'Ingreso', 50, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    doc.text(descripcion, 66, y);

    /* Cliente + empresa debajo */
    doc.setTextColor(...C.dark);
    doc.text(clienteNombre, 118, y);
    if (empresaNom) {
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(empresaNom, 118, y + 3.5);
      doc.setFontSize(8.5);
    }

    doc.setTextColor(...C.muted);
    doc.text(metodo, 156, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(isEgreso ? C.red : C.dark));
    doc.text(montoStr, 196, y, { align: 'right' });

    doc.setDrawColor(...C.line);
    doc.line(14, y + (empresaNom ? 4.5 : 2.5), 196, y + (empresaNom ? 4.5 : 2.5));
    y += empresaNom ? 9 : 7;
  });

  if (!movs.length) {
    doc.setTextColor(...C.muted);
    doc.text('No hay movimientos para exportar con los filtros actuales.', 14, y + 4);
    doc.setTextColor(0);
  }

  /* Pie de página */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`${BRAND_NAME} — Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
  }

  doc.save(`caja-movimientos-${normalizeDateForFilename()}.pdf`);
}

/* ═══════════════════════════════════════════════════════════
   REPORTE DE ALQUILERES ACTIVOS  (landscape A4)
   ═══════════════════════════════════════════════════════════ */
export function descargarReporteAlquileresActivos(alquileres) {
  const doc = new jsPDF('l');                                  // landscape A4
  const pageW = doc.internal.pageSize.getWidth();              // 297
  const pageH = doc.internal.pageSize.getHeight();             // 210
  const totalActivos = (alquileres || []).length;
  let y = writeHeader(
    doc,
    'Reporte de Alquileres Activos',
    `${totalActivos} alquiler${totalActivos !== 1 ? 'es' : ''} activo${totalActivos !== 1 ? 's' : ''} al momento de la descarga`,
  );

  /* Columnas: 24+72+46+46+61 = 249 + margen ajustado para 269 */
  const columns = [
    { label: 'Hab.',     width: 24 },
    { label: 'Cliente',  width: 80 },
    { label: 'Ingreso',  width: 52 },
    { label: 'Salida',   width: 52 },
    { label: 'Firma',    width: 61 },
  ];

  y = drawTableHeader(doc, y, columns, 9);

  /* Posiciones X de cada columna (14 base + acumulado + 2 padding) */
  const X = { hab: 16, cli: 40, ing: 120, sal: 172, firma: 224 };

  doc.setFontSize(10);

  (alquileres || []).forEach((row, idx) => {
    const tipo = row?.tipoAlquilerNombre || '';
    const empresa = tieneEmpresa(row?.empresaNombre) ? row.empresaNombre : '';
    const hasSecondLine = tipo || empresa;
    const rowH = hasSecondLine ? 11 : 8;

    if (y > pageH - 18) {
      doc.addPage();
      y = writeHeader(doc, 'Reporte de Alquileres Activos', null);
      y = drawTableHeader(doc, y, columns, 9);
      doc.setFontSize(10);
    }

    drawRowBg(doc, y, idx, rowH);

    const habitacion = String(row?.numeroHabitacion || '—');
    const cliente = String(row?.nombreCliente || '—').slice(0, 42);
    const ingreso = formatDateTimeDay(row?.fechaIngreso);
    const salida = formatDateTimeDay(row?.fechaPrevista);

    /* Habitación + tipo como segunda línea */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.accent);
    doc.text(habitacion, X.hab, y);
    if (tipo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(tipo, X.hab, y + 4);
      doc.setFontSize(10);
    }

    /* Cliente + empresa debajo */
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    doc.text(cliente, X.cli, y);
    if (empresa) {
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(empresa.slice(0, 40), X.cli, y + 4);
      doc.setFontSize(10);
    }

    doc.setTextColor(...C.mid);
    doc.text(ingreso, X.ing, y);
    doc.text(salida, X.sal, y);

    /* Cuadro de firma */
    doc.setDrawColor(...C.line);
    doc.rect(X.firma, y - 4, 55, 6);

    /* Separador entre filas */
    const lineY = tipo ? y + 5.5 : y + 2.5;
    doc.setDrawColor(...C.line);
    doc.line(14, lineY, pageW - 14, lineY);
    y += rowH;
  });

  if (!alquileres || alquileres.length === 0) {
    doc.setTextColor(...C.muted);
    doc.text('No hay alquileres activos para exportar en la vista actual.', 14, y + 4);
    doc.setTextColor(0);
  }

  /* Pie de página centrado en landscape */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`${BRAND_NAME} — Página ${i} de ${pageCount}`, pageW / 2, pageH - 10, { align: 'center' });
  }

  doc.save(`alquileres-activos-${normalizeDateForFilename()}.pdf`);
}

/* ═══════════════════════════════════════════════════════════
   REPORTE DE ALQUILERES FINALIZADOS  (landscape A4)
   ═══════════════════════════════════════════════════════════ */
export function descargarReporteFinalizados(alquileres, filtros = {}) {
  const doc = new jsPDF('l');
  const pageW = doc.internal.pageSize.getWidth();   // 297
  const pageH = doc.internal.pageSize.getHeight();  // 210

  const total             = (alquileres || []).length;
  const totalEmpresas     = (alquileres || []).filter(a => tieneEmpresa(a.empresaNombre)).length;
  const totalParticulares = total - totalEmpresas;

  /* Subtítulo: filtros activos o indicador general */
  const partesFiltro = [];
  if (filtros.desde && filtros.hasta)          partesFiltro.push(`${filtros.desde} — ${filtros.hasta}`);
  else if (filtros.desde)                      partesFiltro.push(`Desde ${filtros.desde}`);
  else if (filtros.hasta)                      partesFiltro.push(`Hasta ${filtros.hasta}`);
  if (filtros.empresa)                         partesFiltro.push(`Empresa: ${filtros.empresa}`);
  if (filtros.condicion === 'SOLO_EMPRESAS')   partesFiltro.push('Solo empresas');
  if (filtros.condicion === 'SOLO_CLIENTES')   partesFiltro.push('Solo particulares');
  if (filtros.search)                          partesFiltro.push(`"${filtros.search}"`);
  const subtitulo = partesFiltro.length ? partesFiltro.join(' · ') : 'Todos los registros';

  let y = writeHeader(doc, 'Reporte de Alquileres Finalizados', subtitulo);

  /* ─── Resumen en pills ─── */
  y = drawSummaryPills(doc, y, [
    { label: `${total} Finalizado${total !== 1 ? 's' : ''}`,                           color: C.mid,  bg: [245, 244, 243] },
    { label: `${totalEmpresas} Empresa${totalEmpresas !== 1 ? 's' : ''}`,              color: C.blue, bg: [239, 246, 255] },
    { label: `${totalParticulares} Particular${totalParticulares !== 1 ? 'es' : ''}`,  color: C.green, bg: [240, 253, 244] },
  ]);

  /* Columnas: 28+102+52+52+35 = 269 = 297-28 */
  const columns = [
    { label: 'Hab.',              width: 28 },
    { label: 'Cliente / Empresa', width: 102 },
    { label: 'Ingreso',           width: 52 },
    { label: 'Salida Real',       width: 52 },
    { label: 'Firma',             width: 35 },
  ];

  y = drawTableHeader(doc, y, columns, 9);

  const X = { hab: 16, cli: 44, ing: 146, sal: 198, firma: 250 };

  doc.setFontSize(9.5);

  (alquileres || []).forEach((row, idx) => {
    const tipo    = row?.tipoAlquilerNombre || '';
    const empresa = tieneEmpresa(row?.empresaNombre) ? row.empresaNombre : '';
    const hasSecondLine = tipo || empresa;
    const rowH = hasSecondLine ? 11 : 8;

    if (y > pageH - 18) {
      doc.addPage();
      y = writeHeader(doc, 'Reporte de Alquileres Finalizados', null);
      y = drawTableHeader(doc, y, columns, 9);
      doc.setFontSize(9.5);
    }

    drawRowBg(doc, y, idx, rowH);

    /* Hab. + tipo */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.accent);
    doc.text(String(row?.numeroHabitacion || '—'), X.hab, y);
    if (tipo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(tipo, X.hab, y + 4);
    }

    /* Cliente + empresa (empresa en azul, sin columna Cond. separada) */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.dark);
    doc.text(String(row?.nombreCliente || '—').slice(0, 52), X.cli, y);
    if (empresa) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.blue);
      doc.text(empresa.slice(0, 52), X.cli, y + 4);
    }

    /* Fechas */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.mid);
    doc.text(formatDateTimeDay(row?.fechaIngreso),                        X.ing, y);
    doc.text(row?.fechaSalida ? formatDateTimeDay(row.fechaSalida) : '—', X.sal, y);

    /* Recuadro de firma */
    doc.setDrawColor(...C.line);
    doc.rect(X.firma, y - 4, 28, 6.5);

    /* Separador */
    const lineY = hasSecondLine ? y + 5.5 : y + 2.5;
    doc.setDrawColor(...C.line);
    doc.line(14, lineY, pageW - 14, lineY);
    y += rowH;
  });

  if (!alquileres || alquileres.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('No hay alquileres finalizados con los filtros actuales.', 14, y + 4);
    doc.setTextColor(0);
  }

  /* Pie */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`${BRAND_NAME} — Página ${i} de ${pageCount}`, pageW / 2, pageH - 10, { align: 'center' });
  }

  doc.save(`alquileres-finalizados-${normalizeDateForFilename()}.pdf`);
}

/* ═══════════════════════════════════════════════════════════
   BOLETA DE CHECKOUT  (portrait A4)
   ═══════════════════════════════════════════════════════════ */
export function generarBoletaCheckout(alquiler, consumos = [], movimientos = [], { isAdmin = true } = {}) {
  const esEmpresa = tieneEmpresa(alquiler?.empresaNombre) || Boolean(alquiler?.empresaId);
  const mostrarPrecios = isAdmin || !esEmpresa;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  let y = writeHeader(doc, 'Comprobante de Estadía', null);

  /* ─── Datos del huésped ─── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text('DATOS DEL HUÉSPED', 14, y);
  y += 6;

  const guestRows = [
    ['Cliente', String(alquiler?.nombreCliente || '—')],
    ['Habitación', String(alquiler?.numeroHabitacion || '—')],
    ['Tipo', String(alquiler?.tipoAlquilerNombre || '—')],
    ...(tieneEmpresa(alquiler?.empresaNombre) ? [['Empresa', alquiler.empresaNombre]] : []),
    ['Ingreso', formatDateTime(alquiler?.fechaIngreso)],
    ['Salida', formatDateTime(alquiler?.fechaSalida || alquiler?.fechaPrevista)],
  ];

  doc.setFontSize(9.5);
  guestRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.mid);
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    doc.text(value, 50, y);
    y += 5.5;
  });

  y += 6;

  /* ─── Detalle de cargos ─── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text('DETALLE DE CARGOS', 14, y);
  y += 6;

  if (mostrarPrecios) {
    const itemCols = [
      { label: 'Concepto', width: 80 },
      { label: 'Cant.', width: 18 },
      { label: 'P.Unit', width: 30, align: 'right' },
      { label: 'Subtotal', width: 30, align: 'right' },
    ];

    y = drawTableHeader(doc, y, itemCols);

    /* Fila base: alquiler */
    const precioFijado = Number(alquiler?.subTotal || 0);
    drawRowBg(doc, y, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    doc.text('Alquiler de habitación', 16, y);
    doc.setTextColor(...C.mid);
    doc.text('1', 96, y);
    doc.setTextColor(...C.dark);
    doc.text(`S/ ${precioFijado.toFixed(2)}`, 140, y, { align: 'right' });
    doc.text(`S/ ${precioFijado.toFixed(2)}`, 170, y, { align: 'right' });
    doc.setDrawColor(...C.line);
    doc.line(14, y + 3, 172, y + 3);
    y += 7;

    /* Consumos adicionales */
    (consumos || []).forEach((item, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      drawRowBg(doc, y, idx + 1);
      const desc = String(item?.descripcion || '—').slice(0, 45);
      const cant = Number(item?.cantidad || 1);
      const pu = Number(item?.precioUnit || 0);
      const sub = Number(item?.subTotal || pu * cant);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.dark);
      doc.text(desc, 16, y);
      doc.setTextColor(...C.mid);
      doc.text(String(cant), 96, y);
      doc.setTextColor(...C.dark);
      doc.text(`S/ ${pu.toFixed(2)}`, 140, y, { align: 'right' });
      doc.text(`S/ ${sub.toFixed(2)}`, 170, y, { align: 'right' });
      doc.setDrawColor(...C.line);
      doc.line(14, y + 3, 172, y + 3);
      y += 7;
    });

    y += 4;

    /* ─── Totales ─── */
    const resumenCuenta = buildAlquilerCuentaResumen({
      alquiler,
      cuentaItems: consumos,
      movimientos,
    });
    const precioFijadoTotales = resumenCuenta.basePrice;
    const totalPagado = resumenCuenta.totalPagado;
    const pendiente = resumenCuenta.saldoPendiente;
    const totalGeneral = resumenCuenta.totalFactura;

    const totales = [
      ['Total cargos', `S/ ${totalGeneral.toFixed(2)}`, C.dark],
      ['Pagado', `S/ ${totalPagado.toFixed(2)}`, C.green],
      ['Pendiente', `S/ ${pendiente.toFixed(2)}`, pendiente > 0 ? C.red : C.green],
    ];

    totales.forEach(([label, value, color]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.mid);
      doc.text(label, 110, y);
      doc.setTextColor(...color);
      doc.text(value, 170, y, { align: 'right' });
      y += 6;
    });

    y += 6;

    /* ─── Historial de pagos ─── */
    const movsBoleta = filterMovimientosActivos(movimientos);
    if (movsBoleta.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.accent);
      doc.text('HISTORIAL DE PAGOS', 14, y);
      y += 6;

      const paymentCols = [
        { label: 'Fecha', width: 42 },
        { label: 'Concepto', width: 68 },
        { label: 'Método', width: 28 },
        { label: 'Monto', width: 30, align: 'right' },
      ];

      y = drawTableHeader(doc, y, paymentCols);

      movsBoleta.forEach((m, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        drawRowBg(doc, y, idx);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...C.mid);
        doc.text(formatDateTime(m?.fecha), 16, y);
        doc.setTextColor(...C.dark);
        doc.text(String(m?.concepto || '—').slice(0, 38), 58, y);
        doc.setTextColor(...C.muted);
        doc.text(String(m?.metodoPago || '—'), 126, y);
        const monto = Number(m?.monto || 0);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...(m?.tipo === 'EGRESO' ? C.red : C.green));
        doc.text(`S/ ${monto.toFixed(2)}`, 170, y, { align: 'right' });
        y += 7;
      });
    }
  } else {
    /* Recepcionista + cliente empresa: mostrar conceptos sin precios */
    const itemColsOcultos = [
      { label: 'Concepto', width: 110 },
      { label: 'Cant.', width: 18 },
    ];

    y = drawTableHeader(doc, y, itemColsOcultos);

    drawRowBg(doc, y, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    doc.text('Alquiler de habitación', 16, y);
    doc.setTextColor(...C.mid);
    doc.text('1', 96, y);
    doc.setDrawColor(...C.line);
    doc.line(14, y + 3, 172, y + 3);
    y += 7;

    (consumos || []).forEach((item, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      drawRowBg(doc, y, idx + 1);
      const desc = String(item?.descripcion || '—').slice(0, 60);
      const cant = Number(item?.cantidad || 1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.dark);
      doc.text(desc, 16, y);
      doc.setTextColor(...C.mid);
      doc.text(String(cant), 96, y);
      doc.setDrawColor(...C.line);
      doc.line(14, y + 3, 172, y + 3);
      y += 7;
    });

    y += 4;
  }

  y += 10;

  /* ─── Pie ─── */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.muted);
  doc.text('Gracias por su preferencia', pageW / 2, y, { align: 'center' });

  /* Pie de página */
  doc.setFontSize(7);
  doc.text(`${BRAND_NAME} — Comprobante generado automáticamente`, pageW / 2, 290, { align: 'center' });

  doc.save(`boleta-hab${alquiler?.numeroHabitacion || 'X'}-${normalizeDateForFilename()}.pdf`);
}

/* ═══════════════════════════════════════════════════════════
   CIERRE DE CAJA  (portrait A4)
   ═══════════════════════════════════════════════════════════ */
export function generarCierreCaja(movimientos, resumen = {}, periodo = '') {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 'Cierre de Caja', periodo || 'Periodo actual');

  const totalIngresos = Number(resumen.totalIngresos || 0);
  const totalEgresos = Number(resumen.totalEgresos || 0);
  const balance = Number(resumen.balance || 0);

  const movs = filterMovimientosActivos(movimientos);

  /* ─── Resumen por método de pago ─── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text('RESUMEN POR MÉTODO DE PAGO', 14, y);
  y += 7;

  const metodos = ['EFECTIVO', 'YAPE', 'TARJETA', 'TRANSFERENCIA'];
  const byMetodo = {};
  metodos.forEach(m => { byMetodo[m] = { ingresos: 0, egresos: 0 }; });
  movs.forEach(m => {
    const met = m?.metodoPago || 'EFECTIVO';
    if (!byMetodo[met]) byMetodo[met] = { ingresos: 0, egresos: 0 };
    if (isMovimientoCajaIngreso(m)) byMetodo[met].ingresos += Number(m?.monto || 0);
    else if (isMovimientoCajaEgreso(m)) byMetodo[met].egresos += Number(m?.monto || 0);
  });

  /* Header de tabla resumen */
  const resCols = [
    { label: 'Método', width: 42 },
    { label: 'Ingresos', width: 38, align: 'right' },
    { label: 'Egresos', width: 38, align: 'right' },
    { label: 'Neto', width: 38, align: 'right' },
  ];
  y = drawTableHeader(doc, y, resCols);

  let idx = 0;
  metodos.forEach(met => {
    const d = byMetodo[met];
    if (d.ingresos === 0 && d.egresos === 0) return;
    drawRowBg(doc, y, idx);
    const neto = d.ingresos - d.egresos;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.dark);
    doc.text(met, 16, y);

    doc.setTextColor(...C.green);
    doc.text(`S/ ${d.ingresos.toFixed(2)}`, 92, y, { align: 'right' });

    doc.setTextColor(...C.red);
    doc.text(`S/ ${d.egresos.toFixed(2)}`, 130, y, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(neto >= 0 ? C.accent : C.red));
    doc.text(`S/ ${neto.toFixed(2)}`, 168, y, { align: 'right' });

    doc.setDrawColor(...C.line);
    doc.line(14, y + 3, 170, y + 3);
    y += 7;
    idx++;
  });

  /* Fila de totales */
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text('TOTALES', 16, y);
  doc.setTextColor(...C.green);
  doc.text(`S/ ${totalIngresos.toFixed(2)}`, 92, y, { align: 'right' });
  doc.setTextColor(...C.red);
  doc.text(`S/ ${totalEgresos.toFixed(2)}`, 130, y, { align: 'right' });
  doc.setTextColor(...(balance >= 0 ? C.accent : C.red));
  doc.text(`S/ ${balance.toFixed(2)}`, 168, y, { align: 'right' });
  y += 10;

  /* ─── Detalle de movimientos ─── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text('DETALLE DE MOVIMIENTOS', 14, y);
  y += 7;

  const detCols = [
    { label: 'Fecha', width: 32 },
    { label: 'Tipo', width: 18 },
    { label: 'Concepto', width: 58 },
    { label: 'Método', width: 26 },
    { label: 'Monto', width: 30, align: 'right' },
  ];
  y = drawTableHeader(doc, y, detCols);

  doc.setFontSize(8.5);
  movs.forEach((row, i) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
      y = drawTableHeader(doc, y, detCols);
      doc.setFontSize(8.5);
    }

    drawRowBg(doc, y, i);
    const fecha = formatDateOnly(row?.fecha);
    const tipo = String(row?.tipo || '—');
    const concepto = String(row?.concepto || '—').slice(0, 35);
    const metodo = String(row?.metodoPago || '—');
    const monto = Number(row?.monto || 0);
    const esEgreso = isMovimientoCajaEgreso(row);
    const esPendiente = isMovimientoCajaPendiente(row);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.mid);
    doc.text(fecha, 16, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(esEgreso ? C.red : esPendiente ? C.accent : C.green));
    doc.text(esEgreso ? 'Egreso' : esPendiente ? 'Pend.' : 'Ingreso', 48, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    doc.text(concepto, 66, y);

    doc.setTextColor(...C.muted);
    doc.text(metodo, 124, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(esEgreso ? C.red : esPendiente ? C.accent : C.dark));
    doc.text(`${esEgreso ? '-' : ''}S/ ${monto.toFixed(2)}`, 178, y, { align: 'right' });

    doc.setDrawColor(...C.line);
    doc.line(14, y + 2.5, 180, y + 2.5);
    y += 7;
  });

  /* ─── Firma ─── */
  y += 20;
  if (y > 260) { doc.addPage(); y = 40; }
  doc.setDrawColor(...C.mid);
  doc.line(50, y, 160, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.mid);
  doc.text('Responsable de turno', pageW / 2, y + 5, { align: 'center' });

  /* Pie de página */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`${BRAND_NAME} — Página ${i} de ${pageCount}`, pageW / 2, 290, { align: 'center' });
  }

  doc.save(`cierre-caja-${normalizeDateForFilename()}.pdf`);
}

/* ====================================================================
   Reporte de movimientos por Empresa
   ==================================================================== */
export function generarReporteEmpresa(movimientos, empresaNombre, periodo = '') {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, `Reporte — ${empresaNombre}`, periodo || 'Periodo actual');

  const movsEmpresa = filterMovimientosActivos(movimientos).filter(m => m?.nombreEmpresa === empresaNombre);

  /* ─── Resumen ─── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text('RESUMEN DE MOVIMIENTOS', 14, y);
  y += 8;

  const totalIngresos = movsEmpresa.filter(m => m?.tipo !== 'EGRESO').reduce((s, m) => s + Number(m?.monto || 0), 0);
  const totalEgresos = movsEmpresa.filter(m => m?.tipo === 'EGRESO').reduce((s, m) => s + Number(m?.monto || 0), 0);
  const balance = totalIngresos - totalEgresos;

  const resLabels = [
    { label: 'Total Ingresos:', value: `S/ ${totalIngresos.toFixed(2)}`, color: C.green },
    { label: 'Total Egresos:', value: `S/ ${totalEgresos.toFixed(2)}`, color: C.red },
    { label: 'Balance:', value: `S/ ${balance.toFixed(2)}`, color: balance >= 0 ? C.accent : C.red },
    { label: 'Movimientos:', value: String(movsEmpresa.length), color: C.dark },
  ];
  resLabels.forEach(r => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.mid);
    doc.text(r.label, 16, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...r.color);
    doc.text(r.value, 65, y);
    y += 6;
  });
  y += 6;

  /* ─── Detalle ─── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text('DETALLE DE MOVIMIENTOS', 14, y);
  y += 7;

  const cols = [
    { label: 'Fecha', width: 32 },
    { label: 'Tipo', width: 18 },
    { label: 'Hab.', width: 16 },
    { label: 'Cliente', width: 40 },
    { label: 'Concepto', width: 42 },
    { label: 'Método', width: 24 },
    { label: 'Monto', width: 28, align: 'right' },
  ];
  y = drawTableHeader(doc, y, cols);

  doc.setFontSize(8.5);
  movsEmpresa.forEach((row, i) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
      y = drawTableHeader(doc, y, cols);
      doc.setFontSize(8.5);
    }

    drawRowBg(doc, y, i);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.mid);
    doc.text(formatDateOnly(row?.fecha), 16, y);

    const tipo = String(row?.tipo || '—');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(tipo === 'EGRESO' ? C.red : C.green));
    doc.text(tipo === 'EGRESO' ? 'Egreso' : 'Ingreso', 48, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    doc.text(String(row?.numeroHabitacion || '—'), 66, y);
    doc.text(String(row?.nombreCliente || '—').slice(0, 22), 82, y);
    doc.text(String(row?.concepto || '—').slice(0, 24), 122, y);

    doc.setTextColor(...C.muted);
    doc.text(String(row?.metodoPago || '—'), 164, y);

    const monto = Number(row?.monto || 0);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(tipo === 'EGRESO' ? C.red : C.dark));
    doc.text(`${tipo === 'EGRESO' ? '-' : ''}S/ ${monto.toFixed(2)}`, pageW - 14, y, { align: 'right' });

    doc.setDrawColor(...C.line);
    doc.line(14, y + 2.5, pageW - 14, y + 2.5);
    y += 7;
  });

  /* ─── Firma ─── */
  y += 20;
  if (y > 260) { doc.addPage(); y = 40; }
  doc.setDrawColor(...C.mid);
  doc.line(50, y, 160, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.mid);
  doc.text('Responsable de turno', pageW / 2, y + 5, { align: 'center' });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`${BRAND_NAME} — Página ${i} de ${pageCount}`, pageW / 2, 290, { align: 'center' });
  }

  const safeName = empresaNombre.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`reporte-empresa-${safeName}-${normalizeDateForFilename()}.pdf`);
}

/* ═══════════════════════════════════════════════════════════
   REGISTRO DE ASISTENCIA  (landscape A4)
   Un registro por huésped (expande alquiler.huespedes[]).
   Columnas: Item | Nombres y Apellidos | N° Hab. | Hora Salida | Firma | Hora Llegada | Firma
   ═══════════════════════════════════════════════════════════ */
export function generarRegistroAsistencia(alquileres, empresaNombre, fecha) {
  const doc = new jsPDF('l');
  const pageW = doc.internal.pageSize.getWidth();   // 297
  const pageH = doc.internal.pageSize.getHeight();  // 210

  /* ─── Timestamp de impresión ─── */
  const now = new Date();
  const diaLargo  = DIAS_LARGO[now.getDay()];
  const ddNow     = now.getDate();
  const mesNow    = MESES[now.getMonth()];
  const yyyyNow   = now.getFullYear();
  const hhNow     = String(now.getHours()).padStart(2, '0');
  const miNow     = String(now.getMinutes()).padStart(2, '0');
  const fechaImpresion = `${diaLargo} ${ddNow} de ${mesNow} de ${yyyyNow}   ${hhNow}:${miNow}`;

  /* ─── Encabezado (brand + título) ─── */
  /* Barra de marca */
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND_NAME, 14, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('REGISTRO DE ASISTENCIA', pageW / 2, 11, { align: 'center' });

  /* Empresa en la misma barra, derecha */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 220);
  doc.text(`EMPRESA: ${(empresaNombre || '—').toUpperCase()}`, pageW - 14, 11, { align: 'right' });

  /* Segunda línea barra: nombre empresa grande centrado */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text((empresaNombre || '—').toUpperCase(), pageW / 2, 20, { align: 'center' });

  let y = 32;

  /* ─── Banner de fecha de impresión ─── */
  /* Fondo con bordes redondeados */
  doc.setFillColor(255, 248, 225); // warm amber tint
  doc.setDrawColor(...C.accentDk);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, y - 5, pageW - 28, 11, 2, 2, 'FD');

  /* Icono — texto "📅" simulado con label */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.accentDk);
  doc.text('FECHA DE IMPRESIÓN', 18, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.dark);
  doc.text(fechaImpresion, 75, y);

  /* Total de huéspedes alineado a la derecha en el mismo banner */
  const totalHuespedes = (alquileres || []).reduce((s, a) => {
    return s + ((a.huespedes && a.huespedes.length > 0) ? a.huespedes.length : 1);
  }, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.accentDk);
  doc.text(`Total huéspedes: ${totalHuespedes}`, pageW - 16, y, { align: 'right' });
  doc.setLineWidth(0.2);

  y += 10;

  /* ─── Tabla ─── */
  /* Columnas: 12+80+16+42+38+42+39 = 269 = 297-28 */
  const columns = [
    { label: 'Item',                width: 12 },
    { label: 'Apellidos y Nombres', width: 80 },
    { label: 'N° Hab.',             width: 16 },
    { label: 'Hora Salida',         width: 42 },
    { label: 'Firma',               width: 38 },
    { label: 'Hora Llegada',        width: 42 },
    { label: 'Firma',               width: 39 },
  ];

  y = drawTableHeader(doc, y, columns, 8);

  /*
   * X positions (cumulative from 14):
   * col0: starts 14 w=12 → Xitem=16
   * col1: starts 26 w=80 → Xnom=28
   * col2: starts 106 w=16 → Xhab=108
   * col3: starts 122 w=42 → Xsal=124
   * col4: starts 164 w=38 → XF1 rect at 165
   * col5: starts 202 w=42 → Xlleg=204
   * col6: starts 244 w=39 → XF2 rect at 245
   */
  const Xitem = 16;
  const Xnom  = 28;
  const Xhab  = 108;
  const Xsal  = 124;
  const XF1   = 165;  // Firma 1 rect
  const Xlleg = 204;
  const XF2   = 245;  // Firma 2 rect

  /* Expand cada alquiler a una fila por huésped */
  const rows = [];
  (alquileres || []).forEach(a => {
    const nombres = (a.huespedes && a.huespedes.length > 0) ? a.huespedes : [a.nombreCliente];
    nombres.forEach(nombre => {
      rows.push({
        nombre,
        hab:     a.numeroHabitacion,
        salida:  a.fechaSalida  || null,
        llegada: a.fechaIngreso || null,
      });
    });
  });

  const rowH = 9;

  rows.forEach((row, idx) => {
    if (y > pageH - 22) {
      doc.addPage();

      /* Header simplificado en páginas siguientes */
      doc.setFillColor(...C.accent);
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('REGISTRO DE ASISTENCIA', pageW / 2, 8, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 220);
      doc.text((empresaNombre || '').toUpperCase(), pageW / 2, 14, { align: 'center' });
      y = 24;

      y = drawTableHeader(doc, y, columns, 8);
    }

    drawRowBg(doc, y, idx, rowH);

    /* Item */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(String(idx + 1), Xitem, y);

    /* Nombre */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    doc.text(String(row.nombre || '—').slice(0, 44), Xnom, y);

    /* Habitación */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text(String(row.hab || '—'), Xhab, y);

    /* Hora Salida y Hora Llegada — vacíos, se rellenan manualmente en papel */
    /* Recuadros de firma — vacíos para firma manuscrita */
    doc.setDrawColor(...C.line);
    doc.rect(XF1, y - 5.5, 35, 8);
    doc.rect(XF2, y - 5.5, 36, 8);

    /* Separador de fila */
    doc.setDrawColor(...C.line);
    doc.line(14, y + 3, pageW - 14, y + 3);
    y += rowH;
  });

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('No hay huéspedes registrados para los filtros seleccionados.', 14, y + 6);
  }

  /* ─── Pie de página con n° de página ─── */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(
      `${BRAND_NAME} — ${(empresaNombre || '').toUpperCase()} — Impresión: ${fechaImpresion} — Página ${i} de ${pageCount}`,
      pageW / 2, pageH - 6, { align: 'center' }
    );
  }

  const safeName2 = (empresaNombre || 'asistencia').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`registro-asistencia-${safeName2}-${normalizeDateForFilename()}.pdf`);
}

/* ═══════════════════════════════════════════════════════════
   REPORTE MENSUAL POR HABITACIÓN  (portrait A4)
   ═══════════════════════════════════════════════════════════ */
export function generarReporteMensualHabitacion(habitacion, alquileres, mes, anio) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  const mesNombre = MESES[Number(mes) - 1] || String(mes);
  const titulo = `Alquileres Finalizados — Hab. ${habitacion?.numero || '?'}`;
  const subtitulo = `${mesNombre} ${anio} · ${habitacion?.tipoHabitacion?.nombre || ''} · Piso ${habitacion?.piso ?? '?'}`;
  let y = writeHeader(doc, titulo, subtitulo);

  /* ─── Resumen en pills (mismo formato que reporte general) ─── */
  const rows = alquileres || [];
  const totalEstadias     = rows.length;
  const totalEmpresas     = rows.filter(a => tieneEmpresa(a.empresaNombre)).length;
  const totalParticulares = totalEstadias - totalEmpresas;

  y = drawSummaryPills(doc, y, [
    { label: `${totalEstadias} Finalizado${totalEstadias !== 1 ? 's' : ''}`,            color: C.mid,  bg: [245, 244, 243] },
    { label: `${totalEmpresas} Empresa${totalEmpresas !== 1 ? 's' : ''}`,               color: C.blue, bg: [239, 246, 255] },
    { label: `${totalParticulares} Particular${totalParticulares !== 1 ? 'es' : ''}`,   color: C.green, bg: [240, 253, 244] },
  ]);

  /* Columnas: 10+72+38+38+24 = 182 = 210-28 */
  const columns = [
    { label: 'Nro',              width: 10 },
    { label: 'Cliente / Empresa', width: 72 },
    { label: 'Ingreso',          width: 38 },
    { label: 'Salida',           width: 38 },
    { label: 'Firma',            width: 24 },
  ];

  y = drawTableHeader(doc, y, columns, 7.8);

  const Xnro   = 16;
  const Xcli   = 26;
  const Xing   = 100;
  const Xsal   = 138;
  const Xfirma = 176;

  doc.setFontSize(8.5);
  rows.forEach((a, idx) => {
    const hasEmpresa = tieneEmpresa(a.empresaNombre);
    const rowH = hasEmpresa ? 10 : 8;

    if (y > 262) {
      doc.addPage();
      y = 20;
      y = drawTableHeader(doc, y, columns, 7.8);
      doc.setFontSize(8.5);
    }

    drawRowBg(doc, y, idx, rowH);

    /* Nro */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(String(idx + 1), Xnro, y);

    /* Cliente + empresa en azul (sin columna Cond. separada) */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.dark);
    doc.text(String(a.nombreCliente || '—').slice(0, 38), Xcli, y);
    if (hasEmpresa) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(...C.blue);
      doc.text(String(a.empresaNombre).slice(0, 38), Xcli, y + 4);
    }

    /* Ingreso / Salida */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.dark);
    doc.text(formatDateTime(a.fechaIngreso),                        Xing, y);
    doc.text(a.fechaSalida ? formatDateTime(a.fechaSalida) : '—',   Xsal, y);

    /* Recuadro de firma */
    doc.setDrawColor(...C.line);
    doc.rect(Xfirma, y - 4.5, 20, 7);

    /* Separador */
    doc.setDrawColor(...C.line);
    const lineY = hasEmpresa ? y + 5.5 : y + 2.5;
    doc.line(14, lineY, pageW - 14, lineY);
    y += rowH;
  });

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('No hay alquileres finalizados registrados para este período.', 14, y + 6);
    y += 14;
  }

  y += 6;
  if (y > 270) { doc.addPage(); y = 24; }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text('Firma de conformidad por cada salida registrada.', 14, y);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`${BRAND_NAME} — Página ${i} de ${pageCount}`, pageW / 2, 290, { align: 'center' });
  }

  const habNum = String(habitacion?.numero || 'X');
  doc.save(`reporte-finalizados-hab${habNum}-${anio}-${String(mes).padStart(2, '0')}.pdf`);
}
