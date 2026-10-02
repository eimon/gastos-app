/**
 * Staleness rules of `hooks/useServicio` (DB-free, so they run under Jest). Loaded data and
 * errors are tagged with a key derived from the hook's `deps` (for example the selected month).
 * Data tagged with another key belongs to ANOTHER month or id and must not be shown as current.
 */

/** Stable key for a deps list. Deps are primitives (month, year, id), so JSON is exact. */
export function claveDeDeps(deps: unknown[]): string {
  return JSON.stringify(deps);
}

/** True when what was loaded (or failed) belongs to the deps being displayed right now. */
export function esVigente(claveGuardada: string | undefined, claveActual: string): boolean {
  return claveGuardada === claveActual;
}

/**
 * Loading is true while a request is in flight, and also while there is neither current data
 * nor a current error (the first render after the deps changed, before the reload starts), so
 * a screen never flashes its error or empty state in between.
 */
export function estaCargando(enCurso: boolean, hayDatosVigentes: boolean, hayErrorVigente: boolean): boolean {
  return enCurso || (!hayDatosVigentes && !hayErrorVigente);
}
