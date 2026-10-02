import { Centavos } from './dinero';

export type EstadoPago = 'pendiente' | 'parcial' | 'pagado';

export interface ResumenPago {
  pagado: Centavos;
  restante: Centavos;
  estado: EstadoPago;
}

/**
 * Derives payment status from the target amount and every payment
 * recorded against it (supports multiple partial payments). The status
 * is ALWAYS derived from the sum of `pagos` — never a stored flag.
 */
export function estadoDePago(monto: Centavos, pagos: Centavos[]): ResumenPago {
  const pagado = pagos.reduce((acc, pago) => acc + pago, 0);
  const restante = monto - pagado;
  // Check `restante <= 0` FIRST: a monto of 0 (e.g. a prorrateo cuota fully
  // consumed by a discount) has no payments yet (`pagado === 0`) but is
  // already settled — it must resolve to 'pagado', never 'pendiente'.
  const estado: EstadoPago = restante <= 0 ? 'pagado' : pagado === 0 ? 'pendiente' : 'parcial';
  return { pagado, restante, estado };
}

export type ErrorPago = 'MONTO_INVALIDO' | 'EXCEDE_RESTANTE' | 'YA_PAGADO';

/**
 * Validates a single payment attempt against the remaining amount.
 *
 * Overpayment is always rejected: a payment exactly equal to the
 * restante is accepted and settles it; a payment greater than the
 * restante is rejected (`EXCEDE_RESTANTE`). A restante of 0 means the
 * target is already fully paid (`YA_PAGADO`) — no further payment is
 * accepted, not even an equal-to-zero one. Advance payments against a
 * NEXT cuota/share are a separate transaction against that other
 * target's own restante, not an overflow of this one.
 */
export function validarPago(montoPago: Centavos, restante: Centavos): ErrorPago[] {
  const errores: ErrorPago[] = [];

  if (!Number.isInteger(montoPago) || montoPago <= 0) {
    errores.push('MONTO_INVALIDO');
    return errores;
  }

  if (restante <= 0) {
    errores.push('YA_PAGADO');
    return errores;
  }

  if (montoPago > restante) {
    errores.push('EXCEDE_RESTANTE');
  }

  return errores;
}
