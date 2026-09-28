import { Centavos, dividirEnPartes } from './dinero';
import { calcularVencimientosMensuales, parsearFechaISO, FechaISO } from './vencimientos';

export interface InputDeuda {
  acreedor: string;
  descripcion: string;
  montoTotalCents: Centavos;
  cuotas: number;
  fechaPrimerPago: FechaISO;
}

export type ErrorDeuda = 'MONTO_INVALIDO' | 'CUOTAS_INVALIDA' | 'ACREEDOR_REQUERIDO' | 'FECHA_INVALIDA';

function esFechaISOValida(fecha: FechaISO): boolean {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }
  const { mes, dia } = parsearFechaISO(fecha);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
}

/**
 * Validates a Deuda before planning it — symmetric with `validarGasto`.
 * This is an exhaustive gate: `planificarDeuda` only calls into
 * `dividirEnPartes`/`calcularVencimientosMensuales` after this reports
 * zero errors, so invalid amounts, cuotas or dates never reach those
 * lower-level functions as a raw, unhelpful error.
 */
export function validarDeuda(input: InputDeuda): ErrorDeuda[] {
  const errores: ErrorDeuda[] = [];

  if (!Number.isInteger(input.montoTotalCents) || input.montoTotalCents <= 0) {
    errores.push('MONTO_INVALIDO');
  }

  if (!Number.isInteger(input.cuotas) || input.cuotas < 1) {
    errores.push('CUOTAS_INVALIDA');
  }

  if (!input.acreedor || input.acreedor.trim().length === 0) {
    errores.push('ACREEDOR_REQUERIDO');
  }

  if (!esFechaISOValida(input.fechaPrimerPago)) {
    errores.push('FECHA_INVALIDA');
  }

  return errores;
}

export interface CuotaDeudaPlan {
  numero: number;
  montoCents: Centavos;
  fechaVencimiento: FechaISO;
}

export interface PlanDeuda {
  cuotas: CuotaDeudaPlan[];
}

/**
 * Plans a Deuda's equal monthly cuota schedule, one per month starting
 * at `fechaPrimerPago`. No card and no discount apply — the
 * rounding-remainder rule from `dividirEnPartes` still does. Throws
 * when `validarDeuda` reports any error.
 */
export function planificarDeuda(input: InputDeuda): PlanDeuda {
  const errores = validarDeuda(input);
  if (errores.length > 0) {
    throw new Error(`Deuda invalida: ${errores.join(', ')}`);
  }

  const montos = dividirEnPartes(input.montoTotalCents, input.cuotas);
  const vencimientos = calcularVencimientosMensuales(input.fechaPrimerPago, input.cuotas);

  return {
    cuotas: montos.map((montoCents, i) => ({
      numero: i + 1,
      montoCents,
      fechaVencimiento: vencimientos[i],
    })),
  };
}
