/**
 * Ordering of the month lists (DB-free, so it runs under Jest). SQLite's NOCASE only folds ASCII
 * ("Ángel" would sort after "Zeta"), so the name tie-break is done here with the Spanish locale.
 */
export function compararNombres(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

/** Due date first, then the name (case and accent insensitive), then the cuota number. */
export function ordenarPorVencimientoYNombre<T extends { fechaVencimiento: string; numero: number }>(
  items: T[],
  nombre: (item: T) => string,
): T[] {
  return [...items].sort(
    (a, b) =>
      a.fechaVencimiento.localeCompare(b.fechaVencimiento) || compararNombres(nombre(a), nombre(b)) || a.numero - b.numero,
  );
}
