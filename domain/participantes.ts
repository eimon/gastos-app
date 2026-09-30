import { Centavos, dividirEnPartes } from './dinero';

export const NOMBRE_USUARIO = 'Yo';

export type ErrorNombreParticipante = 'PARTICIPANTE_VACIO' | 'PARTICIPANTE_DUPLICADO';

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

const normalizar = (nombre: string): string => nombre.trim().toLowerCase();

/**
 * Checks the other participants' names: none may be blank, and none may
 * repeat (trimmed, case-insensitive) or collide with the payer's own row.
 */
export function validarNombresParticipantes(nombres: string[]): ErrorNombreParticipante[] {
  const errores: ErrorNombreParticipante[] = [];
  const vistos = new Set<string>([normalizar(NOMBRE_USUARIO)]);
  for (const nombre of nombres) {
    const clave = normalizar(nombre);
    if (clave === '') {
      errores.push('PARTICIPANTE_VACIO');
    } else if (vistos.has(clave)) {
      errores.push('PARTICIPANTE_DUPLICADO');
    }
    vistos.add(clave);
  }
  return [...new Set(errores)];
}

/**
 * Validates fixed per-person amounts, ordered like the split (other
 * participants first, the payer LAST). Amounts are integer cents; each
 * other participant owes more than zero, the payer's own share may be 0.
 * `cantidadParticipantes` counts the payer.
 */
export function validarMontosPersonalizados(montos: Centavos[], cantidadParticipantes: number): boolean {
  if (montos.length !== cantidadParticipantes || cantidadParticipantes < 2) {
    return false;
  }
  return montos.every((monto, i) => {
    const esUsuario = i === montos.length - 1;
    return Number.isInteger(monto) && (esUsuario ? monto >= 0 : monto > 0);
  });
}

export function sumarMontos(montos: Centavos[]): Centavos {
  return montos.reduce((acc, monto) => acc + monto, 0);
}
