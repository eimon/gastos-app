/**
 * Minimal pub/sub emitter services call after every write. `useServicio`
 * subscribes to refetch its data whenever any service mutates the DB —
 * there is only one event, no per-entity granularity, since the app is
 * single-user/local and payloads are cheap to reload.
 */
type Escucha = () => void;

const escuchas = new Set<Escucha>();

export function emitirCambio(): void {
  for (const escucha of escuchas) {
    escucha();
  }
}

/** Returns an unsubscribe function. */
export function suscribirseACambios(escucha: Escucha): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}
