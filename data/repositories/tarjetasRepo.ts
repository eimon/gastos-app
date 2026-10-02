import { eq, isNull, sql } from 'drizzle-orm';

import type { Executor } from '../db/client';
import { generarId } from '../db/ids';
import { tarjetas } from '../db/schema';

export type Tarjeta = typeof tarjetas.$inferSelect;

export interface InputTarjeta {
  nombre: string;
  diaCierre: number;
  diaVencimiento: number;
}

/** Cards hidden from the picker on new gastos, but existing gastos keep their reference. */
export function listarActivas(exec: Executor): Tarjeta[] {
  return exec.select().from(tarjetas).where(isNull(tarjetas.deletedAt)).all();
}

/** Includes archived cards — Resumen's card totals include them (design decision). */
export function listarTodas(exec: Executor): Tarjeta[] {
  return exec.select().from(tarjetas).all();
}

export function obtener(exec: Executor, id: string): Tarjeta | undefined {
  return exec.select().from(tarjetas).where(eq(tarjetas.id, id)).get();
}

export function crear(exec: Executor, input: InputTarjeta): Tarjeta {
  return exec
    .insert(tarjetas)
    .values({ id: generarId(), ...input })
    .returning()
    .get();
}

export function actualizar(exec: Executor, id: string, input: InputTarjeta): void {
  exec
    .update(tarjetas)
    .set({ ...input, updatedAt: sql`(current_timestamp)` })
    .where(eq(tarjetas.id, id))
    .run();
}

/** Archiving replaces deletion — sets `deleted_at`, never a hard DELETE. */
export function archivar(exec: Executor, id: string): void {
  exec
    .update(tarjetas)
    .set({ deletedAt: sql`(current_timestamp)`, updatedAt: sql`(current_timestamp)` })
    .where(eq(tarjetas.id, id))
    .run();
}
