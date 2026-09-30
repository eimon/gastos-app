import type { Centavos } from '../domain/dinero';
import type { TipoDescuento } from '../domain/cuotas';
import { planificarGasto, type InputGasto, type TipoGasto } from '../domain/gasto';
import type { FechaISO } from '../domain/vencimientos';
import { db, type Executor } from '../data/db/client';
import * as gastosRepo from '../data/repositories/gastosRepo';
import * as pagosRepo from '../data/repositories/pagosRepo';
import * as tarjetasRepo from '../data/repositories/tarjetasRepo';
import { emitirCambio } from './cambios';
import { armarDetalleGasto, rangoDelMes, type DetalleGasto, type PagoDetalle } from './gastoVista';
import { construirCuotasRepo, construirParticipantes } from './gastoPlanMapper';
import {
  GastoRechazadoError,
  construirEdicion,
  exigirDescripcion,
  exigirSinPagos,
  nucleoSinCambios,
  valoresDesdeDetalle,
  type NucleoGasto,
} from './gastoEdicion';
import type { ValoresGastoForm } from './gastoFormulario';

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

  const pagosPorParte: Record<string, PagoDetalle[]> = {};
  for (const cuota of detalle.cuotas) {
    for (const parte of cuota.partes) {
      pagosPorParte[parte.id] = pagosRepo.listarPorCuotaParticipante(db, parte.id);
    }
  }
  const tarjeta = detalle.gasto.tarjetaId ? tarjetasRepo.obtener(db, detalle.gasto.tarjetaId) : undefined;

  return armarDetalleGasto(detalle, pagosPorParte, tarjeta?.nombre ?? null);
}

export interface InputEditarGasto {
  descripcion: string;
  /** Omitted: description-only edit, the only edit allowed once any pago exists. */
  nucleo?: NucleoGasto;
}

/**
 * The description is always editable. Any other field (amount, discount,
 * cuotas, date, card, participants, custom amounts) is rejected once a live
 * pago exists on this gasto's shares (spec: Shared Gasto Immutability After
 * Repayments). That gate guarantees that replacing cuotas and participantes
 * can never orphan a pago.
 */
export async function editar(id: string, input: InputEditarGasto): Promise<void> {
  // Validated once, before any branch writes, so no path can store a blank description.
  const descripcion = exigirDescripcion(input.descripcion);
  const { nucleo } = input;
  if (!nucleo) {
    if (!gastosRepo.actualizarDescripcion(db, id, descripcion)) {
      throw new GastoRechazadoError('GASTO_NO_ENCONTRADO');
    }
    emitirCambio();
    return;
  }

  // The pago check, the current-state read and the write all run INSIDE this
  // one transaction (matching pagosService.registrar's pattern), so a pago
  // landing between the check and the write is impossible.
  db.transaction((tx) => {
    const actual = gastosRepo.obtenerConDetalle(tx, id);
    if (!actual) {
      throw new GastoRechazadoError('GASTO_NO_ENCONTRADO');
    }

    // Nothing structural changed: write the description only, so no cuota is
    // rebuilt (and no cancelled pago is purged) by a no-op save.
    if (nucleoSinCambios(actual, nucleo)) {
      gastosRepo.actualizarDescripcion(tx, id, descripcion);
      return;
    }

    exigirSinPagos(gastosRepo.tieneAlgunPago(tx, id), 'BLOQUEADO_POR_PAGO');

    // An archived card is only acceptable when this gasto already uses it.
    const tarjeta =
      nucleo.tarjetaId === actual.gasto.tarjetaId
        ? resolverTarjeta(tx, nucleo.tarjetaId)
        : resolverTarjetaParaCrear(tx, nucleo.tarjetaId);

    return gastosRepo.actualizarCompleto(tx, id, construirEdicion(actual, descripcion, nucleo, tarjeta));
  });

  emitirCambio();
}

/**
 * Soft-deletes the gasto. Blocked while any live pago exists: the user must
 * cancel ("anular") every payment first. The check and the delete share one tx.
 */
export async function eliminar(id: string): Promise<void> {
  db.transaction((tx) => {
    exigirSinPagos(gastosRepo.tieneAlgunPago(tx, id), 'ELIMINAR_CON_PAGOS');
    gastosRepo.eliminar(tx, id);
  });
  emitirCambio();
}

export interface DatosEdicion {
  valores: ValoresGastoForm;
  /** Stored gasto, used to preview the dates that editing will keep. */
  original: gastosRepo.GastoConDetalle;
  /** With any pago only the description can change. */
  tienePagos: boolean;
  /** The card already linked to the gasto, even when archived. */
  tarjetaVinculada: tarjetasRepo.Tarjeta | undefined;
}

export async function obtenerParaEdicion(id: string): Promise<DatosEdicion | undefined> {
  const original = gastosRepo.obtenerConDetalle(db, id);
  if (!original) {
    return undefined;
  }

  return {
    valores: valoresDesdeDetalle(original),
    original,
    tienePagos: gastosRepo.tieneAlgunPago(db, id),
    tarjetaVinculada: original.gasto.tarjetaId ? tarjetasRepo.obtener(db, original.gasto.tarjetaId) : undefined,
  };
}
