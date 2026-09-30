/**
 * Form-level rules for registering a pago (no `data/db/client` import, so
 * they run under Jest). The amount math stays in `domain/pagos.ts`; this
 * module only converts the typed amount and maps error codes to messages.
 */
import { validarPago } from '../domain/pagos';
import type { CodigoErrorPago } from './pagosService';
import { aCentavos } from './gastoFormulario';
import { formatearMonto } from './gastoVista';

export const MENSAJES_ERROR_PAGO: Record<Exclude<CodigoErrorPago, 'EXCEDE_RESTANTE'>, string> = {
  MONTO_INVALIDO: 'El monto debe ser mayor a cero.',
  YA_PAGADO: 'Esta parte ya está pagada.',
  ES_USUARIO: 'La parte propia es informativa y no se paga.',
  OBJETIVO_NO_ENCONTRADO: 'No se encontró la parte a pagar.',
};

export function mensajeCodigoPago(codigo: CodigoErrorPago, restanteCents: number): string {
  return codigo === 'EXCEDE_RESTANTE'
    ? `El monto no puede superar lo que falta pagar (${formatearMonto(restanteCents)}).`
    : MENSAJES_ERROR_PAGO[codigo];
}

/** Message for the first error of a typed partial amount, or null when it is acceptable. */
export function errorMontoPago(monto: number | null, restanteCents: number): string | null {
  const [codigo] = validarPago(aCentavos(monto), restanteCents);
  return codigo ? mensajeCodigoPago(codigo, restanteCents) : null;
}
