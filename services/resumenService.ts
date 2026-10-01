import { db } from '../data/db/client';
import * as resumenRepo from '../data/repositories/resumenRepo';
import * as tarjetasRepo from '../data/repositories/tarjetasRepo';
import { rangoDelMes } from './gastoVista';
import { armarResumen, type ResumenMes } from './resumenVista';

/**
 * Resumen of the selected month (`mes` 1-12). Cards are by cuota due date, receivables and
 * debts include what is still unpaid from earlier months (vencido), and "Gastos del mes" is
 * by purchase date. One read transaction keeps the four blocks consistent with each other.
 */
export async function obtener(mes: number, anio: number): Promise<ResumenMes> {
  const { desde, hasta } = rangoDelMes(mes, anio);

  const datos = db.transaction((tx) => ({
    tarjetas: tarjetasRepo.listarTodas(tx),
    cuotasDeTarjeta: resumenRepo.listarCuotasDeTarjetaEntre(tx, desde, hasta),
    partesACobrar: resumenRepo.listarPartesACobrarHasta(tx, hasta),
    cuotasDeDeuda: resumenRepo.listarCuotasDeDeudaHasta(tx, hasta),
    gastosDelUsuario: resumenRepo.listarGastosDelUsuarioPorCompra(tx, desde, hasta),
  }));

  return armarResumen(datos, { mes, año: anio });
}
