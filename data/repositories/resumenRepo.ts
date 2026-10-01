/**
 * Read-only queries behind the monthly Resumen. Every query ignores soft-deleted gastos and
 * deudas, and the pago sums count LIVE pagos only (an anulado pago has `deleted_at` set).
 * Ranges are inclusive `YYYY-MM-DD`. The month rules themselves live in `domain/resumen.ts`.
 */
import { and, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';

import type { Executor } from '../db/client';
import { cuotaParticipantes, deudaCuotas, deudas, gastoCuotas, gastoParticipantes, gastos, pagos } from '../db/schema';

/** Cuota of a gasto paid with a card, with the FULL cuota amount (the card is charged in full). */
export interface CuotaDeTarjeta {
  tarjetaId: string;
  montoCents: number;
  fechaVencimiento: string;
}

/** Cuotas due in `[desde, hasta]` of live gastos paid with a card (archived cards included). */
export function listarCuotasDeTarjetaEntre(exec: Executor, desde: string, hasta: string): CuotaDeTarjeta[] {
  return exec
    .select({
      tarjetaId: gastos.tarjetaId,
      montoCents: gastoCuotas.montoCents,
      fechaVencimiento: gastoCuotas.fechaVencimiento,
    })
    .from(gastoCuotas)
    .innerJoin(gastos, eq(gastoCuotas.gastoId, gastos.id))
    .where(
      and(
        isNull(gastos.deletedAt),
        isNotNull(gastos.tarjetaId),
        gte(gastoCuotas.fechaVencimiento, desde),
        lte(gastoCuotas.fechaVencimiento, hasta),
      ),
    )
    .all() as CuotaDeTarjeta[];
}

/** Sum of the LIVE pagos of a share or cuota; anulado pagos (`deleted_at` set) do not count. */
const pagadoDeParte = sql<number>`COALESCE((SELECT SUM(${pagos.montoCents}) FROM ${pagos} WHERE ${pagos.cuotaParticipanteId} = ${cuotaParticipantes.id} AND ${pagos.deletedAt} IS NULL), 0)`;
const pagadoDeCuotaDeuda = sql<number>`COALESCE((SELECT SUM(${pagos.montoCents}) FROM ${pagos} WHERE ${pagos.deudaCuotaId} = ${deudaCuotas.id} AND ${pagos.deletedAt} IS NULL), 0)`;

/** An amount owed with the sum of its LIVE pagos, due on `fechaVencimiento`. */
export interface SaldoPendiente {
  montoCents: number;
  pagadoCents: number;
  fechaVencimiento: string;
}

/** Non-user share of a gasto cuota (what a participant owes the user). */
export interface ParteACobrar extends SaldoPendiente {
  nombre: string;
}

/** Still-unpaid (remaining > 0) non-user shares of live gastos due on or before `hasta`; the domain splits del mes from vencido. */
export function listarPartesACobrarHasta(exec: Executor, hasta: string): ParteACobrar[] {
  return exec
    .select({
      nombre: gastoParticipantes.nombre,
      montoCents: cuotaParticipantes.montoCents,
      fechaVencimiento: gastoCuotas.fechaVencimiento,
      pagadoCents: pagadoDeParte,
    })
    .from(cuotaParticipantes)
    .innerJoin(gastoParticipantes, eq(cuotaParticipantes.participanteId, gastoParticipantes.id))
    .innerJoin(gastoCuotas, eq(cuotaParticipantes.gastoCuotaId, gastoCuotas.id))
    .innerJoin(gastos, eq(gastoCuotas.gastoId, gastos.id))
    .where(
      and(
        isNull(gastos.deletedAt),
        eq(gastoParticipantes.esUsuario, false),
        lte(gastoCuotas.fechaVencimiento, hasta),
        sql`${cuotaParticipantes.montoCents} > ${pagadoDeParte}`,
      ),
    )
    .all();
}

export interface CuotaDeDeuda extends SaldoPendiente {
  acreedor: string;
}

/** Still-unpaid (remaining > 0) cuotas of live deudas due on or before `hasta`. */
export function listarCuotasDeDeudaHasta(exec: Executor, hasta: string): CuotaDeDeuda[] {
  return exec
    .select({
      acreedor: deudas.acreedor,
      montoCents: deudaCuotas.montoCents,
      fechaVencimiento: deudaCuotas.fechaVencimiento,
      pagadoCents: pagadoDeCuotaDeuda,
    })
    .from(deudaCuotas)
    .innerJoin(deudas, eq(deudaCuotas.deudaId, deudas.id))
    .where(
      and(
        isNull(deudas.deletedAt),
        lte(deudaCuotas.fechaVencimiento, hasta),
        sql`${deudaCuotas.montoCents} > ${pagadoDeCuotaDeuda}`,
      ),
    )
    .all();
}

export interface GastoDelUsuario {
  tipo: 'personal' | 'compartido';
  /** The user's share summed across ALL cuotas of the gasto. */
  montoCents: number;
}

/** User's own share of every live gasto BOUGHT in `[desde, hasta]` (purchase date, not due date). */
export function listarGastosDelUsuarioPorCompra(exec: Executor, desde: string, hasta: string): GastoDelUsuario[] {
  return exec
    .select({
      tipo: gastos.tipo,
      montoCents: sql<number>`SUM(${cuotaParticipantes.montoCents})`,
    })
    .from(cuotaParticipantes)
    .innerJoin(gastoParticipantes, eq(cuotaParticipantes.participanteId, gastoParticipantes.id))
    .innerJoin(gastoCuotas, eq(cuotaParticipantes.gastoCuotaId, gastoCuotas.id))
    .innerJoin(gastos, eq(gastoCuotas.gastoId, gastos.id))
    .where(
      and(isNull(gastos.deletedAt), eq(gastoParticipantes.esUsuario, true), gte(gastos.fechaCompra, desde), lte(gastos.fechaCompra, hasta)),
    )
    .groupBy(gastos.id, gastos.tipo)
    .all();
}
