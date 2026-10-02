/**
 * Pure rules for editing an existing gasto (no `data/db/client` import, so
 * they run under Jest). The service resolves the card and runs the pago
 * check and the write in one transaction; this module only decides WHAT to
 * write, delegating all money and date math to `domain/`.
 */
import type { TipoDescuento } from '../domain/cuotas';
import { planificarGasto, type PlanGasto, type TarjetaGasto, type TipoGasto } from '../domain/gasto';
import { repartirEntreParticipantes } from '../domain/participantes';
import type { GastoConDetalle, InputCrearGasto as InputRepo } from '../data/repositories/gastosRepo';
import type { InputCrearGasto } from './gastosService';
import type { FilaParticipante, ModoReparto, ValoresGastoForm } from './gastoFormulario';
import { construirCuotasRepo, construirParticipantes } from './gastoPlanMapper';

export type CodigoErrorGasto =
  | 'BLOQUEADO_POR_PAGO'
  | 'GASTO_NO_ENCONTRADO'
  | 'ELIMINAR_CON_PAGOS'
  | 'DESCRIPCION_REQUERIDA';

export const MENSAJES_ERROR_GASTO_GUARDADO: Record<CodigoErrorGasto, string> = {
  BLOQUEADO_POR_PAGO: 'Con pagos registrados solo se puede editar la descripción. Primero hay que anular los pagos.',
  GASTO_NO_ENCONTRADO: 'No se encontró el gasto.',
  DESCRIPCION_REQUERIDA: 'La descripción es obligatoria.',
  ELIMINAR_CON_PAGOS: 'No se puede eliminar un gasto con pagos registrados. Primero hay que anular los pagos.',
};

export class GastoRechazadoError extends Error {
  /** Same shape as payment rejections, so screens can recognize both through `esErrorDeReglas`. */
  public readonly codigos: CodigoErrorGasto[];

  constructor(public readonly codigo: CodigoErrorGasto) {
    super(MENSAJES_ERROR_GASTO_GUARDADO[codigo]);
    this.codigos = [codigo];
  }
}

/** Every edit needs a non-blank description, whichever branch ends up writing it. Returns it trimmed. */
export function exigirDescripcion(descripcion: string): string {
  const limpia = descripcion.trim();
  if (limpia === '') {
    throw new GastoRechazadoError('DESCRIPCION_REQUERIDA');
  }
  return limpia;
}

/** Gate shared by the core-field edit and the delete: any live pago blocks both. */
export function exigirSinPagos(tienePagos: boolean, codigo: 'BLOQUEADO_POR_PAGO' | 'ELIMINAR_CON_PAGOS'): void {
  if (tienePagos) {
    throw new GastoRechazadoError(codigo);
  }
}

/** Core fields of an edit: same shape as a new gasto, minus the description (edited on its own). */
export type NucleoGasto = Omit<InputCrearGasto, 'descripcion' | 'nombreUsuario'>;

export interface OrigenVencimientos {
  fechaCompra: string;
  cuotas: number;
  tarjetaId: string | null;
}

/**
 * Stored due dates only move when the purchase date, the cuota count or the
 * card changes. Anything else (amount, discount, participants, or the card's
 * own closing/due days having been edited since) keeps the dates on file.
 */
export function conservarVencimientos(plan: PlanGasto, actual: GastoConDetalle, nuevo: OrigenVencimientos): PlanGasto {
  const { gasto } = actual;
  const mismoOrigen =
    gasto.fechaCompra === nuevo.fechaCompra &&
    gasto.cantidadCuotas === nuevo.cuotas &&
    gasto.tarjetaId === nuevo.tarjetaId;
  if (!mismoOrigen) {
    return plan;
  }

  const guardadas = new Map(actual.cuotas.map((cuota) => [cuota.numero, cuota]));
  return {
    cuotas: plan.cuotas.map((cuota) => {
      const guardada = guardadas.get(cuota.numero);
      return guardada
        ? { ...cuota, fechaCierre: guardada.fechaCierre, fechaVencimiento: guardada.fechaVencimiento }
        : cuota;
    }),
  };
}

/**
 * Builds the full replacement for a gasto. Throws (domain gate) on any rule
 * violation, including a discount with a single cuota and invalid custom amounts.
 */
