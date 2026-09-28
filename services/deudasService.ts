import type { Centavos } from '../domain/dinero';
import { planificarDeuda } from '../domain/deuda';
import type { FechaISO } from '../domain/vencimientos';
import { db } from '../data/db/client';
import * as deudasRepo from '../data/repositories/deudasRepo';
import { emitirCambio } from './cambios';

export interface InputCrearDeuda {
  acreedor: string;
  descripcion: string;
  montoTotalCents: Centavos;
  cuotas: number;
  fechaPrimerPago: FechaISO;
}

/**
 * Plans the equal monthly cuota schedule via `domain/deuda.ts` (throws on
 * any `validarDeuda` error — no card, no discount), then persists the
 * Deuda and its cuotas in one transaction.
 */
export async function crear(input: InputCrearDeuda): Promise<deudasRepo.DeudaConCuotas> {
  const plan = planificarDeuda({
    acreedor: input.acreedor,
    descripcion: input.descripcion,
    montoTotalCents: input.montoTotalCents,
    cuotas: input.cuotas,
    fechaPrimerPago: input.fechaPrimerPago,
  });

  const resultado = db.transaction((tx) =>
    deudasRepo.crear(tx, {
      acreedor: input.acreedor,
      descripcion: input.descripcion,
      montoTotalCents: input.montoTotalCents,
      cantidadCuotas: input.cuotas,
      fechaPrimerPago: input.fechaPrimerPago,
      cuotas: plan.cuotas.map((cuota) => ({
        numero: cuota.numero,
        montoCents: cuota.montoCents,
        fechaVencimiento: cuota.fechaVencimiento,
      })),
    }),
  );

  emitirCambio();
  return resultado;
}

export async function listar(): Promise<deudasRepo.Deuda[]> {
  return deudasRepo.listar(db);
}

export async function obtener(id: string): Promise<deudasRepo.DeudaConCuotas | undefined> {
  return deudasRepo.obtenerConCuotas(db, id);
}
