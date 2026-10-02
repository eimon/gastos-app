import { describeConSqlite } from '../../test/dbPrueba';
import { db } from '../../data/db/client';
import { cuotaParticipantes, gastoCuotas, gastoParticipantes, gastos, pagos } from '../../data/db/schema';
import * as gastosRepo from '../../data/repositories/gastosRepo';
import * as gastosService from '../gastosService';
import * as pagosService from '../pagosService';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../test/dbPrueba').expoSqliteFalso());

const base = {
  tipo: 'compartido' as const,
  descripcion: 'Cena',
  fechaCompra: '2026-03-10',
  montoTotalCents: 10_000,
  descuentoCents: 0,
  tipoDescuento: null,
  cuotas: 1,
  tarjetaId: null,
  participantes: ['Juan'],
};
const { descripcion: _descripcion, ...nucleoBase } = base;

/** The rules-error codes a call rejects with, or null when it succeeds. */
const codigos = (promesa: Promise<unknown>) =>
  promesa.then(
    () => null,
    (err: { codigos?: string[] }) => err.codigos ?? String(err),
  );

const parteDeJuan = (g: gastosRepo.GastoConDetalle) =>
  g.cuotas[0].partes.find((p) => g.participantes.find((x) => x.id === p.participanteId)?.nombre === 'Juan')!;

const pagar = (cuotaParticipanteId: string, montoCents: number) =>
  pagosService.registrar({ objetivo: { tipo: 'participante', cuotaParticipanteId }, montoCents, medioPago: 'efectivo', fecha: '2026-03-11' });

describeConSqlite('gastosService against real SQLite (foreign keys ON)', () => {
  beforeEach(() => {
    db.delete(pagos).run();
    db.delete(cuotaParticipantes).run();
    db.delete(gastoCuotas).run();
    db.delete(gastoParticipantes).run();
    db.delete(gastos).run();
  });

  test('with a live pago the core edit is blocked and BOTH the live and the anulado pago stay untouched', async () => {
    const creado = await gastosService.crear(base);
    const parte = parteDeJuan(creado);
    const vivo = await pagar(parte.id, 1_000);
    const anulado = await pagar(parte.id, 2_000);
    await pagosService.anular(anulado.id);

    expect(await codigos(gastosService.editar(creado.gasto.id, { descripcion: 'Cena 2', nucleo: { ...nucleoBase, montoTotalCents: 20_000 } }))).toEqual([
      'BLOQUEADO_POR_PAGO',
    ]);

    const filas = db.select().from(pagos).all();
    expect(filas).toHaveLength(2);
    expect(filas.find((p) => p.id === vivo.id)?.deletedAt).toBeNull();
    expect(filas.find((p) => p.id === anulado.id)?.deletedAt).not.toBeNull();
    expect(gastosRepo.obtenerConDetalle(db, creado.gasto.id)?.gasto.montoTotalCents).toBe(10_000);
  });

  test('without live pagos the edit replaces the shares and purges only the anulado pagos of this gasto', async () => {
    const a = await gastosService.crear(base);
    const b = await gastosService.crear({ ...base, descripcion: 'Otro' });
    const anuladoA = await pagar(parteDeJuan(a).id, 1_000);
    await pagosService.anular(anuladoA.id);
    const anuladoB = await pagar(parteDeJuan(b).id, 1_000);
    await pagosService.anular(anuladoB.id);

    await gastosService.editar(a.gasto.id, { descripcion: 'Cena 2', nucleo: { ...nucleoBase, montoTotalCents: 20_000 } });

    expect(gastosRepo.obtenerConDetalle(db, a.gasto.id)?.gasto.montoTotalCents).toBe(20_000);
    const ids = db.select().from(pagos).all().map((p) => p.id);
    expect(ids).not.toContain(anuladoA.id);
    expect(ids).toContain(anuladoB.id);
  });

  test('delete is blocked while a live pago exists and a deleted gasto rejects pagos inside the transaction', async () => {
    const creado = await gastosService.crear(base);
    const parte = parteDeJuan(creado);
    const pago = await pagar(parte.id, 1_000);

    expect(await codigos(gastosService.eliminar(creado.gasto.id))).toEqual(['ELIMINAR_CON_PAGOS']);
    expect(gastosRepo.obtenerConDetalle(db, creado.gasto.id)).toBeDefined();

    await pagosService.anular(pago.id);
    await gastosService.eliminar(creado.gasto.id);
    expect(await codigos(pagar(parte.id, 100))).toEqual(['GASTO_ELIMINADO']);
  });

  test('a pago is rejected above the remaining amount and on the user\'s own share', async () => {
    const creado = await gastosService.crear(base);
    expect(await codigos(pagar(parteDeJuan(creado).id, 5_001))).toEqual(['EXCEDE_RESTANTE']);
    const propia = creado.cuotas[0].partes.find((p) => p.id !== parteDeJuan(creado).id)!;
    expect(await codigos(pagar(propia.id, 100))).toEqual(['ES_USUARIO']);
  });

  test('the month list sorts by due date, then by descripcion in Spanish order (accents and case ignored)', async () => {
    for (const descripcion of ['beta', 'Zeta', 'Ángel', 'álvaro']) {
      await gastosService.crear({ ...base, tipo: 'personal', participantes: [], descripcion, fechaCompra: '2026-06-10' });
    }
    await gastosService.crear({ ...base, tipo: 'personal', participantes: [], descripcion: 'Antes', fechaCompra: '2026-06-20' });
    await gastosService.crear({ ...base, tipo: 'personal', participantes: [], descripcion: 'Zzz', fechaCompra: '2026-06-05' });

    expect((await gastosService.listarDelMes(6, 2026)).map((c) => c.descripcion)).toEqual(['Zzz', 'álvaro', 'Ángel', 'beta', 'Zeta', 'Antes']);
  });
});