export function construirEdicion(
  actual: GastoConDetalle,
  descripcion: string,
  nucleo: NucleoGasto,
  tarjeta: TarjetaGasto | null,
): InputRepo {
  const plan = conservarVencimientos(
    planificarGasto({
      descripcion,
      tipo: nucleo.tipo,
      fechaCompra: nucleo.fechaCompra,
      montoTotalCents: nucleo.montoTotalCents,
      descuentoCents: nucleo.descuentoCents,
      tipoDescuento: nucleo.tipoDescuento,
      cuotas: nucleo.cuotas,
      tarjeta,
      participantes: nucleo.tipo === 'compartido' ? nucleo.participantes : [],
      montosPersonalizadosCents: nucleo.montosPersonalizadosCents,
    }),
    actual,
    nucleo,
  );

  const participantes = construirParticipantes({
    tipo: nucleo.tipo,
    participantes: nucleo.participantes,
    nombreUsuario: actual.participantes.find((p) => p.esUsuario)?.nombre,
  });

  return {
    descripcion: descripcion.trim(),
    fechaCompra: nucleo.fechaCompra,
    tipo: nucleo.tipo,
    montoTotalCents: nucleo.montoTotalCents,
    descuentoCents: nucleo.descuentoCents,
    tipoDescuento: nucleo.tipoDescuento,
    cantidadCuotas: nucleo.cuotas,
    tarjetaId: nucleo.tarjetaId,
    participantes,
    cuotas: construirCuotasRepo(plan, participantes.length, nucleo.montosPersonalizadosCents),
  };
}

/**
 * True when `nucleo` describes exactly what is already stored (date, amounts,
 * discount, cuotas, card, participants and every share). Such an edit changes
 * nothing structural, so only the description is written and no cuota or
 * pago row is rebuilt.
 */
export function nucleoSinCambios(actual: GastoConDetalle, nucleo: NucleoGasto): boolean {
  const { gasto, participantes } = actual;
  const otros = participantes.filter((p) => !p.esUsuario).map((p) => p.nombre);
  const esperados = nucleo.tipo === 'compartido' ? nucleo.participantes : [];

  const mismoNucleo =
    gasto.tipo === nucleo.tipo &&
    gasto.fechaCompra === nucleo.fechaCompra &&
    gasto.montoTotalCents === nucleo.montoTotalCents &&
    gasto.descuentoCents === nucleo.descuentoCents &&
    (gasto.tipoDescuento ?? null) === nucleo.tipoDescuento &&
    gasto.cantidadCuotas === nucleo.cuotas &&
    gasto.tarjetaId === nucleo.tarjetaId &&
    otros.length === esperados.length &&
    otros.every((nombre, i) => nombre === esperados[i]);
  if (!mismoNucleo || actual.cuotas.length !== nucleo.cuotas) {
    return false;
  }

  const posicion = new Map(participantes.map((p, i) => [p.id, i]));
  return actual.cuotas.every((cuota) => {
    const guardadas = [...cuota.partes]
      .sort((a, b) => (posicion.get(a.participanteId) ?? 0) - (posicion.get(b.participanteId) ?? 0))
      .map((parte) => parte.montoCents);
    const previstas = nucleo.montosPersonalizadosCents ?? repartirEntreParticipantes(cuota.montoCents, participantes.length);
    return guardadas.length === previstas.length && guardadas.every((monto, i) => monto === previstas[i]);
  });
}

/** Form values for a stored gasto. Custom mode is inferred from shares that differ from the equal split. */
export function valoresDesdeDetalle(detalle: GastoConDetalle): ValoresGastoForm {
  const { gasto, participantes } = detalle;
  const usuario = participantes.find((p) => p.esUsuario);
  const otros = participantes.filter((p) => !p.esUsuario);
  const cuotaUnica = gasto.cantidadCuotas === 1 ? detalle.cuotas[0] : undefined;

  const montoDe = (participanteId: string): number =>
    cuotaUnica?.partes.find((parte) => parte.participanteId === participanteId)?.montoCents ?? 0;

  let personalizado = false;
  if (gasto.tipo === 'compartido' && cuotaUnica) {
    const iguales = repartirEntreParticipantes(cuotaUnica.montoCents, participantes.length);
    personalizado = participantes.some((p, i) => montoDe(p.id) !== iguales[i]);
  }

  const filas: FilaParticipante[] = otros.map((p, i) => ({
    id: `participante-${i + 1}`,
    nombre: p.nombre,
    monto: personalizado ? montoDe(p.id) / 100 : null,
  }));
  const modoReparto: ModoReparto = personalizado ? 'personalizado' : 'iguales';

  return {
    descripcion: gasto.descripcion,
    fechaCompra: gasto.fechaCompra,
    // A legacy 1-cuota gasto may carry a discount, which is no longer allowed: load
    // the net price as the amount so the total paid stays the same and saving normalizes it.
    monto: (gasto.cantidadCuotas === 1 ? gasto.montoTotalCents - gasto.descuentoCents : gasto.montoTotalCents) / 100,
    descuento: gasto.cantidadCuotas > 1 && gasto.descuentoCents > 0 ? gasto.descuentoCents / 100 : null,
    tipo: gasto.tipo as TipoGasto,
    tipoDescuento: (gasto.tipoDescuento as TipoDescuento | null) ?? 'uniforme',
    cuotas: String(gasto.cantidadCuotas),
    tarjetaId: gasto.tarjetaId,
    participantes: filas,
    modoReparto,
    montoUsuario: personalizado && usuario ? montoDe(usuario.id) / 100 : null,
  };
}
