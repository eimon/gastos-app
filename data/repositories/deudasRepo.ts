import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import type { Executor } from '../db/client';
import { generarId } from '../db/ids';
import { deudaCuotas, deudas } from '../db/schema';

export type Deuda = typeof deudas.$inferSelect;
export type DeudaCuota = typeof deudaCuotas.$inferSelect;

export interface DeudaConCuotas {
  deuda: Deuda;
  cuotas: DeudaCuota[];
}

export interface InputCuotaDeuda {
  numero: number;
  montoCents: number;
  fechaVencimiento: string;
}

export interface InputCrearDeuda {
  acreedor: string;
  descripcion: string;
  montoTotalCents: number;
  cantidadCuotas: number;
  fechaPrimerPago: string;
  cuotas: InputCuotaDeuda[];
}

/** Inserts a Deuda plus its equal monthly cuota schedule. */
export function crear(exec: Executor, input: InputCrearDeuda): DeudaConCuotas {
  const deudaId = generarId();

  const deuda = exec
    .insert(deudas)
    .values({
      id: deudaId,
      acreedor: input.acreedor,
      descripcion: input.descripcion,
      montoTotalCents: input.montoTotalCents,
      cantidadCuotas: input.cantidadCuotas,
      fechaPrimerPago: input.fechaPrimerPago,
    })
    .returning()
    .get();

  const cuotas = input.cuotas.map((cuotaInput) =>
    exec
      .insert(deudaCuotas)
      .values({
        id: generarId(),
        deudaId,
        numero: cuotaInput.numero,
        montoCents: cuotaInput.montoCents,
        fechaVencimiento: cuotaInput.fechaVencimiento,
      })
      .returning()
      .get(),
  );

  return { deuda, cuotas };
}

export function listar(exec: Executor): Deuda[] {
  return exec.select().from(deudas).where(isNull(deudas.deletedAt)).orderBy(desc(deudas.fechaPrimerPago)).all();
}

export function obtenerConCuotas(exec: Executor, id: string): DeudaConCuotas | undefined {
  const deuda = exec
    .select()
    .from(deudas)
    .where(and(eq(deudas.id, id), isNull(deudas.deletedAt)))
    .get();
  if (!deuda) {
    return undefined;
  }

  const cuotas = exec
    .select()
    .from(deudaCuotas)
    .where(eq(deudaCuotas.deudaId, id))
    .orderBy(asc(deudaCuotas.numero))
    .all();

  return { deuda, cuotas };
}
