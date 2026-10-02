/**
 * Date helpers for the purchase-date picker. Dates are built from LOCAL date
 * parts, never `toISOString()`, which converts to UTC and can shift the day
 * (e.g. 22:00 in UTC-3 is already tomorrow in UTC). DB-free so it runs under Jest.
 */

/** Local calendar day of `fecha` as `AAAA-MM-DD`. */
export function aFechaISOLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** `AAAA-MM-DD` as a local Date at noon (safe against DST shifts); today when the text is not a date. */
export function deFechaISOLocal(iso: string): Date {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!coincidencia) {
    return new Date();
  }
  return new Date(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]), 12);
}
