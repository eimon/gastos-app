import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { suscribirseACambios } from '../services/cambios';

export interface ResultadoServicio<T> {
  datos: T | undefined;
  cargando: boolean;
  error: Error | null;
  recargar: () => void;
}

/**
 * Loads via `cargar()` on screen focus and again whenever any service emits
 * a `cambios` event (see `services/cambios.ts`), or whenever `deps` changes.
 * Screens need service-computed aggregates, not raw table rows, so this —
 * not `useLiveQuery` — is the standard data-loading hook for every screen.
 *
 * **Stale-closure contract**: `cargar` is stored in a ref that's updated in
 * an effect after every render (never assigned directly in the render body —
 * mutating a ref during render is a React anti-pattern), and `recargar` is a
 * PERMANENTLY stable callback (`useCallback(fn, [])`) whose body only ever
 * calls `cargarRef.current()` — never the `cargar` argument directly. This
 * means a focus event or a `cambios` event can NEVER run a stale closure
 * (e.g. one that captured an outdated `mesActual`/`añoActual` from a
 * previous render), no matter what `deps` contains.
 *
 * `deps` only decides WHEN to auto-reload on change (via a plain
 * `useEffect`, skipped on the very first render since `useFocusEffect`
 * already covers the initial load) — it never decides which `cargar`
 * closure actually runs; that's always the latest one, via the ref. `deps`
 * is intentionally NEVER passed to a `useCallback`/`useMemo`: this project's
 * `react-hooks/use-memo` rule requires those to take a static array
 * literal, which a caller-provided, variable-length array can never satisfy.
 */
export function useServicio<T>(
  cargar: () => Promise<T> | T,
  deps: unknown[] = [],
): ResultadoServicio<T> {
  const [datos, setDatos] = useState<T>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  const recargar = useCallback(() => {
    setCargando(true);
    Promise.resolve(cargarRef.current())
      .then((resultado) => {
        setDatos(resultado);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setCargando(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const esPrimerRenderRef = useRef(true);
  useEffect(() => {
    if (esPrimerRenderRef.current) {
      esPrimerRenderRef.current = false;
      return;
    }
    // The initial load already happened via useFocusEffect above — this
    // effect only reloads on a LATER deps change, so mounting never
    // double-fires `recargar`.
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-provided, variable-length reload-trigger list; `recargar` is intentionally omitted since it's permanently stable.
  }, deps);

  useEffect(() => suscribirseACambios(recargar), [recargar]);

  return { datos, cargando, error, recargar };
}
