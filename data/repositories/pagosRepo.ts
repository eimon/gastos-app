import { and, eq, isNull } from 'drizzle-orm';

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
    .all();
}

export function listarPorDeudaCuota(exec: Executor, deudaCuotaId: string): Pago[] {
  return exec
    .select()
    .from(pagos)
    .where(and(eq(pagos.deudaCuotaId, deudaCuotaId), isNull(pagos.deletedAt)))
    .all();
}
