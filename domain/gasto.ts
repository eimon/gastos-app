import { Centavos } from './dinero';
import { calcularMontosCuotas, TipoDescuento } from './cuotas';
import { calcularVencimientosTarjeta, FechaISO } from './vencimientos';

export type TipoGasto = 'personal' | 'compartido';

export interface TarjetaGasto {
  id: string;
  diaCierre: number;
  diaVencimiento: number;
}

export interface InputGasto {
  tipo: TipoGasto;
  fechaCompra: FechaISO;
  montoTotalCents: Centavos;
  descuentoCents: Centavos;
  tipoDescuento: TipoDescuento | null;
  cuotas: number;
  tarjeta: TarjetaGasto | null;
  participantes: string[];
}

export type ErrorGasto =
  | 'MONTO_INVALIDO'
  | 'DESCUENTO_INVALIDO'
  | 'CUOTAS_INVALIDA'
  | 'TARJETA_REQUERIDA'
  | 'TIPO_DESCUENTO_REQUERIDO'
  | 'SIN_PARTICIPANTES';

/**
 * Validates a gasto before planning it. Used both for inline form
 * errors and as the gate `planificarGasto` checks before computing
 * anything. This MUST be an exhaustive gate: `planificarGasto` only
 * calls into `calcularMontosCuotas`/`calcularVencimientosTarjeta` after
 * this reports zero errors, so any input shape those functions assume
 * (integer positive amounts, integer cuotas >= 1) has to be rejected
 * here first — never left to leak a raw error from the lower layers.
 */
export function validarGasto(input: InputGasto): ErrorGasto[] {
  const errores: ErrorGasto[] = [];

  if (!Number.isInteger(input.montoTotalCents) || input.montoTotalCents <= 0) {
    errores.push('MONTO_INVALIDO');
  }

  // A discount >= the total would leave a net amount of 0 (or negative),
  // which is never a valid gasto — independent of a prorrateo cuota
  // individually resolving to 0, which stays valid.
  if (
    !Number.isInteger(input.descuentoCents) ||
    input.descuentoCents < 0 ||
    input.descuentoCents >= input.montoTotalCents
  ) {
    errores.push('DESCUENTO_INVALIDO');
  }

  if (!Number.isInteger(input.cuotas) || input.cuotas < 1) {
    errores.push('CUOTAS_INVALIDA');
  }

  if (input.cuotas > 1 && !input.tarjeta) {
    errores.push('TARJETA_REQUERIDA');
  }

  if (input.descuentoCents > 0 && !input.tipoDescuento) {
    errores.push('TIPO_DESCUENTO_REQUERIDO');
  }

  if (input.tipo === 'compartido' && input.participantes.length === 0) {
    errores.push('SIN_PARTICIPANTES');
  }

  return errores;
}

export interface CuotaPlan {
  numero: number;
  montoCents: Centavos;
  fechaCierre: FechaISO | null;
  fechaVencimiento: FechaISO;
}

export interface PlanGasto {
  cuotas: CuotaPlan[];
}

/**
 * Plans a gasto's cuota schedule (amounts + dates). Throws when
 * `validarGasto` reports any error — callers MUST validate on the form
 * first for inline feedback, then call this to build the persisted plan.
 *
 * When no card is assigned (only possible for a single cuota), the due
 * date is the purchase date itself and there is no closing date.
 */
export function planificarGasto(input: InputGasto): PlanGasto {
  const errores = validarGasto(input);
  if (errores.length > 0) {
    throw new Error(`Gasto invalido: ${errores.join(', ')}`);
  }

  const montos = calcularMontosCuotas({
    totalCents: input.montoTotalCents,
    descuentoCents: input.descuentoCents,
    cuotas: input.cuotas,
    tipoDescuento: input.tipoDescuento,
  });

  if (!input.tarjeta) {
    return {
      cuotas: montos.map((montoCents, i) => ({
        numero: i + 1,
        montoCents,
        fechaCierre: null,
        fechaVencimiento: input.fechaCompra,
      })),
    };
  }

  const vencimientos = calcularVencimientosTarjeta(
    input.fechaCompra,
    { diaCierre: input.tarjeta.diaCierre, diaVencimiento: input.tarjeta.diaVencimiento },
    input.cuotas,
  );

  return {
    cuotas: montos.map((montoCents, i) => ({
      numero: i + 1,
      montoCents,
      fechaCierre: vencimientos[i].cierre,
      fechaVencimiento: vencimientos[i].vencimiento,
    })),
  };
}
