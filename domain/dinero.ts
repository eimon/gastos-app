import { MAX_CUOTAS } from './limites';

/**
 * Money is represented as integer cents everywhere in the domain layer.
 * Never use floats or decimal strings here — integer cents keep every
 * split and sum exact.
 */
export type Centavos = number;

/**
 * Splits a total (in cents) evenly across `n` parts.
 *
 * Uses floor division; any leftover cents from the integer division are
 * added entirely to the LAST part. This is the single rounding-remainder
 * rule shared by cuota schedules, discount distribution and participant
 * splits — see the `installment-calculation` spec.
 */
export function dividirEnPartes(total: Centavos, n: number): Centavos[] {
  if (!Number.isInteger(total)) {
    throw new Error('El monto total debe ser un entero (centavos).');
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('La cantidad de partes debe ser un entero positivo.');
  }

  // Defensive cap: callers validate first, this only stops a runaway allocation.
  if (n > MAX_CUOTAS) {
    throw new Error(`La cantidad de partes no puede superar ${MAX_CUOTAS}.`);
  }

  const base = Math.floor(total / n);
  const partes = new Array<Centavos>(n).fill(base);
  const resto = total - base * n;
  partes[n - 1] += resto;
  return partes;
}
