import type { Centavos } from '../domain/dinero';
import type { TipoDescuento } from '../domain/cuotas';
import { planificarGasto, type InputGasto, type TipoGasto } from '../domain/gasto';
import type { FechaISO } from '../domain/vencimientos';
import { db, type Executor } from '../data/db/client';
import * as gastosRepo from '../data/repositories/gastosRepo';
import * as pagosRepo from '../data/repositories/pagosRepo';
import * as tarjetasRepo from '../data/repositories/tarjetasRepo';
import { emitirCambio } from './cambios';
import { armarDetalleGasto, rangoDelMes, type DetalleGasto } from './gastoVista';
import { NOMBRE_USUARIO_POR_DEFECTO, construirCuotasRepo, construirParticipantes } from './gastoPlanMapper';

export interface InputCrearGasto {
  tipo: TipoGasto;
  descripcion: string;
  fechaCompra: FechaISO;
  montoTotalCents: Centavos;
  descuentoCents: Centavos;
  tipoDescuento: TipoDescuento | null;
  cuotas: number;
  tarjetaId: string | null;
  /** Other participants' names, excluding the user. Required for `tipo: 'compartido'`. */
  participantes: string[];
  /** Fixed amount per person (others in order, the user LAST). Shared gasto with 1 cuota only. */
  montosPersonalizadosCents?: Centavos[];
  /** Display name for the user's own share row. Defaults to "Yo". */
  nombreUsuario?: string;
}

/** Throws when the tarjetaId doesn't resolve to any card at all (archived or not). */
function resolverTarjeta(exec: Executor, tarjetaId: string | null): InputGasto['tarjeta'] {
  if (!tarjetaId) {
    return null;
  }

  const tarjeta = tarjetasRepo.obtener(exec, tarjetaId);
  if (!tarjeta) {
    throw new Error('Tarjeta no encontrada.');
  }

  return { id: tarjeta.id, diaCierre: tarjeta.diaCierre, diaVencimiento: tarjeta.diaVencimiento };
}

/**
 * Same as `resolverTarjeta`, but additionally rejects an archived card.
 * Archived cards are hidden from the picker for NEW gastos (spec: Archiving
 * Replaces Deletion) — only `crear` uses this. `editar` uses the plain
 * `resolverTarjeta` instead, since a gasto that already references a
 * since-archived card must keep working (its existing cuota due dates stay
 * unchanged regardless of the card's archived state).
 */
function resolverTarjetaParaCrear(exec: Executor, tarjetaId: string | null): InputGasto['tarjeta'] {
  if (!tarjetaId) {
    return null;
  }

  const tarjeta = tarjetasRepo.obtener(exec, tarjetaId);
  if (!tarjeta) {
    throw new Error('Tarjeta no encontrada.');
  }
  if (tarjeta.deletedAt) {
    throw new Error('La tarjeta seleccionada está archivada.');
  }

  return { id: tarjeta.id, diaCierre: tarjeta.diaCierre, diaVencimiento: tarjeta.diaVencimiento };
}

/**
 * Plans the gasto via `domain/gasto.ts` (throws on any `validarGasto`
 * error), splits every cuota among participants via
 * `domain/participantes.ts`, then persists gasto + participantes + cuotas +
 * shares in one transaction.
 */
export async function crear(input: InputCrearGasto): Promise<gastosRepo.GastoConDetalle> {
  // planificarGasto validates description, date, amounts and cuotas through the
  // domain gate before computing anything, so the form is never trusted.
  const plan = planificarGasto({
    descripcion: input.descripcion,
    tipo: input.tipo,
    fechaCompra: input.fechaCompra,
    montoTotalCents: input.montoTotalCents,
    descuentoCents: input.descuentoCents,
    tipoDescuento: input.tipoDescuento,
    cuotas: input.cuotas,
    tarjeta: resolverTarjetaParaCrear(db, input.tarjetaId),
    participantes: input.tipo === 'compartido' ? input.participantes : [],
    montosPersonalizadosCents: input.montosPersonalizadosCents,
  });

  const participantes = construirParticipantes({
    tipo: input.tipo,
    participantes: input.participantes,
    nombreUsuario: input.nombreUsuario,
  });
  const cuotas = construirCuotasRepo(plan, participantes.length, input.montosPersonalizadosCents);

  const resultado = db.transaction((tx) =>
    gastosRepo.crear(tx, {
      descripcion: input.descripcion.trim(),
      fechaCompra: input.fechaCompra,
      tipo: input.tipo,
      montoTotalCents: input.montoTotalCents,
      descuentoCents: input.descuentoCents,
      tipoDescuento: input.tipoDescuento,
      cantidadCuotas: input.cuotas,
      tarjetaId: input.tarjetaId,
      participantes,
      cuotas,
    }),
  );

  emitirCambio();
  return resultado;
}

export async function listar(): Promise<gastosRepo.Gasto[]> {
  return gastosRepo.listar(db);
}

export async function obtener(id: string): Promise<gastosRepo.GastoConDetalle | undefined> {
  return gastosRepo.obtenerConDetalle(db, id);
}

/** Cuotas whose due date falls in the given month (`mes` 1-12), for the month-scoped list. */
export async function listarDelMes(mes: number, anio: number): Promise<gastosRepo.CuotaListada[]> {
  const { desde, hasta } = rangoDelMes(mes, anio);
  return gastosRepo.listarCuotasEntre(db, desde, hasta);
}

