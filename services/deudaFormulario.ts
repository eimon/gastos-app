/**
 * Form-level rules for the deuda screens (no `data/db/client` import, so they
 * run under Jest). All money and date math is delegated to `domain/deuda.ts`;
 * this module only adapts raw form values to the domain input and maps error
 * codes to user-facing messages.
 */
import { planificarDeuda, validarDeuda, type ErrorDeuda, type InputDeuda, type PlanDeuda } from '../domain/deuda';
import { MAX_CUOTAS, MAX_MONTO_CENTS } from '../domain/limites';
import type { Deuda } from '../data/repositories/deudasRepo';
import { aCentavos, fechaHoyISO } from './gastoFormulario';
import { formatearMonto } from './gastoVista';

export interface ValoresDeudaForm {
  acreedor: string;
  descripcion: string;
  /** Amount as typed by the money input (whole currency units, may have decimals). */
  monto: number | null;
  /** Raw text so an empty or invalid entry can be rejected instead of coerced. */
  cuotas: string;
  /** `AAAA-MM-DD`. */
  fechaPrimerPago: string;
}

export const MENSAJES_ERROR_DEUDA: Record<ErrorDeuda, string> = {
  ACREEDOR_REQUERIDO: 'El acreedor es obligatorio.',
  DESCRIPCION_REQUERIDA: 'La descripción es obligatoria.',
  MONTO_INVALIDO: 'El monto debe ser mayor a cero.',
  MONTO_EXCESIVO: `El monto no puede superar ${formatearMonto(MAX_MONTO_CENTS)}.`,
  CUOTAS_INVALIDA: `La cantidad de cuotas debe ser un número entero entre 1 y ${MAX_CUOTAS}.`,
  FECHA_INVALIDA: 'La fecha del primer pago no es válida.',
};

export const valoresInicialesDeuda = (): ValoresDeudaForm => ({
  acreedor: '',
  descripcion: '',
  monto: null,
  cuotas: '1',
  fechaPrimerPago: fechaHoyISO(),
});

/** Form values of a stored deuda, for the edit screen. */
export const valoresDesdeDeuda = (deuda: Deuda): ValoresDeudaForm => ({
  acreedor: deuda.acreedor,
  descripcion: deuda.descripcion,
  monto: deuda.montoTotalCents / 100,
  cuotas: String(deuda.cantidadCuotas),
  fechaPrimerPago: deuda.fechaPrimerPago,
});

export function construirInputDeuda(valores: ValoresDeudaForm): InputDeuda {
  return {
    acreedor: valores.acreedor.trim(),
    descripcion: valores.descripcion.trim(),
    montoTotalCents: aCentavos(valores.monto),
    cuotas: valores.cuotas.trim() === '' ? Number.NaN : Number(valores.cuotas),
    fechaPrimerPago: valores.fechaPrimerPago,
  };
}

export interface EvaluacionDeuda {
  errores: ErrorDeuda[];
  /** Cuota preview; null while any rule blocks planning. */
  plan: PlanDeuda | null;
}

/** Validates the form and, when valid, previews the cuota schedule via `planificarDeuda`. */
export function evaluarFormularioDeuda(valores: ValoresDeudaForm): EvaluacionDeuda {
  const input = construirInputDeuda(valores);
  const errores = validarDeuda(input);
  return { errores, plan: errores.length === 0 ? planificarDeuda(input) : null };
}

/** Before the first save attempt only the date and cuotas errors show live; afterwards every error does. */
export function erroresVisiblesDeuda(errores: ErrorDeuda[], intentoGuardar: boolean): ErrorDeuda[] {
  return intentoGuardar ? errores : errores.filter((e) => e === 'FECHA_INVALIDA' || e === 'CUOTAS_INVALIDA');
}
