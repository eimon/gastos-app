import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import type { Executor } from '../db/client';
import { generarId } from '../db/ids';
import { deudaCuotas, deudas, pagos } from '../db/schema';

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

function insertarCuotas(exec: Executor, deudaId: string, cuotas: InputCuotaDeuda[]): DeudaCuota[] {
  return cuotas.map((cuotaInput) =>
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

  const cuotas = insertarCuotas(exec, deudaId, input.cuotas);

  return { deuda, cuotas };
}

/** One cuota due in the month with the sum of its LIVE pagos (anulados do not count). */
export interface CuotaDeudaListada {
  deudaId: string;
  acreedor: string;
  descripcion: string;
  cantidadCuotas: number;
  numero: number;
  montoCents: number;
  fechaVencimiento: string;
  pagadoCents: number;
}

/** Cuotas of live deudas due in `[desde, hasta]` (inclusive `YYYY-MM-DD`). */
export function listarCuotasEntre(exec: Executor, desde: string, hasta: string): CuotaDeudaListada[] {
  const filas = exec
    .select({
      cuotaId: deudaCuotas.id,
      deudaId: deudas.id,
      acreedor: deudas.acreedor,
      descripcion: deudas.descripcion,
      cantidadCuotas: deudas.cantidadCuotas,
      numero: deudaCuotas.numero,
      montoCents: deudaCuotas.montoCents,
      fechaVencimiento: deudaCuotas.fechaVencimiento,
    })
    .from(deudaCuotas)
    .innerJoin(deudas, eq(deudaCuotas.deudaId, deudas.id))
    .where(and(isNull(deudas.deletedAt), gte(deudaCuotas.fechaVencimiento, desde), lte(deudaCuotas.fechaVencimiento, hasta)))
    .orderBy(asc(deudaCuotas.fechaVencimiento), asc(deudas.acreedor), asc(deudaCuotas.numero))
    .all();
  if (filas.length === 0) {
    return [];
  }

  const pagadoPorCuota = new Map<string, number>();
  const vivos = exec
    .select({ deudaCuotaId: pagos.deudaCuotaId, montoCents: pagos.montoCents })
    .from(pagos)
    .where(and(inArray(pagos.deudaCuotaId, filas.map((fila) => fila.cuotaId)), isNull(pagos.deletedAt)))
    .all();
  for (const { deudaCuotaId, montoCents } of vivos) {
    pagadoPorCuota.set(deudaCuotaId!, (pagadoPorCuota.get(deudaCuotaId!) ?? 0) + montoCents);
  }

  return filas.map(({ cuotaId, ...fila }) => ({ ...fila, pagadoCents: pagadoPorCuota.get(cuotaId) ?? 0 }));
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

/** Soft delete. False when no live deuda has that id. */
export function eliminar(exec: Executor, id: string): boolean {
  const { changes } = exec
    .update(deudas)
    .set({ deletedAt: sql`(current_timestamp)`, updatedAt: sql`(current_timestamp)` })
    .where(and(eq(deudas.id, id), isNull(deudas.deletedAt)))
    .run();
  return changes > 0;
}

/** Text-only edit (allowed with pagos). False when no live deuda has that id. */
export function actualizarTextos(exec: Executor, id: string, acreedor: string, descripcion: string): boolean {
  const { changes } = exec
    .update(deudas)
    .set({ acreedor, descripcion, updatedAt: sql`(current_timestamp)` })
    .where(and(eq(deudas.id, id), isNull(deudas.deletedAt)))
    .run();
  return changes > 0;
}

/** Gates edit and delete: true once any LIVE (not anulado) pago targets a cuota of the deuda. */
export function tieneAlgunPago(exec: Executor, deudaId: string): boolean {
  const filas = exec
    .select({ id: pagos.id })
    .from(pagos)
    .innerJoin(deudaCuotas, eq(pagos.deudaCuotaId, deudaCuotas.id))
    .where(and(eq(deudaCuotas.deudaId, deudaId), isNull(pagos.deletedAt)))
    .limit(1)
    .all();
  return filas.length > 0;
}

export interface InputActualizarDeuda {
  acreedor: string;
  descripcion: string;
  montoTotalCents: number;
  cantidadCuotas: number;
  fechaPrimerPago: string;
  cuotas: InputCuotaDeuda[];
}

/** Replaces the core fields and cuotas; the caller MUST have checked there is no live pago, in the same tx. */
export function actualizarCompleto(exec: Executor, id: string, input: InputActualizarDeuda): DeudaConCuotas {
  // Anulados pagos still reference their cuota (FK): purge them before replacing the cuotas.
  exec
    .delete(pagos)
    .where(
      sql`${pagos.deudaCuotaId} IN (SELECT ${deudaCuotas.id} FROM ${deudaCuotas} WHERE ${deudaCuotas.deudaId} = ${id}) AND ${pagos.deletedAt} IS NOT NULL`,
    )
    .run();
  exec.delete(deudaCuotas).where(eq(deudaCuotas.deudaId, id)).run();

  const deuda = exec
    .update(deudas)
    .set({
      acreedor: input.acreedor,
      descripcion: input.descripcion,
      montoTotalCents: input.montoTotalCents,
      cantidadCuotas: input.cantidadCuotas,
      fechaPrimerPago: input.fechaPrimerPago,
      updatedAt: sql`(current_timestamp)`,
    })
    .where(eq(deudas.id, id))
    .returning()
    .get();

  return { deuda, cuotas: insertarCuotas(exec, id, input.cuotas) };
}
