import { describeConSqlite } from '../../../test/dbPrueba';
import { db } from '../../db/client';
import { cuotaParticipantes, gastoCuotas, gastoParticipantes, gastos, pagos } from '../../db/schema';
import * as gastosRepo from '../gastosRepo';
import * as pagosRepo from '../pagosRepo';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../../test/dbPrueba').expoSqliteFalso());

const entrada = (descripcion: string): gastosRepo.InputCrearGasto => ({
  descripcion,
  fechaCompra: '2026-03-01',
  tipo: 'compartido',
  montoTotalCents: 10_000,
  descuentoCents: 0,
  tipoDescuento: null,
  cantidadCuotas: 1,
  tarjetaId: null,
  participantes: [
    { nombre: 'Juan', esUsuario: false },
    { nombre: 'Yo', esUsuario: true },
  ],
  cuotas: [{ numero: 1, montoCents: 10_000, fechaCierre: null, fechaVencimiento: '2026-03-01', partes: [5_000, 5_000] }],
});

const pagar = (cuotaParticipanteId: string, montoCents: number) =>
  pagosRepo.registrar(db, { cuotaParticipanteId, montoCents, medioPago: 'efectivo', fecha: '2026-03-02', notas: null });

/** The share of the non-user participant (Juan) in the first cuota. */
const parteDeJuan = (g: gastosRepo.GastoConDetalle) => g.cuotas[0].partes.find((p) => g.participantes.find((x) => x.id === p.participanteId)?.nombre === 'Juan')!;

describeConSqlite('gastosRepo against real SQLite (foreign keys ON)', () => {
  beforeEach(() => {
    db.delete(pagos).run();
    db.delete(cuotaParticipantes).run();
    db.delete(gastoCuotas).run();
    db.delete(gastoParticipantes).run();
    db.delete(gastos).run();
  });

  test('actualizarCompleto purges only the anulado pagos of THIS gasto when replacing its shares', () => {
    const a = gastosRepo.crear(db, entrada('A'));
    const b = gastosRepo.crear(db, entrada('B'));
    const anuladoA = pagar(parteDeJuan(a).id, 1_000);
    pagosRepo.anular(db, anuladoA.id);
    const anuladoB = pagar(parteDeJuan(b).id, 1_000);
    pagosRepo.anular(db, anuladoB.id);

    gastosRepo.actualizarCompleto(db, a.gasto.id, entrada('A2'));

    const ids = db.select().from(pagos).all().map((p) => p.id);
    expect(ids).not.toContain(anuladoA.id);
    expect(ids).toContain(anuladoB.id);
  });

  test('actualizarCompleto never deletes a LIVE pago: the FK blocks replacing the shares and nothing changes', () => {
    const a = gastosRepo.crear(db, entrada('A'));
    const vivo = pagar(parteDeJuan(a).id, 1_000);
    const anulado = pagar(parteDeJuan(a).id, 2_000);
    pagosRepo.anular(db, anulado.id);

    expect(() => db.transaction((tx) => gastosRepo.actualizarCompleto(tx, a.gasto.id, entrada('A2')))).toThrow();

    const filas = db.select().from(pagos).all();
    expect(filas.find((p) => p.id === vivo.id)?.deletedAt).toBeNull();
    expect(filas.find((p) => p.id === anulado.id)?.deletedAt).not.toBeNull();
    expect(gastosRepo.obtenerConDetalle(db, a.gasto.id)?.gasto.descripcion).toBe('A');
  });

  test('tieneAlgunPago ignores anulado pagos and pagos of other gastos', () => {
    const a = gastosRepo.crear(db, entrada('A'));
    const b = gastosRepo.crear(db, entrada('B'));
    const pago = pagar(parteDeJuan(a).id, 1_000);
    expect(gastosRepo.tieneAlgunPago(db, a.gasto.id)).toBe(true);
    expect(gastosRepo.tieneAlgunPago(db, b.gasto.id)).toBe(false);
    pagosRepo.anular(db, pago.id);
    expect(gastosRepo.tieneAlgunPago(db, a.gasto.id)).toBe(false);
  });

  test('deleted gastos are not listed for the month', () => {
    gastosRepo.crear(db, entrada('Activo'));
    const borrado = gastosRepo.crear(db, entrada('Borrado'));
    gastosRepo.eliminar(db, borrado.gasto.id);

    expect(gastosRepo.listarCuotasEntre(db, '2026-03-01', '2026-03-31').map((c) => c.descripcion)).toEqual(['Activo']);
  });
});
