import { db } from '../data/db/client';
import * as tarjetasRepo from '../data/repositories/tarjetasRepo';
import { emitirCambio } from './cambios';

export async function listar(): Promise<tarjetasRepo.Tarjeta[]> {
  return tarjetasRepo.listarActivas(db);
}

/** Resumen's card totals include archived cards (design decision). */
export async function listarTodas(): Promise<tarjetasRepo.Tarjeta[]> {
  return tarjetasRepo.listarTodas(db);
}

export async function obtener(id: string): Promise<tarjetasRepo.Tarjeta | undefined> {
  return tarjetasRepo.obtener(db, id);
}

export async function crear(input: tarjetasRepo.InputTarjeta): Promise<tarjetasRepo.Tarjeta> {
  const tarjeta = tarjetasRepo.crear(db, input);
  emitirCambio();
  return tarjeta;
}

export async function actualizar(id: string, input: tarjetasRepo.InputTarjeta): Promise<void> {
  tarjetasRepo.actualizar(db, id, input);
  emitirCambio();
}

/** Archiving replaces deletion — existing gastos keep their tarjetaId and computed due dates unchanged. */
export async function archivar(id: string): Promise<void> {
  tarjetasRepo.archivar(db, id);
  emitirCambio();
}
