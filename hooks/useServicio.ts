import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { suscribirseACambios } from '../services/cambios';
import { claveDeDeps, esVigente, estaCargando } from '../services/datosVigentes';

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
 * **Stale data contract**: loaded data and errors are tagged with a key derived from `deps`
 * (see `services/datosVigentes.ts`). When `deps` changes (another month, another id), the
 * previous data is NOT exposed: `datos` is `undefined` and `cargando` is true until the new
 * load resolves, or `error` is set if it fails, so a screen never shows one month's figures
 * under another month's header. Reloads for the SAME deps (focus, `cambios`) keep showing the
 * current data while they run. Only the latest request applies its result.
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
  const [cargado, setCargado] = useState<{ valor: T; clave: string }>();
  const [fallo, setFallo] = useState<{ error: Error; clave: string } | null>(null);
  const [enCurso, setEnCurso] = useState(true);

  const claveActual = claveDeDeps(deps);

  // Refs are written in effects, declared before the deps effect below so that effect's
  // reload already sees the new key and the latest `cargar`.
  const cargarRef = useRef(cargar);
  const claveRef = useRef(claveActual);
  useEffect(() => {
    cargarRef.current = cargar;
    claveRef.current = claveActual;
  });
  const peticionRef = useRef(0);

  const recargar = useCallback(() => {
    const peticion = ++peticionRef.current;
    const clave = claveRef.current;
    const esLaUltima = () => peticion === peticionRef.current;
    setEnCurso(true);
    Promise.resolve(cargarRef.current())
      .then((valor) => {
        if (esLaUltima()) {
          setCargado({ valor, clave });
          setFallo(null);
        }
      })
      .catch((err: unknown) => {
        if (esLaUltima()) {
          setFallo({ error: err instanceof Error ? err : new Error(String(err)), clave });
        }
      })
      .finally(() => {
        if (esLaUltima()) {
          setEnCurso(false);
        }
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

  const hayDatosVigentes = esVigente(cargado?.clave, claveActual);
  const errorVigente = fallo && esVigente(fallo.clave, claveActual) ? fallo.error : null;
  return {
    datos: hayDatosVigentes ? cargado?.valor : undefined,
    cargando: estaCargando(enCurso, hayDatosVigentes, errorVigente !== null),
    error: errorVigente,
    recargar,
  };
}
