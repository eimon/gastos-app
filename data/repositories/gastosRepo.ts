import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import type { Executor } from '../db/client';
import { generarId } from '../db/ids';
import { cuotaParticipantes, gastoCuotas, gastoParticipantes, gastos, pagos } from '../db/schema';

export type Gasto = typeof gastos.$inferSelect;
export type GastoCuota = typeof gastoCuotas.$inferSelect;
export type GastoParticipante = typeof gastoParticipantes.$inferSelect;
export type CuotaParticipante = typeof cuotaParticipantes.$inferSelect;

export interface GastoConDetalle {
  gasto: Gasto;
  participantes: GastoParticipante[];
  cuotas: (GastoCuota & { partes: CuotaParticipante[] })[];
}

export interface InputParticipante {
  nombre: string;
  esUsuario: boolean;
}

export interface InputCuota {
  numero: number;
  montoCents: number;
  fechaCierre: string | null;
  fechaVencimiento: string;
  /** Amount per participant share, same order as `InputCrearGasto.participantes`. */
  partes: number[];
}

export interface InputCrearGasto {
  descripcion: string;
  fechaCompra: string;
  tipo: 'personal' | 'compartido';
  montoTotalCents: number;
  descuentoCents: number;
  tipoDescuento: 'uniforme' | 'prorrateo' | null;
  cantidadCuotas: number;
  tarjetaId: string | null;
  /** Ordered so the user (payer) is LAST — matches `gasto_participantes.orden`. */
  participantes: InputParticipante[];
  cuotas: InputCuota[];
}

/** Shared by `crear` and `actualizarCompleto`: inserts participantes, cuotas and shares for a gasto id that already exists. */
function insertarParticipantesYCuotas(
  exec: Executor,
  gastoId: string,
  participantesInput: InputParticipante[],
  cuotasInput: InputCuota[],
): { participantes: GastoParticipante[]; cuotas: (GastoCuota & { partes: CuotaParticipante[] })[] } {
  const participantes = participantesInput.map((participante, orden) =>
    exec
      .insert(gastoParticipantes)
      .values({
        id: generarId(),
        gastoId,
        nombre: participante.nombre,
        esUsuario: participante.esUsuario,
        orden,
      })
      .returning()
      .get(),
  );

  const cuotas = cuotasInput.map((cuotaInput) => {
    const cuota = exec
      .insert(gastoCuotas)
      .values({
        id: generarId(),
        gastoId,
        numero: cuotaInput.numero,
        montoCents: cuotaInput.montoCents,
        fechaCierre: cuotaInput.fechaCierre,
        fechaVencimiento: cuotaInput.fechaVencimiento,
      })
      .returning()
      .get();

    const partes = cuotaInput.partes.map((montoCents, i) =>
      exec
        .insert(cuotaParticipantes)
        .values({
          id: generarId(),
          gastoCuotaId: cuota.id,
          participanteId: participantes[i].id,
          montoCents,
        })
        .returning()
        .get(),
    );

    return { ...cuota, partes };
  });

  return { participantes, cuotas };
}

/** Inserts a gasto plus its participantes, cuotas and per-cuota participant shares. */
export function crear(exec: Executor, input: InputCrearGasto): GastoConDetalle {
  const gastoId = generarId();

  const gasto = exec
    .insert(gastos)
    .values({
      id: gastoId,
      descripcion: input.descripcion,
      fechaCompra: input.fechaCompra,
      tipo: input.tipo,
      montoTotalCents: input.montoTotalCents,
      descuentoCents: input.descuentoCents,
      tipoDescuento: input.tipoDescuento,
      cantidadCuotas: input.cantidadCuotas,
      tarjetaId: input.tarjetaId,
    })
    .returning()
    .get();

  const { participantes, cuotas } = insertarParticipantesYCuotas(
    exec,
    gastoId,
    input.participantes,
    input.cuotas,
  );

  return { gasto, participantes, cuotas };
}

/**
 * Replaces a gasto's core fields, participantes and cuotas. The caller
 * (`gastosService.editar`) MUST guarantee no pago exists for this gasto
 * before calling this — that's what makes deleting and reinserting
 * participantes/cuotas/shares safe (no pago can be left dangling).
 */
export function actualizarCompleto(exec: Executor, id: string, input: InputCrearGasto): GastoConDetalle {
  exec
    .delete(cuotaParticipantes)
    .where(
      sql`${cuotaParticipantes.gastoCuotaId} IN (SELECT ${gastoCuotas.id} FROM ${gastoCuotas} WHERE ${gastoCuotas.gastoId} = ${id})`,
    )
    .run();
  exec.delete(gastoCuotas).where(eq(gastoCuotas.gastoId, id)).run();
  exec.delete(gastoParticipantes).where(eq(gastoParticipantes.gastoId, id)).run();

  const gasto = exec
    .update(gastos)
    .set({
      descripcion: input.descripcion,
      fechaCompra: input.fechaCompra,
      tipo: input.tipo,
      montoTotalCents: input.montoTotalCents,
      descuentoCents: input.descuentoCents,
      tipoDescuento: input.tipoDescuento,
      cantidadCuotas: input.cantidadCuotas,
      tarjetaId: input.tarjetaId,
      updatedAt: sql`(current_timestamp)`,
    })
    .where(eq(gastos.id, id))
    .returning()
    .get();

  const { participantes, cuotas } = insertarParticipantesYCuotas(exec, id, input.participantes, input.cuotas);

  return { gasto, participantes, cuotas };
}

export function listar(exec: Executor): Gasto[] {
  return exec.select().from(gastos).where(isNull(gastos.deletedAt)).orderBy(desc(gastos.fechaCompra)).all();
}

export function obtenerConDetalle(exec: Executor, id: string): GastoConDetalle | undefined {
  const gasto = exec
    .select()
    .from(gastos)
    .where(and(eq(gastos.id, id), isNull(gastos.deletedAt)))
    .get();
  if (!gasto) {
    return undefined;
  }

  const participantes = exec
    .select()
    .from(gastoParticipantes)
    .where(eq(gastoParticipantes.gastoId, id))
    .orderBy(asc(gastoParticipantes.orden))
    .all();

  const cuotasRows = exec
    .select()
    .from(gastoCuotas)
    .where(eq(gastoCuotas.gastoId, id))
    .orderBy(asc(gastoCuotas.numero))
    .all();

  const cuotas = cuotasRows.map((cuota) => ({
    ...cuota,
    partes: exec.select().from(cuotaParticipantes).where(eq(cuotaParticipantes.gastoCuotaId, cuota.id)).all(),
  }));

  return { gasto, participantes, cuotas };
}

/** Only the description stays editable once a gasto has recorded repayments. */
export function actualizarDescripcion(exec: Executor, id: string, descripcion: string): void {
  exec
    .update(gastos)
    .set({ descripcion, updatedAt: sql`(current_timestamp)` })
    .where(eq(gastos.id, id))
    .run();
}

/** Gates `gastosService.editar`: amount/cuotas/participantes lock once any (non-deleted) pago exists. */
export function tieneAlgunPago(exec: Executor, gastoId: string): boolean {
  const filas = exec
    .select({ id: pagos.id })
    .from(pagos)
    .innerJoin(cuotaParticipantes, eq(pagos.cuotaParticipanteId, cuotaParticipantes.id))
    .innerJoin(gastoCuotas, eq(cuotaParticipantes.gastoCuotaId, gastoCuotas.id))
    .where(and(eq(gastoCuotas.gastoId, gastoId), isNull(pagos.deletedAt)))
    .limit(1)
    .all();

  return filas.length > 0;
}
