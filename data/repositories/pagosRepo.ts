import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { Executor } from '../db/client';
import { generarId } from '../db/ids';
import { pagos } from '../db/schema';

export type Pago = typeof pagos.$inferSelect;
export type MedioPago = 'efectivo' | 'transferencia';

interface InputPagoBase {
  montoCents: number;
  medioPago: MedioPago;
  fecha: string;
  notas: string | null;
}

export type InputPago =
  | (InputPagoBase & { cuotaParticipanteId: string; deudaCuotaId?: never })
  | (InputPagoBase & { deudaCuotaId: string; cuotaParticipanteId?: never });

/** Every pago targets exactly one of a participant share or a Deuda cuota (schema CHECK). */
export function registrar(exec: Executor, input: InputPago): Pago {
  return exec
    .insert(pagos)
    .values({
      id: generarId(),
      cuotaParticipanteId: input.cuotaParticipanteId ?? null,
      deudaCuotaId: input.deudaCuotaId ?? null,
      montoCents: input.montoCents,
      medioPago: input.medioPago,
      fecha: input.fecha,
      notas: input.notas,
    })
    .returning()
    .get();
}

export function listarPorCuotaParticipante(exec: Executor, cuotaParticipanteId: string): Pago[] {
  return exec
    .select()
    .from(pagos)
    .where(and(eq(pagos.cuotaParticipanteId, cuotaParticipanteId), isNull(pagos.deletedAt)))
    .orderBy(asc(pagos.fecha), asc(pagos.createdAt))
    .all();
}

/** Cancelling ("anular") a pago is a soft delete: it stops counting toward the share's paid amount. */
export function anular(exec: Executor, id: string): void {
  exec
    .update(pagos)
    .set({ deletedAt: sql`(current_timestamp)`, updatedAt: sql`(current_timestamp)` })
    .where(and(eq(pagos.id, id), isNull(pagos.deletedAt)))
    .run();
}

export function listarPorDeudaCuota(exec: Executor, deudaCuotaId: string): Pago[] {
  return exec
    .select()
    .from(pagos)
    .where(and(eq(pagos.deudaCuotaId, deudaCuotaId), isNull(pagos.deletedAt)))
    .orderBy(asc(pagos.fecha), asc(pagos.createdAt))
    .all();
}

/** Live pagos of several Deuda cuotas in one query, oldest first. */
export function listarPorDeudaCuotas(exec: Executor, deudaCuotaIds: string[]): Pago[] {
  if (deudaCuotaIds.length === 0) {
    return [];
  }
  return exec
    .select()
    .from(pagos)
    .where(and(inArray(pagos.deudaCuotaId, deudaCuotaIds), isNull(pagos.deletedAt)))
    .orderBy(asc(pagos.fecha), asc(pagos.createdAt))
    .all();
}
