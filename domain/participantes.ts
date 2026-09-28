import { Centavos, dividirEnPartes } from './dinero';

/**
 * Splits a cuota's amount evenly among the payer and all participants.
 *
 * The caller MUST order the split so the payer (the user) occupies the
 * LAST position — matching the `orden` column in `gasto_participantes`.
 * Leftover cents from the split always go to the last position, so the
 * payer absorbs them, never a participant.
 */
export function repartirEntreParticipantes(montoCuota: Centavos, n: number): Centavos[] {
  return dividirEnPartes(montoCuota, n);
}
