/**
 * Pure mapping helpers between `domain/gasto.ts`'s plan output and the
 * repository's insert shape. Kept in their own module (no `data/db/client`
 * import) so they're testable under Jest without touching expo-sqlite —
 * `gastosService.ts` imports the repo types here with `import type` only,
 * which TypeScript erases at compile time.
 */
import type { planificarGasto, TipoGasto } from '../domain/gasto';
import { repartirEntreParticipantes } from '../domain/participantes';
import type { InputCuota, InputParticipante } from '../data/repositories/gastosRepo';

export const NOMBRE_USUARIO_POR_DEFECTO = 'Yo';

export interface DatosParticipantes {
  tipo: TipoGasto;
  /** Other participants' names, excluding the user. Ignored for `tipo: 'personal'`. */
  participantes: string[];
  /** Display name for the user's own share row. Defaults to "Yo". */
  nombreUsuario?: string;
}

/**
 * Builds the ordered participantes list to persist — the user (payer) is
 * always LAST, matching `gasto_participantes.orden` and the ordering
 * `repartirEntreParticipantes` relies on to give the payer any leftover cents.
 */
export function construirParticipantes(input: DatosParticipantes): InputParticipante[] {
  const nombreUsuario = input.nombreUsuario ?? NOMBRE_USUARIO_POR_DEFECTO;

  if (input.tipo === 'personal') {
    return [{ nombre: nombreUsuario, esUsuario: true }];
  }

  return [
    ...input.participantes.map((nombre) => ({ nombre, esUsuario: false })),
    { nombre: nombreUsuario, esUsuario: true },
  ];
}

/** Splits every planned cuota amount evenly across `cantidadParticipantes` shares. */
export function construirCuotasRepo(
  plan: ReturnType<typeof planificarGasto>,
  cantidadParticipantes: number,
): InputCuota[] {
  return plan.cuotas.map((cuota) => ({
    numero: cuota.numero,
    montoCents: cuota.montoCents,
    fechaCierre: cuota.fechaCierre,
    fechaVencimiento: cuota.fechaVencimiento,
    partes: repartirEntreParticipantes(cuota.montoCents, cantidadParticipantes),
  }));
}
