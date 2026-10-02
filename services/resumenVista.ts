/**
 * Builds the ready-to-render Resumen view model (DB-free, runs under Jest). The month rules
 * (del mes / vencido, grouping, live-pago remaining) are in `domain/resumen.ts`; this only
 * assembles the four blocks, names the cards and totals each block.
 */
import {
  cobrosPorPersona,
  deudasPorAcreedor,
  totalesGastosUsuario,
  totalesPorTarjeta,
  type LineaSaldo,
  type Mes,
} from '../domain/resumen';
import type {
  CuotaDeDeuda,
  CuotaDeTarjeta,
  GastoDelUsuario,
  ParteACobrar,
  SaldoPendiente,
} from '../data/repositories/resumenRepo';
import type { Tarjeta } from '../data/repositories/tarjetasRepo';
import { compararNombres } from './orden';

export interface FilaTarjetaResumen {
  tarjetaId: string;
  /** Card name, followed by "(archivada)" when the card is archived. */
  nombre: string;
  totalCents: number;
}

export interface FilaSaldoResumen extends LineaSaldo {
  nombre: string;
}

export interface BloqueSaldos {
  filas: FilaSaldoResumen[];
  totales: LineaSaldo;
}

export interface ResumenMes {
  tarjetas: { filas: FilaTarjetaResumen[]; totalCents: number };
  meDeben: BloqueSaldos;
  debo: BloqueSaldos;
  gastosDelMes: { personalCents: number; compartidoCents: number; totalCents: number };
}

export interface DatosResumen {
  tarjetas: Tarjeta[];
  cuotasDeTarjeta: CuotaDeTarjeta[];
  partesACobrar: ParteACobrar[];
  cuotasDeDeuda: CuotaDeDeuda[];
  gastosDelUsuario: GastoDelUsuario[];
}

const sumar = (valores: number[]): number => valores.reduce((total, valor) => total + valor, 0);

/** The domain takes the paid amounts as a list; the repo already summed the live pagos. */
const comoPendiente = ({ montoCents, pagadoCents, fechaVencimiento }: SaldoPendiente) => ({
  montoCents,
  pagos: [pagadoCents],
  fechaVencimiento,
});

function armarBloqueSaldos(lineas: FilaSaldoResumen[]): BloqueSaldos {
  const filas = [...lineas].sort((a, b) => compararNombres(a.nombre, b.nombre));
  const delMesCents = sumar(filas.map((fila) => fila.delMesCents));
  const vencidoCents = sumar(filas.map((fila) => fila.vencidoCents));
  return { filas, totales: { delMesCents, vencidoCents, totalCents: delMesCents + vencidoCents } };
}

export function armarResumen(datos: DatosResumen, m: Mes): ResumenMes {
  const tarjetasPorId = new Map(datos.tarjetas.map((tarjeta) => [tarjeta.id, tarjeta]));
  const filasTarjeta = totalesPorTarjeta(datos.cuotasDeTarjeta, m)
    .map(({ tarjetaId, totalCents }) => {
      const tarjeta = tarjetasPorId.get(tarjetaId);
      const nombre = tarjeta?.nombre ?? 'Tarjeta';
      return { tarjetaId, nombre: tarjeta?.deletedAt ? `${nombre} (archivada)` : nombre, totalCents };
    })
    .sort((a, b) => compararNombres(a.nombre, b.nombre));

  const meDeben = cobrosPorPersona(
    datos.partesACobrar.map((parte) => ({ ...comoPendiente(parte), nombre: parte.nombre })),
    m,
  );
  const debo = deudasPorAcreedor(
    datos.cuotasDeDeuda.map((cuota) => ({ ...comoPendiente(cuota), acreedor: cuota.acreedor })),
    m,
  );
  const { personalCents, compartidoCents } = totalesGastosUsuario(datos.gastosDelUsuario);

  return {
    tarjetas: { filas: filasTarjeta, totalCents: sumar(filasTarjeta.map((fila) => fila.totalCents)) },
    meDeben: armarBloqueSaldos(meDeben),
    debo: armarBloqueSaldos(debo.map(({ acreedor, ...linea }) => ({ nombre: acreedor, ...linea }))),
    gastosDelMes: { personalCents, compartidoCents, totalCents: personalCents + compartidoCents },
  };
}
