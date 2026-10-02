import { eq } from 'drizzle-orm';

import { estadoDePago, validarPago, type ErrorPago } from '../domain/pagos';
import { db, type Transaction } from '../data/db/client';
import { cuotaParticipantes, deudaCuotas, deudas, gastoCuotas, gastoParticipantes, gastos } from '../data/db/schema';
import * as pagosRepo from '../data/repositories/pagosRepo';
import { emitirCambio } from './cambios';

export type ObjetivoPago =
  | { tipo: 'participante'; cuotaParticipanteId: string }
  | { tipo: 'deuda'; deudaCuotaId: string };

export interface InputRegistrarPago {
  objetivo: ObjetivoPago;
  montoCents: number;
  medioPago: pagosRepo.MedioPago;
  fecha: string;
  notas?: string | null;
}

export type CodigoErrorPago = ErrorPago | 'ES_USUARIO' | 'OBJETIVO_NO_ENCONTRADO' | 'GASTO_ELIMINADO' | 'DEUDA_ELIMINADA' | 'MEDIO_PAGO_INVALIDO';

const MEDIOS_PAGO_VALIDOS: readonly string[] = ['efectivo', 'transferencia'];

export class PagoRechazadoError extends Error {
  /** `restanteCents` is the fresh remaining amount seen inside the transaction, for amount errors. */
  constructor(
    public readonly codigos: CodigoErrorPago[],
    public readonly restanteCents?: number,
  ) {
    super(`Pago rechazado: ${codigos.join(', ')}`);
  }
}

function verificarYRegistrar(tx: Transaction, input: InputRegistrarPago): pagosRepo.Pago {
  // Runtime guard: the TS union is erased and 'descuento' is not a valid medio de pago.
  // The DB triggers are the last line of defense; this gives a coded, mappable error first.
  if (!MEDIOS_PAGO_VALIDOS.includes(input.medioPago)) {
    throw new PagoRechazadoError(['MEDIO_PAGO_INVALIDO']);
  }

  if (input.objetivo.tipo === 'participante') {
    const { cuotaParticipanteId } = input.objetivo;

    const fila = tx
      .select({
        montoCents: cuotaParticipantes.montoCents,
        esUsuario: gastoParticipantes.esUsuario,
        gastoEliminadoEn: gastos.deletedAt,
      })
      .from(cuotaParticipantes)
      .innerJoin(gastoParticipantes, eq(cuotaParticipantes.participanteId, gastoParticipantes.id))
      .innerJoin(gastoCuotas, eq(cuotaParticipantes.gastoCuotaId, gastoCuotas.id))
      .innerJoin(gastos, eq(gastoCuotas.gastoId, gastos.id))
      .where(eq(cuotaParticipantes.id, cuotaParticipanteId))
      .get();

    if (!fila) {
      throw new PagoRechazadoError(['OBJETIVO_NO_ENCONTRADO']);
    }
    // A deleted gasto can no longer receive pagos.
    if (fila.gastoEliminadoEn) {
      throw new PagoRechazadoError(['GASTO_ELIMINADO']);
    }
    // The user's own share is informational-only and can never be paid
    // (spec: User's Own Cuota Is Informational) — the schema can't express
    // this with a CHECK constraint, so the service enforces it.
    if (fila.esUsuario) {
      throw new PagoRechazadoError(['ES_USUARIO']);
    }

    const pagosExistentes = pagosRepo.listarPorCuotaParticipante(tx, cuotaParticipanteId).map((p) => p.montoCents);
    const { restante } = estadoDePago(fila.montoCents, pagosExistentes);
    const errores = validarPago(input.montoCents, restante);
    if (errores.length > 0) {
      throw new PagoRechazadoError(errores, restante);
    }

    return pagosRepo.registrar(tx, {
      cuotaParticipanteId,
      montoCents: input.montoCents,
      medioPago: input.medioPago,
      fecha: input.fecha,
      notas: input.notas ?? null,
    });
  }

  const { deudaCuotaId } = input.objetivo;

  const fila = tx
    .select({ montoCents: deudaCuotas.montoCents, deudaEliminadaEn: deudas.deletedAt })
    .from(deudaCuotas)
    .innerJoin(deudas, eq(deudaCuotas.deudaId, deudas.id))
    .where(eq(deudaCuotas.id, deudaCuotaId))
    .get();
  if (!fila) {
    throw new PagoRechazadoError(['OBJETIVO_NO_ENCONTRADO']);
  }
  // A deleted deuda can no longer receive pagos.
  if (fila.deudaEliminadaEn) {
    throw new PagoRechazadoError(['DEUDA_ELIMINADA']);
  }

  const pagosExistentes = pagosRepo.listarPorDeudaCuota(tx, deudaCuotaId).map((p) => p.montoCents);
  const { restante } = estadoDePago(fila.montoCents, pagosExistentes);
  const errores = validarPago(input.montoCents, restante);
  if (errores.length > 0) {
    throw new PagoRechazadoError(errores, restante);
  }

  return pagosRepo.registrar(tx, {
    deudaCuotaId,
    montoCents: input.montoCents,
    medioPago: input.medioPago,
    fecha: input.fecha,
    notas: input.notas ?? null,
  });
}

/** Cancels a pago (soft delete); the share's paid amount and status are derived again. */
export async function anular(pagoId: string): Promise<void> {
  pagosRepo.anular(db, pagoId);
  emitirCambio();
}

/**
 * Re-checks `validarPago` INSIDE the transaction against freshly reloaded
 * pagos (not whatever restante the screen last rendered) — this guards
 * against stale screens or double taps landing two payments that together
 * overpay a share. Supports multiple partial payments; the default UX
 * action (screen layer) pays the full restante.
 */
export async function registrar(input: InputRegistrarPago): Promise<pagosRepo.Pago> {
  const pago = db.transaction((tx) => verificarYRegistrar(tx, input));
  emitirCambio();
  return pago;
}
