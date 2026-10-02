/**
 * Pure rules for creating, editing and deleting a deuda (no `data/db/client`
 * import, so they run under Jest). The service runs the pago check and the
 * write in one transaction; this module only decides WHAT is allowed and WHAT
 * to write, delegating all money and date math to `domain/deuda.ts`.
 */
import { planificarDeuda, validarDeuda, type ErrorDeuda, type InputDeuda } from '../domain/deuda';
import type { DeudaConCuotas } from '../data/repositories/deudasRepo';
import { MENSAJES_ERROR_DEUDA } from './deudaFormulario';

export type CodigoErrorDeuda = ErrorDeuda | 'BLOQUEADO_POR_PAGO' | 'ELIMINAR_CON_PAGOS' | 'DEUDA_NO_ENCONTRADA';

export const MENSAJES_ERROR_DEUDA_GUARDADA: Record<CodigoErrorDeuda, string> = {
  ...MENSAJES_ERROR_DEUDA,
  BLOQUEADO_POR_PAGO: 'Con pagos registrados solo se pueden editar el acreedor y la descripción. Primero hay que anular los pagos.',
  ELIMINAR_CON_PAGOS: 'No se puede eliminar una deuda con pagos registrados. Primero hay que anular los pagos.',
  DEUDA_NO_ENCONTRADA: 'No se encontró la deuda.',
};

export class DeudaRechazadaError extends Error {
  /** Same shape as the other rules errors, so screens recognize it through `esErrorDeReglas`. */
  constructor(public readonly codigos: CodigoErrorDeuda[]) {
    super(codigos.map((codigo) => MENSAJES_ERROR_DEUDA_GUARDADA[codigo]).join(' '));
  }
}

/** Domain gate for a full deuda (create, or an edit that changes the core). */
export function exigirDeudaValida(input: InputDeuda): void {
  const errores = validarDeuda(input);
  if (errores.length > 0) {
    throw new DeudaRechazadaError(errores);
  }
}

/**
 * Every write needs a non-blank acreedor and descripcion, whichever branch ends up
 * writing them. Returns both trimmed.
 */
export function exigirTextos(textos: { acreedor: string; descripcion: string }): { acreedor: string; descripcion: string } {
  const acreedor = textos.acreedor.trim();
  const descripcion = textos.descripcion.trim();
  const errores: CodigoErrorDeuda[] = [];
  if (acreedor === '') errores.push('ACREEDOR_REQUERIDO');
  if (descripcion === '') errores.push('DESCRIPCION_REQUERIDA');
  if (errores.length > 0) {
    throw new DeudaRechazadaError(errores);
  }
  return { acreedor, descripcion };
}

/** Gate shared by the core-field edit and the delete: any live pago blocks both. */
export function exigirSinPagos(tienePagos: boolean, codigo: 'BLOQUEADO_POR_PAGO' | 'ELIMINAR_CON_PAGOS'): void {
  if (tienePagos) {
    throw new DeudaRechazadaError([codigo]);
  }
}

/** Core fields of an edit: everything except the texts, which are edited on their own. */
export type NucleoDeuda = Pick<InputDeuda, 'montoTotalCents' | 'cuotas' | 'fechaPrimerPago'>;

/** True when amount, cuotas and first payment date match what is stored. */
export function nucleoDeudaSinCambios({ deuda }: DeudaConCuotas, nucleo: NucleoDeuda): boolean {
  return (
    deuda.montoTotalCents === nucleo.montoTotalCents &&
    deuda.cantidadCuotas === nucleo.cuotas &&
    deuda.fechaPrimerPago === nucleo.fechaPrimerPago
  );
}

export interface EdicionDeuda {
  acreedor: string;
  descripcion: string;
  montoTotalCents: number;
  cantidadCuotas: number;
  fechaPrimerPago: string;
  cuotas: { numero: number; montoCents: number; fechaVencimiento: string }[];
}

/**
 * What to store for an edit without pagos. Stored due dates only move when the
 * first payment date or the cuota count changes; a new amount alone keeps them.
 */
export function construirEdicionDeuda(actual: DeudaConCuotas, input: InputDeuda): EdicionDeuda {
  const plan = planificarDeuda(input);
  const mismasFechas =
    actual.deuda.fechaPrimerPago === input.fechaPrimerPago && actual.deuda.cantidadCuotas === input.cuotas;
  const guardadas = new Map(actual.cuotas.map((cuota) => [cuota.numero, cuota.fechaVencimiento]));

  return {
    acreedor: input.acreedor,
    descripcion: input.descripcion,
    montoTotalCents: input.montoTotalCents,
    cantidadCuotas: input.cuotas,
    fechaPrimerPago: input.fechaPrimerPago,
    cuotas: plan.cuotas.map((cuota) => ({
      numero: cuota.numero,
      montoCents: cuota.montoCents,
      fechaVencimiento: (mismasFechas && guardadas.get(cuota.numero)) || cuota.fechaVencimiento,
    })),
  };
}
