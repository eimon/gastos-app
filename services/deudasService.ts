import type { InputDeuda } from '../domain/deuda';
import { planificarDeuda } from '../domain/deuda';
import { db } from '../data/db/client';
import * as deudasRepo from '../data/repositories/deudasRepo';
import * as pagosRepo from '../data/repositories/pagosRepo';
import { emitirCambio } from './cambios';
import {
  DeudaRechazadaError,
  construirEdicionDeuda,
  exigirDeudaValida,
  exigirSinPagos,
  exigirTextos,
  nucleoDeudaSinCambios,
  type NucleoDeuda,
} from './deudaEdicion';
import { valoresDesdeDeuda, type ValoresDeudaForm } from './deudaFormulario';
import { armarDetalleDeuda, armarFilasDeudaMes, type DetalleDeuda, type FilaDeudaMes } from './deudaVista';
import { rangoDelMes, type PagoDetalle } from './gastoVista';
import { ordenarPorVencimientoYNombre } from './orden';

export type InputCrearDeuda = InputDeuda;

/** Validates through the domain gate (coded `DeudaRechazadaError`), then persists deuda + cuotas in one tx. */
export async function crear(input: InputCrearDeuda): Promise<deudasRepo.DeudaConCuotas> {
  exigirDeudaValida(input);
  const plan = planificarDeuda(input);

  const resultado = db.transaction((tx) =>
    deudasRepo.crear(tx, {
      acreedor: input.acreedor.trim(),
      descripcion: input.descripcion.trim(),
      montoTotalCents: input.montoTotalCents,
      cantidadCuotas: input.cuotas,
      fechaPrimerPago: input.fechaPrimerPago,
      cuotas: plan.cuotas,
    }),
  );

  emitirCambio();
  return resultado;
}

/** Cuotas due in the given month (`mes` 1-12). */
export async function listarDelMes(mes: number, anio: number): Promise<FilaDeudaMes[]> {
  const { desde, hasta } = rangoDelMes(mes, anio);
  const cuotas = deudasRepo.listarCuotasEntre(db, desde, hasta);
  return armarFilasDeudaMes(ordenarPorVencimientoYNombre(cuotas, (cuota) => cuota.acreedor));
}

export async function obtenerDetalle(id: string): Promise<DetalleDeuda | undefined> {
  const detalle = deudasRepo.obtenerConCuotas(db, id);
  if (!detalle) {
    return undefined;
  }

  const pagosPorCuota: Record<string, PagoDetalle[]> = {};
  for (const pago of pagosRepo.listarPorDeudaCuotas(db, detalle.cuotas.map((cuota) => cuota.id))) {
    (pagosPorCuota[pago.deudaCuotaId!] ??= []).push(pago);
  }

  return armarDetalleDeuda(detalle, pagosPorCuota);
}

export interface InputEditarDeuda {
  acreedor: string;
  descripcion: string;
  nucleo?: NucleoDeuda;
}

/**
 * Acreedor and descripcion are always editable; amount, cuotas and first payment date are
 * rejected once a live pago exists. Check, read and write share ONE transaction.
 */
export async function editar(id: string, input: InputEditarDeuda): Promise<void> {
  // Validated once, before any branch writes, so no path can store a blank text.
  const textos = exigirTextos(input);
  const { nucleo } = input;
  if (!nucleo) {
    if (!deudasRepo.actualizarTextos(db, id, textos.acreedor, textos.descripcion)) {
      throw new DeudaRechazadaError(['DEUDA_NO_ENCONTRADA']);
    }
    emitirCambio();
    return;
  }

  db.transaction((tx) => {
    const actual = deudasRepo.obtenerConCuotas(tx, id);
    if (!actual) {
      throw new DeudaRechazadaError(['DEUDA_NO_ENCONTRADA']);
    }

    if (nucleoDeudaSinCambios(actual, nucleo)) {
      deudasRepo.actualizarTextos(tx, id, textos.acreedor, textos.descripcion);
      return;
    }

    exigirSinPagos(deudasRepo.tieneAlgunPago(tx, id), 'BLOQUEADO_POR_PAGO');
    const completo: InputDeuda = { ...textos, ...nucleo };
    exigirDeudaValida(completo);
    deudasRepo.actualizarCompleto(tx, id, construirEdicionDeuda(actual, completo));
  });

  emitirCambio();
}

/** Soft delete, blocked while any live pago exists (anular them first); check and delete share one tx. */
export async function eliminar(id: string): Promise<void> {
  db.transaction((tx) => {
    exigirSinPagos(deudasRepo.tieneAlgunPago(tx, id), 'ELIMINAR_CON_PAGOS');
    if (!deudasRepo.eliminar(tx, id)) {
      throw new DeudaRechazadaError(['DEUDA_NO_ENCONTRADA']);
    }
  });
  emitirCambio();
}

export interface DatosEdicionDeuda {
  valores: ValoresDeudaForm;
  tienePagos: boolean;
}

export async function obtenerParaEdicion(id: string): Promise<DatosEdicionDeuda | undefined> {
  const actual = deudasRepo.obtenerConCuotas(db, id);
  return actual && { valores: valoresDesdeDeuda(actual.deuda), tienePagos: deudasRepo.tieneAlgunPago(db, id) };
}
