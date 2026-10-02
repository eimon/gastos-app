import { describeConSqlite } from '../../test/dbPrueba';
import { db } from '../../data/db/client';
import {
  cuotaParticipantes,
  deudaCuotas,
  deudas,
  gastoCuotas,
  gastoParticipantes,
  gastos,
  pagos,
  tarjetas,
} from '../../data/db/schema';
import type { GastoConDetalle } from '../../data/repositories/gastosRepo';
import * as deudasService from '../deudasService';
import * as gastosService from '../gastosService';
import * as pagosService from '../pagosService';
import * as resumenService from '../resumenService';
import * as tarjetasService from '../tarjetasService';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../test/dbPrueba').expoSqliteFalso());

/** Whole pesos to cents. */
const p = (pesos: number) => pesos * 100;

const gasto = (campos: Partial<Parameters<typeof gastosService.crear>[0]>) =>
  gastosService.crear({
    tipo: 'personal',
    descripcion: 'Gasto',
    fechaCompra: '2026-04-02',
    montoTotalCents: p(1000),
    descuentoCents: 0,
    tipoDescuento: null,
    cuotas: 1,
    tarjetaId: null,
    participantes: [],
    ...campos,
  });

const parteDe = (g: GastoConDetalle, nombre: string, cuota = 0) =>
  g.cuotas[cuota].partes.find((x) => g.participantes.find((y) => y.id === x.participanteId)?.nombre === nombre)!;

const pagarParte = (cuotaParticipanteId: string, montoCents: number) =>
  pagosService.registrar({ objetivo: { tipo: 'participante', cuotaParticipanteId }, montoCents, medioPago: 'efectivo', fecha: '2026-04-20' });

const pagarCuotaDeuda = (deudaCuotaId: string, montoCents: number) =>
  pagosService.registrar({ objetivo: { tipo: 'deuda', deudaCuotaId }, montoCents, medioPago: 'transferencia', fecha: '2026-04-20' });

/**
 * The manual Expo Go scenario, verbatim. Card closes the 25th and is due the 5th, so a
 * purchase up to the 25th of a month falls on the statement due the 5th of the next one.
 */
async function sembrar() {
  const visa = await tarjetasService.crear({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 });
  const master = await tarjetasService.crear({ nombre: 'Mastercard', diaCierre: 25, diaVencimiento: 5 });

  // Visa: personal, 3 cuotas of 30.000 due Apr 5, May 5 and Jun 5 (bought in March).
  await gasto({ fechaCompra: '2026-03-10', montoTotalCents: p(90_000), cuotas: 3, tarjetaId: visa.id });
  // Mastercard (archived later): 2 cuotas of 10.000 due Mar 5 and Apr 5.
  await gasto({ fechaCompra: '2026-02-10', montoTotalCents: p(20_000), cuotas: 2, tarjetaId: master.id });
  await tarjetasService.archivar(master.id);

  // Shared in 1 cuota with Ana and Luis, 30.000 each; Ana paid 10.000 and one anulado pago of 4.000.
  const cena = await gasto({
    tipo: 'compartido',
    fechaCompra: '2026-04-12',
    montoTotalCents: p(90_000),
    participantes: ['Ana', 'Luis'],
  });
  await pagarParte(parteDe(cena, 'Ana').id, p(10_000));
  await pagosService.anular((await pagarParte(parteDe(cena, 'Ana').id, p(4_000))).id);

  // Older month: Ana still owes 10.000 of a March purchase (vencido in April).
  const marzo = await gasto({ tipo: 'compartido', fechaCompra: '2026-03-20', montoTotalCents: p(20_000), participantes: ['Ana'] });

  // Personal cash purchase in April.
  await gasto({ fechaCompra: '2026-04-02', montoTotalCents: p(15_000) });

  // Deleted gasto: shared with Ana, must not appear anywhere.
  const borrado = await gasto({ tipo: 'compartido', fechaCompra: '2026-04-14', montoTotalCents: p(200_000), participantes: ['Ana'] });
  await gastosService.eliminar(borrado.gasto.id);

  // Deuda: 3 cuotas of 30.000 due Mar 15 (vencido in April), Apr 15 and May 15.
  const { cuotas } = await deudasService.crear({
    acreedor: 'Banco X',
    descripcion: 'Préstamo',
    montoTotalCents: p(90_000),
    cuotas: 3,
    fechaPrimerPago: '2026-03-15',
  });
  await pagarCuotaDeuda(cuotas[1].id, p(10_000));
  await pagosService.anular((await pagarCuotaDeuda(cuotas[0].id, p(5_000))).id);

  // Deleted deuda.
  const { deuda } = await deudasService.crear({
    acreedor: 'Borrada',
    descripcion: 'x',
    montoTotalCents: p(1_000),
    cuotas: 1,
    fechaPrimerPago: '2026-04-10',
  });
  await deudasService.eliminar(deuda.id);
  return { cuotas, cena, marzo };
}

