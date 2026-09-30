/**
 * Calendar dates are plain `YYYY-MM-DD` strings. All arithmetic here is
 * done on integer year/month/day components — no `Date` object is ever
 * constructed, which avoids timezone-related drift.
 */
export type FechaISO = string;

interface FechaCalendario {
  anio: number;
  mes: number; // 1-12
  dia: number;
}

export function parsearFechaISO(fecha: FechaISO): FechaCalendario {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return { anio, mes, dia };
}

function formatearFechaISO({ anio, mes, dia }: FechaCalendario): FechaISO {
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${anio}-${mm}-${dd}`;
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function diasEnMes(anio: number, mes: number): number {
  if (mes === 2 && esBisiesto(anio)) {
    return 29;
  }
  return DIAS_POR_MES[mes - 1];
}

/** Clamps `dia` to the last valid day of the given year/month (leap-year aware). */
export function clampearDia(anio: number, mes: number, dia: number): number {
  return Math.min(dia, diasEnMes(anio, mes));
}

function sumarMeses(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const indiceMesCero = mes - 1 + delta;
  const anioResultado = anio + Math.floor(indiceMesCero / 12);
  const mesResultado = ((indiceMesCero % 12) + 12) % 12 + 1;
  return { anio: anioResultado, mes: mesResultado };
}

export interface ConfiguracionTarjeta {
  diaCierre: number;
  diaVencimiento: number;
}

export interface Vencimiento {
  cierre: FechaISO;
  vencimiento: FechaISO;
}

/**
 * Computes the closing (`cierre`) and due (`vencimiento`) date for each
 * cuota of a card purchase.
 *
 * - Statement assignment: a purchase belongs to the statement whose
 *   closing day falls ON or AFTER the purchase date in the same cycle;
 *   only purchases strictly after the closing day roll to next month.
 * - Due date: placed the month AFTER closing when `diaVencimiento <=
 *   diaCierre`, and the SAME month as closing otherwise.
 * - Both days clamp to the shorter month when needed, recomputed every
 *   cycle (leap years included).
 */
export function calcularVencimientosTarjeta(
  fechaCompra: FechaISO,
  { diaCierre, diaVencimiento }: ConfiguracionTarjeta,
  cuotas: number,
): Vencimiento[] {
  const compra = parsearFechaISO(fechaCompra);
  const cierreClampeadoEnMesDeCompra = clampearDia(compra.anio, compra.mes, diaCierre);

  const primerCierre =
    compra.dia <= cierreClampeadoEnMesDeCompra
      ? { anio: compra.anio, mes: compra.mes }
      : sumarMeses(compra.anio, compra.mes, 1);

  const vencimientos: Vencimiento[] = [];

  for (let i = 0; i < cuotas; i++) {
    const cierreMes = sumarMeses(primerCierre.anio, primerCierre.mes, i);
    const diaCierreClamp = clampearDia(cierreMes.anio, cierreMes.mes, diaCierre);
    const cierre: FechaCalendario = { ...cierreMes, dia: diaCierreClamp };

    const mesVencimiento =
      diaVencimiento <= diaCierre ? sumarMeses(cierreMes.anio, cierreMes.mes, 1) : cierreMes;
    const diaVencimientoClamp = clampearDia(mesVencimiento.anio, mesVencimiento.mes, diaVencimiento);
    const vencimiento: FechaCalendario = { ...mesVencimiento, dia: diaVencimientoClamp };

    vencimientos.push({
      cierre: formatearFechaISO(cierre),
      vencimiento: formatearFechaISO(vencimiento),
    });
  }

  return vencimientos;
}

/**
 * Computes `cuotas` monthly due dates starting at `primerPago`, one per
 * month, clamping the day when a shorter month is reached. Used by
 * Deudas, which have no card and no closing cycle.
 */
export function calcularVencimientosMensuales(primerPago: FechaISO, cuotas: number): FechaISO[] {
  const { anio, mes, dia } = parsearFechaISO(primerPago);
  const fechas: FechaISO[] = [];

  for (let i = 0; i < cuotas; i++) {
    const { anio: a, mes: m } = sumarMeses(anio, mes, i);
    const diaClamp = clampearDia(a, m, dia);
    fechas.push(formatearFechaISO({ anio: a, mes: m, dia: diaClamp }));
  }

  return fechas;
}

/** True for a real calendar date written as `AAAA-MM-DD` (rejects 2026-02-30). */
export function esFechaISOValida(fecha: string): boolean {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!coincidencia) {
    return false;
  }
  const [anio, mes, dia] = [Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3])];
  const real = new Date(Date.UTC(anio, mes - 1, dia));
  return real.getUTCFullYear() === anio && real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia;
}
