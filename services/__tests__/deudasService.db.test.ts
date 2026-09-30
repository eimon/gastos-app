import { describeConSqlite } from '../../test/dbPrueba';
import { db } from '../../data/db/client';
import { deudaCuotas, deudas, pagos } from '../../data/db/schema';
import * as deudasRepo from '../../data/repositories/deudasRepo';
import * as deudasService from '../deudasService';
import * as pagosService from '../pagosService';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../test/dbPrueba').expoSqliteFalso());

const base = { acreedor: 'Banco', descripcion: 'Préstamo', montoTotalCents: 100_000, cuotas: 3, fechaPrimerPago: '2026-01-31' };
const nucleo = (cambios = {}) => ({ montoTotalCents: 100_000, cuotas: 3, fechaPrimerPago: '2026-01-31', ...cambios });

/** The rules-error codes a call rejects with, or null when it succeeds. */
const codigos = (promesa: Promise<unknown>) =>
  promesa.then(
    () => null,
    (err: { codigos?: string[] }) => err.codigos ?? String(err),
  );

const pagar = (deudaCuotaId: string, montoCents: number) =>
  pagosService.registrar({ objetivo: { tipo: 'deuda', deudaCuotaId }, montoCents, medioPago: 'efectivo', fecha: '2026-01-10' });

describeConSqlite('deudasService against real SQLite (foreign keys ON)', () => {
  beforeEach(() => {
    db.delete(pagos).run();
    db.delete(deudaCuotas).run();
    db.delete(deudas).run();
  });

  test('crear stores the planned cuotas and listarDelMes derives each status from live pagos', async () => {
    const { cuotas } = await deudasService.crear(base);
    expect(cuotas.map((c) => [c.montoCents, c.fechaVencimiento])).toEqual([
      [33_333, '2026-01-31'],
      [33_333, '2026-02-28'],
      [33_334, '2026-03-31'],
    ]);

    const pago = await pagar(cuotas[0].id, 10_000);
    expect((await deudasService.listarDelMes(1, 2026))[0].resumen).toMatchObject({ pagado: 10_000, estado: 'parcial' });
    await pagosService.anular(pago.id);
    expect((await deudasService.listarDelMes(1, 2026))[0].resumen).toMatchObject({ pagado: 0, estado: 'pendiente' });
  });

  test('a pago is rejected above the remaining amount and once the cuota is settled', async () => {
    const { cuotas } = await deudasService.crear(base);
    expect(await codigos(pagar(cuotas[0].id, cuotas[0].montoCents + 1))).toEqual(['EXCEDE_RESTANTE']);
    await pagar(cuotas[0].id, cuotas[0].montoCents);
    expect(await codigos(pagar(cuotas[0].id, 1))).toEqual(['YA_PAGADO']);
  });

  test('editing the core replaces the cuotas (anulado pagos purged) and keeps the dates when only the amount changes', async () => {
    const { deuda, cuotas } = await deudasService.crear(base);
    const pago = await pagar(cuotas[0].id, 1_000);
    await pagosService.anular(pago.id);

    await deudasService.editar(deuda.id, { acreedor: 'Banco 2', descripcion: 'Otro', nucleo: nucleo({ montoTotalCents: 60_000 }) });

    const despues = deudasRepo.obtenerConCuotas(db, deuda.id)!;
    expect(despues.cuotas.map((c) => [c.montoCents, c.fechaVencimiento])).toEqual([
      [20_000, '2026-01-31'],
      [20_000, '2026-02-28'],
      [20_000, '2026-03-31'],
    ]);
    expect(db.select().from(pagos).all()).toHaveLength(0);
  });

  test('validates the texts before any branch, even with an unchanged core', async () => {
    const { deuda } = await deudasService.crear(base);
    expect(await codigos(deudasService.editar(deuda.id, { acreedor: 'X', descripcion: '  ' }))).toEqual(['DESCRIPCION_REQUERIDA']);
    expect(await codigos(deudasService.editar(deuda.id, { acreedor: ' ', descripcion: 'd', nucleo: nucleo() }))).toEqual([
      'ACREEDOR_REQUERIDO',
    ]);
    expect(deudasRepo.obtenerConCuotas(db, deuda.id)!.deuda.descripcion).toBe('Préstamo');
  });

  test('with a live pago only the texts can change, and delete is blocked until it is anulado', async () => {
    const { deuda, cuotas } = await deudasService.crear(base);
    const pago = await pagar(cuotas[0].id, 500);

    expect(await codigos(deudasService.editar(deuda.id, { acreedor: 'B', descripcion: 'd', nucleo: nucleo({ montoTotalCents: 90_000 }) }))).toEqual([
      'BLOQUEADO_POR_PAGO',
    ]);
    await deudasService.editar(deuda.id, { acreedor: 'B', descripcion: 'd' });
    await deudasService.editar(deuda.id, { acreedor: 'C', descripcion: 'd', nucleo: nucleo() });
    expect(deudasRepo.obtenerConCuotas(db, deuda.id)!.deuda.acreedor).toBe('C');
    expect((await deudasService.obtenerParaEdicion(deuda.id))?.tienePagos).toBe(true);

    expect(await codigos(deudasService.eliminar(deuda.id))).toEqual(['ELIMINAR_CON_PAGOS']);
    expect(await deudasService.obtenerDetalle(deuda.id)).toBeDefined();

    await pagosService.anular(pago.id);
    await deudasService.eliminar(deuda.id);
    expect(await deudasService.obtenerDetalle(deuda.id)).toBeUndefined();
  });

  test('a deleted deuda rejects pagos inside the transaction and is not found for edit or delete', async () => {
    const { deuda, cuotas } = await deudasService.crear(base);
    await deudasService.eliminar(deuda.id);

    expect(await codigos(pagar(cuotas[0].id, 100))).toEqual(['DEUDA_ELIMINADA']);
    expect(await codigos(deudasService.eliminar(deuda.id))).toEqual(['DEUDA_NO_ENCONTRADA']);
    expect(await codigos(deudasService.editar(deuda.id, { acreedor: 'a', descripcion: 'b' }))).toEqual(['DEUDA_NO_ENCONTRADA']);
    expect(await deudasService.listarDelMes(1, 2026)).toEqual([]);
  });

  test('crear rejects an invalid deuda with coded errors and stores nothing', async () => {
    expect(await codigos(deudasService.crear({ ...base, descripcion: ' ', cuotas: 0 }))).toEqual(['CUOTAS_INVALIDA', 'DESCRIPCION_REQUERIDA']);
    expect(db.select().from(deudas).all()).toHaveLength(0);
  });
});
