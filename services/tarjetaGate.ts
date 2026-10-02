/**
 * Validates a tarjeta input and throws a user-facing (neutral Spanish)
 * error when invalid. Kept in its own module (no `data/db/client` import),
 * following the `gastoPlanMapper.ts` convention, so `tarjetasService.crear`/
 * `actualizar`'s validation gate is testable under Jest without touching
 * expo-sqlite — importing `tarjetasService.ts` itself opens a SQLite
 * connection as a side effect of importing `data/db/client`.
 */
import { validarTarjeta, InputTarjeta, ErrorTarjeta } from '../domain/tarjeta';

const MENSAJES_ERROR_TARJETA: Record<ErrorTarjeta, string> = {
  NOMBRE_REQUERIDO: 'El nombre de la tarjeta es obligatorio.',
  DIA_CIERRE_INVALIDO: 'El día de cierre debe ser un número entre 1 y 31.',
  DIA_VENCIMIENTO_INVALIDO: 'El día de vencimiento debe ser un número entre 1 y 31.',
};

/**
 * Throws with a neutral-Spanish, user-facing message (one sentence per
 * error, joined with a space) when `input` fails `validarTarjeta` — the
 * message may reach `showAlert` directly from a screen's catch block, so
 * it must never leak an internal error code like `NOMBRE_REQUERIDO`.
 */
export function validarOLanzar(input: InputTarjeta): void {
  const errores = validarTarjeta(input);
  if (errores.length > 0) {
    throw new Error(errores.map((error) => MENSAJES_ERROR_TARJETA[error]).join(' '));
  }
}