/** Read-only detail: cuota schedule, each participant's share and its derived payment status. */
export async function obtenerDetalle(id: string): Promise<DetalleGasto | undefined> {
  const detalle = gastosRepo.obtenerConDetalle(db, id);
  if (!detalle) {
    return undefined;
  }

  const pagosPorParte: Record<string, number[]> = {};
  for (const cuota of detalle.cuotas) {
    for (const parte of cuota.partes) {
      pagosPorParte[parte.id] = pagosRepo.listarPorCuotaParticipante(db, parte.id).map((pago) => pago.montoCents);
    }
  }
  const tarjeta = detalle.gasto.tarjetaId ? tarjetasRepo.obtener(db, detalle.gasto.tarjetaId) : undefined;

  return armarDetalleGasto(detalle, pagosPorParte, tarjeta?.nombre ?? null);
}

export type ErrorEditarGasto = 'BLOQUEADO_POR_PAGO' | 'GASTO_NO_ENCONTRADO';

export interface InputEditarGasto {
  descripcion: string;
  montoTotalCents?: Centavos;
  descuentoCents?: Centavos;
  tipoDescuento?: TipoDescuento | null;
  cuotas?: number;
  tarjetaId?: string | null;
  /** Other participants' names, excluding the user. Only meaningful when `tipo` is 'compartido'. */
  participantes?: string[];
}

/**
 * The description is always editable. Editing amount, cuotas, tarjeta or
 * participantes is rejected once any pago has been recorded against this
 * gasto's shares (spec: Shared Gasto Immutability After Repayments) — the
 * gate guarantees that when a core-field edit is allowed, zero pagos exist,
 * so replacing cuotas/participantes can never orphan a pago row.
 */
export async function editar(id: string, input: InputEditarGasto): Promise<void> {
  const cambiaCampoNucleo =
    input.montoTotalCents !== undefined ||
    input.descuentoCents !== undefined ||
    input.tipoDescuento !== undefined ||
    input.cuotas !== undefined ||
    input.tarjetaId !== undefined ||
    input.participantes !== undefined;

  if (!cambiaCampoNucleo) {
    gastosRepo.actualizarDescripcion(db, id, input.descripcion);
    emitirCambio();
    return;
  }

  // The tieneAlgunPago check, the current-state read and the write all run
  // INSIDE this one transaction (matching pagosService.registrar's pattern)
  // so the decision to allow the edit and the edit itself see the same
  // transactional snapshot — no other write can land between the check and
  // the write.
  db.transaction((tx) => {
    if (gastosRepo.tieneAlgunPago(tx, id)) {
      const error: Error & { code?: ErrorEditarGasto } = new Error(
        'No se puede editar el monto, las cuotas ni los participantes: ya hay pagos registrados.',
      );
      error.code = 'BLOQUEADO_POR_PAGO';
      throw error;
    }

    const actual = gastosRepo.obtenerConDetalle(tx, id);
    if (!actual) {
      const error: Error & { code?: ErrorEditarGasto } = new Error('Gasto no encontrado.');
      error.code = 'GASTO_NO_ENCONTRADO';
      throw error;
    }

    const montoTotalCents = input.montoTotalCents ?? actual.gasto.montoTotalCents;
    const descuentoCents = input.descuentoCents ?? actual.gasto.descuentoCents;
    const tipoDescuento =
      input.tipoDescuento !== undefined ? input.tipoDescuento : (actual.gasto.tipoDescuento as TipoDescuento | null);
    const cuotasCount = input.cuotas ?? actual.gasto.cantidadCuotas;
    const tarjetaId = input.tarjetaId !== undefined ? input.tarjetaId : actual.gasto.tarjetaId;
    const tipo = actual.gasto.tipo as TipoGasto;
    const nombresParticipantes =
      input.participantes ?? actual.participantes.filter((p) => !p.esUsuario).map((p) => p.nombre);
    const nombreUsuario = actual.participantes.find((p) => p.esUsuario)?.nombre ?? NOMBRE_USUARIO_POR_DEFECTO;

    const plan = planificarGasto({
      tipo,
      fechaCompra: actual.gasto.fechaCompra,
      montoTotalCents,
      descuentoCents,
      tipoDescuento,
      cuotas: cuotasCount,
      // Plain resolverTarjeta (not resolverTarjetaParaCrear): a gasto that
      // already references a since-archived card must keep working.
      tarjeta: resolverTarjeta(tx, tarjetaId),
      participantes: tipo === 'compartido' ? nombresParticipantes : [],
    });

    const participantes = construirParticipantes({
      tipo,
      participantes: nombresParticipantes,
      nombreUsuario,
    });
    const cuotas = construirCuotasRepo(plan, participantes.length);

    return gastosRepo.actualizarCompleto(tx, id, {
      descripcion: input.descripcion,
      fechaCompra: actual.gasto.fechaCompra,
      tipo,
      montoTotalCents,
      descuentoCents,
      tipoDescuento,
      cantidadCuotas: cuotasCount,
      tarjetaId,
      participantes,
      cuotas,
    });
  });

  emitirCambio();
}

export async function puedeEditarMontoYCuotas(id: string): Promise<boolean> {
  return !gastosRepo.tieneAlgunPago(db, id);
}
