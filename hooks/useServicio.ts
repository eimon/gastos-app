import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { suscribirseACambios } from '../services/cambios';

export interface ResultadoServicio<T> {
  datos: T | undefined;
  cargando: boolean;
  error: Error | null;
  recargar: () => void;
}

/**
 * Loads `cargar()` on screen focus and again whenever any service emits a
 * `cambios` event (see `services/cambios.ts`). Screens need service-computed
 * aggregates, not raw table rows, so this — not `useLiveQuery` — is the
 * standard data-loading hook for every screen.
 */
export function useServicio<T>(
  cargar: () => Promise<T> | T,
  deps: unknown[] = [],
): ResultadoServicio<T> {
  const [datos, setDatos] = useState<T>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const recargar = useCallback(() => {
    setCargando(true);
    Promise.resolve(cargar())
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  useEffect(() => suscribirseACambios(recargar), [recargar]);

  return { datos, cargando, error, recargar };
}
