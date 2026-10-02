/**
 * Form-level rules for registering a pago (no `data/db/client` import, so
 * they run under Jest). The amount math stays in `domain/pagos.ts`; this
 * module only converts the typed amount and maps error codes to messages.
 */
import { validarPago } from '../domain/pagos';
import type { CodigoErrorPago } from './pagosService';
import { aCentavos } from './gastoFormulario';
import { formatearMonto } from './gastoVista';
import { esErrorDeReglas, restanteDeError } from './errorDominio';

export const MENSAJES_ERROR_PAGO: Record<Exclude<CodigoErrorPago, 'EXCEDE_RESTANTE'>, string> = {
  GASTO_ELIMINADO: 'El gasto fue eliminado y ya no admite pagos.',
  DEUDA_ELIMINADA: 'La deuda fue eliminada y ya no admite pagos.',
  MONTO_INVALIDO: 'El monto debe ser mayor a cero.',
  YA_PAGADO: 'Esta parte ya está pagada.',
  MEDIO_PAGO_INVALIDO: 'El medio de pago debe ser efectivo o transferencia.',
  ES_USUARIO: 'La parte propia es informativa y no se paga.',
  OBJETIVO_NO_ENCONTRADO: 'No se encontró la parte a pagar.',
};

export type SujetoPago = 'parte' | 'cuota';

const MENSAJES_ERROR_PAGO_CUOTA: Partial<Record<CodigoErrorPago, string>> = {
  YA_PAGADO: 'Esta cuota ya está pagada.',
  OBJETIVO_NO_ENCONTRADO: 'No se encontró la cuota a pagar.',
};

export function mensajeCodigoPago(codigo: CodigoErrorPago, restanteCents: number, sujeto: SujetoPago = 'parte'): string {
  if (codigo === 'EXCEDE_RESTANTE') {
    return `El monto no puede superar lo que falta pagar (${formatearMonto(restanteCents)}).`;
  }
  return (sujeto === 'cuota' && MENSAJES_ERROR_PAGO_CUOTA[codigo]) || MENSAJES_ERROR_PAGO[codigo];
}

/** Message for the first error of a typed partial amount, or null when it is acceptable. */
export function errorMontoPago(monto: number | null, restanteCents: number, sujeto: SujetoPago = 'parte'): string | null {
  const [codigo] = validarPago(aCentavos(monto), restanteCents);
  return codigo ? mensajeCodigoPago(codigo, restanteCents, sujeto) : null;
}

/**
 * Message for a payment the service rejected, or null when `err` is not a
 * rules error. The amount shown comes from the service (fresh, read inside
 * the transaction) and only falls back to the dialog's own value.
 */
export function mensajePagoRechazado(
  err: unknown,
  restanteDelDialogoCents: number,
  sujeto: SujetoPago = 'parte',
): string | null {
  if (!esErrorDeReglas<CodigoErrorPago>(err)) {
    return null;
  }
  const restante = restanteDeError(err) ?? restanteDelDialogoCents;
  return err.codigos.map((codigo) => mensajeCodigoPago(codigo, restante, sujeto)).join(' ');
}
