import { describeConSqlite } from '../../../test/dbPrueba';
import { db } from '../../db/client';
import { deudaCuotas, deudas, pagos } from '../../db/schema';
import * as deudasRepo from '../deudasRepo';
import * as pagosRepo from '../pagosRepo';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../../test/dbPrueba').expoSqliteFalso());

const crear = (acreedor: string, fechaPrimerPago: string, cuotas: string[], montoCuota = 10_000) =>
  deudasRepo.crear(db, {
    acreedor,
    descripcion: 'desc',
    montoTotalCents: montoCuota * cuotas.length,
    cantidadCuotas: cuotas.length,
    fechaPrimerPago,
    cuotas: cuotas.map((fechaVencimiento, i) => ({ numero: i + 1, montoCents: montoCuota, fechaVencimiento })),
  });

const pagar = (deudaCuotaId: string, montoCents: number) =>
  pagosRepo.registrar(db, { deudaCuotaId, montoCents, medioPago: 'efectivo', fecha: '2026-01-10', notas: null });

describeConSqlite('deudasRepo against real SQLite (foreign keys ON)', () => {
  beforeEach(() => {
    db.delete(pagos).run();
    db.delete(deudaCuotas).run();
    db.delete(deudas).run();
  });

  test('listarCuotasEntre includes both month boundaries and nothing outside them', () => {
    crear('Banco', '2026-01-31', ['2026-01-31', '2026-02-01', '2026-02-28', '2026-03-01']);

    const febrero = deudasRepo.listarCuotasEntre(db, '2026-02-01', '2026-02-28');
    expect(febrero.map((c) => c.fechaVencimiento)).toEqual(['2026-02-01', '2026-02-28']);
    expect(febrero[0]).toMatchObject({ acreedor: 'Banco', numero: 2, cantidadCuotas: 4, pagadoCents: 0 });
  });

  test('the paid sum counts live pagos only and never mixes cuotas', () => {
    const { cuotas } = crear('Banco', '2026-05-10', ['2026-05-10', '2026-05-20']);
    pagar(cuotas[0].id, 3_000);
    pagar(cuotas[0].id, 2_000);
    const anulado = pagar(cuotas[0].id, 4_000);
    pagosRepo.anular(db, anulado.id);
    pagar(cuotas[1].id, 1_000);

    const mes = deudasRepo.listarCuotasEntre(db, '2026-05-01', '2026-05-31');
    expect(mes.map((c) => c.pagadoCents)).toEqual([5_000, 1_000]);
  });

  test('deleted deudas are not listed', () => {
    crear('Activa', '2026-06-01', ['2026-06-01']);
    const borrada = crear('Borrada', '2026-06-01', ['2026-06-01']);
    deudasRepo.eliminar(db, borrada.deuda.id);

    expect(deudasRepo.listarCuotasEntre(db, '2026-06-01', '2026-06-30').map((c) => c.acreedor)).toEqual(['Activa']);
  });

  test('tieneAlgunPago ignores anulado pagos and pagos of other deudas', () => {
    const a = crear('A', '2026-07-01', ['2026-07-01']);
    const b = crear('B', '2026-07-01', ['2026-07-01']);
    expect(deudasRepo.tieneAlgunPago(db, a.deuda.id)).toBe(false);

    const pagoA = pagar(a.cuotas[0].id, 1_000);
    expect(deudasRepo.tieneAlgunPago(db, a.deuda.id)).toBe(true);
    expect(deudasRepo.tieneAlgunPago(db, b.deuda.id)).toBe(false);

    pagosRepo.anular(db, pagoA.id);
    expect(deudasRepo.tieneAlgunPago(db, a.deuda.id)).toBe(false);
  });

  test('actualizarCompleto purges only the anulado pagos of THIS deuda, keeping foreign keys satisfied', () => {
    const a = crear('A', '2026-08-01', ['2026-08-01', '2026-09-01']);
    const b = crear('B', '2026-08-01', ['2026-08-01']);
    const anuladoA = pagar(a.cuotas[0].id, 1_000);
    pagosRepo.anular(db, anuladoA.id);
    const anuladoB = pagar(b.cuotas[0].id, 1_000);
    pagosRepo.anular(db, anuladoB.id);

    const resultado = deudasRepo.actualizarCompleto(db, a.deuda.id, {
      acreedor: 'A2',
      descripcion: 'nueva',
      montoTotalCents: 30_000,
      cantidadCuotas: 3,
      fechaPrimerPago: '2026-08-01',
      cuotas: [1, 2, 3].map((numero) => ({ numero, montoCents: 10_000, fechaVencimiento: `2026-0${7 + numero}-01` })),
    });

    expect(resultado.deuda).toMatchObject({ acreedor: 'A2', cantidadCuotas: 3 });
    expect(resultado.cuotas).toHaveLength(3);
    const ids = db.select().from(pagos).all().map((p) => p.id);
    expect(ids).not.toContain(anuladoA.id);
    expect(ids).toContain(anuladoB.id);
  });

  test('actualizarCompleto never deletes a LIVE pago: the FK blocks replacing the cuotas and nothing changes', () => {
    const a = crear('A', '2026-08-01', ['2026-08-01']);
    const vivo = pagar(a.cuotas[0].id, 1_000);
    const anulado = pagar(a.cuotas[0].id, 2_000);
    pagosRepo.anular(db, anulado.id);

    expect(() =>
      db.transaction((tx) =>
        deudasRepo.actualizarCompleto(tx, a.deuda.id, {
          acreedor: 'A',
          descripcion: 'desc',
          montoTotalCents: 10_000,
          cantidadCuotas: 1,
          fechaPrimerPago: '2026-08-01',
          cuotas: [{ numero: 1, montoCents: 10_000, fechaVencimiento: '2026-08-01' }],
        }),
      ),
    ).toThrow();

    const filas = db.select().from(pagos).all();
    expect(filas.find((p) => p.id === vivo.id)?.deletedAt).toBeNull();
    expect(filas.find((p) => p.id === anulado.id)?.deletedAt).not.toBeNull();
    expect(deudasRepo.obtenerConCuotas(db, a.deuda.id)?.cuotas).toHaveLength(1);
  });

  test('the database itself rejects deleting a cuota that still has a pago (foreign keys are ON)', () => {
    const a = crear('A', '2026-10-01', ['2026-10-01']);
    pagar(a.cuotas[0].id, 1_000);
    expect(() => db.delete(deudaCuotas).run()).toThrow();
  });
});
