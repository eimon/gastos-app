/**
 * Upper bound for cuotas (installments) of a gasto or deuda: 360 covers a
 * 30-year monthly loan. Every cuota count is validated against it BEFORE any
 * schedule is computed, so a typo like "10000000000" never reaches a loop or
 * an array allocation.
 */
export const MAX_CUOTAS = 360;

export function esCantidadCuotasValida(cuotas: number): boolean {
  return Number.isInteger(cuotas) && cuotas >= 1 && cuotas <= MAX_CUOTAS;
}