describeConSqlite('resumenService against real SQLite (foreign keys ON)', () => {
  beforeEach(() => {
    db.delete(pagos).run();
    db.delete(cuotaParticipantes).run();
    db.delete(gastoCuotas).run();
    db.delete(gastoParticipantes).run();
    db.delete(gastos).run();
    db.delete(deudaCuotas).run();
    db.delete(deudas).run();
    db.delete(tarjetas).run();
  });

  test('April: the four blocks with live pagos, archived card, vencido and purchase-date totals', async () => {
    await sembrar();

    const r = await resumenService.obtener(4, 2026);

    expect(r.tarjetas.filas.map((f) => [f.nombre, f.totalCents])).toEqual([
      ['Mastercard (archivada)', p(10_000)],
      ['Visa', p(30_000)],
    ]);
    expect(r.tarjetas.totalCents).toBe(p(40_000));
    expect(r.meDeben.filas).toEqual([
      { nombre: 'Ana', delMesCents: p(20_000), vencidoCents: p(10_000), totalCents: p(30_000) },
      { nombre: 'Luis', delMesCents: p(30_000), vencidoCents: 0, totalCents: p(30_000) },
    ]);
    expect(r.meDeben.totales).toEqual({ delMesCents: p(50_000), vencidoCents: p(10_000), totalCents: p(60_000) });
    expect(r.debo.filas).toEqual([{ nombre: 'Banco X', delMesCents: p(20_000), vencidoCents: p(30_000), totalCents: p(50_000) }]);
    expect(r.debo.totales.totalCents).toBe(p(50_000));
    expect(r.gastosDelMes).toEqual({ personalCents: p(15_000), compartidoCents: p(30_000), totalCents: p(45_000) });
  });

  test('March: Gastos del mes counts the user share of ALL cuotas by purchase date; nothing is vencido yet', async () => {
    await sembrar();

    const r = await resumenService.obtener(3, 2026);

    // Visa 90.000 (3 cuotas, bought Mar 10) + shared March purchase: the user keeps 10.000 of 20.000.
    expect(r.gastosDelMes).toEqual({ personalCents: p(90_000), compartidoCents: p(10_000), totalCents: p(100_000) });
    expect(r.meDeben.filas.map((f) => [f.nombre, f.delMesCents, f.vencidoCents])).toEqual([['Ana', p(10_000), 0]]);
    expect(r.debo.filas).toEqual([{ nombre: 'Banco X', delMesCents: p(30_000), vencidoCents: 0, totalCents: p(30_000) }]);
    expect(r.tarjetas.filas.map((f) => [f.nombre, f.totalCents])).toEqual([['Mastercard (archivada)', p(10_000)]]);
  });

  test('May: everything unpaid from April is vencido and the empty blocks stay empty', async () => {
    await sembrar();

    const r = await resumenService.obtener(5, 2026);

    expect(r.tarjetas.filas.map((f) => [f.nombre, f.totalCents])).toEqual([['Visa', p(30_000)]]);
    expect(r.meDeben.totales).toEqual({ delMesCents: 0, vencidoCents: p(60_000), totalCents: p(60_000) });
    expect(r.debo.totales).toEqual({ delMesCents: p(30_000), vencidoCents: p(50_000), totalCents: p(80_000) });
    expect(r.gastosDelMes.totalCents).toBe(0);
  });

  test('a payment settles the share, annulling it brings the amount back, and deleting the gasto removes it', async () => {
    const { cena, marzo } = await sembrar();
    const total = async () => (await resumenService.obtener(4, 2026)).meDeben.totales.totalCents;
    expect(await total()).toBe(p(60_000));

    const pago = await pagarParte(parteDe(cena, 'Luis').id, p(30_000));
    expect(await total()).toBe(p(30_000));
    expect((await resumenService.obtener(4, 2026)).meDeben.filas.map((f) => f.nombre)).toEqual(['Ana']);

    await pagosService.anular(pago.id);
    expect(await total()).toBe(p(60_000));

    await gastosService.eliminar(marzo.gasto.id);
    expect(await total()).toBe(p(50_000));
  });

  test('a month without data returns empty blocks', async () => {
    const r = await resumenService.obtener(8, 2030);

    expect(r.tarjetas).toEqual({ filas: [], totalCents: 0 });
    expect(r.meDeben.filas).toEqual([]);
    expect(r.debo.filas).toEqual([]);
    expect(r.gastosDelMes.totalCents).toBe(0);
  });
});
