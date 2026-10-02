/**
 * Helpers to recognize errors thrown by the service rules without relying on
 * `instanceof` (which breaks when a class is duplicated or transpiled
 * differently). A rules error carries a `codigos` array; a payment rejection
 * may also carry the fresh `restanteCents` computed inside the transaction.
 */
export interface ErrorDeReglas<C extends string = string> extends Error {
  codigos: C[];
  restanteCents?: number;
}

export function esErrorDeReglas<C extends string = string>(err: unknown): err is ErrorDeReglas<C> {
  if (!(err instanceof Error)) {
    return false;
  }
  const { codigos } = err as Partial<ErrorDeReglas<C>>;
  return Array.isArray(codigos) && codigos.length > 0 && codigos.every((codigo) => typeof codigo === 'string');
}

/** The remaining amount the service saw when it rejected a payment, if it reported one. */
export function restanteDeError(err: unknown): number | undefined {
  const restante = esErrorDeReglas(err) ? err.restanteCents : undefined;
  return typeof restante === 'number' ? restante : undefined;
}
