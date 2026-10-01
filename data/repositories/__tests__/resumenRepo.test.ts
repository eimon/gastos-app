import { describeConSqlite } from '../../../test/dbPrueba';
import { db } from '../../db/client';
import {
  cuotaParticipantes,
  deudaCuotas,
  deudas,
  gastoCuotas,
  gastoParticipantes,
  gastos,
  pagos,
  tarjetas,
} from '../../db/schema';
import * as deudasRepo from '../deudasRepo';
import * as gastosRepo from '../gastosRepo';
import * as pagosRepo from '../pagosRepo';
import * as resumenRepo from '../resumenRepo';
import * as tarjetasRepo from '../tarjetasRepo';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../../test/dbPrueba').expoSqliteFalso());

interface OpcionesGasto {
  fechaCompra?: string;
  tarjetaId?: string | null;
  /** One entry per cuota: due date and the amounts of [Ana, Yo]. */
  cuotas: { vence: string; ana: number; yo: number }[];
}

/** Shared gasto between Ana and the user (the user is LAST, as the services build it). */
const gastoCompartido = ({ fechaCompra = '2026-04-10', tarjetaId = null, cuotas }: OpcionesGasto) =>
  gastosRepo.crear(db, {
    descripcion: 'Cena',
    fechaCompra,
    tipo: 'compartido',
    montoTotalCents: cuotas.reduce((total, c) => total + c.ana + c.yo, 0),
    descuentoCents: 0,
    tipoDescuento: null,
    cantidadCuotas: cuotas.length,
    tarjetaId,
    participantes: [
      { nombre: 'Ana', esUsuario: false },
      { nombre: 'Yo', esUsuario: true },
    ],
    cuotas: cuotas.map((c, i) => ({
      numero: i + 1,
      montoCents: c.ana + c.yo,
      fechaCierre: null,
      fechaVencimiento: c.vence,
      partes: [c.ana, c.yo],
    })),
  });

const gastoPersonal = (fechaCompra: string, montoCents: number) =>
  gastosRepo.crear(db, {
    descripcion: 'Super',
    fechaCompra,
    tipo: 'personal',
    montoTotalCents: montoCents,
    descuentoCents: 0,
    tipoDescuento: null,
    cantidadCuotas: 1,
    tarjetaId: null,
    participantes: [{ nombre: 'Yo', esUsuario: true }],
    cuotas: [{ numero: 1, montoCents, fechaCierre: null, fechaVencimiento: fechaCompra, partes: [montoCents] }],
  });

const parteDeAna = (g: gastosRepo.GastoConDetalle, cuota = 0) =>
  g.cuotas[cuota].partes.find((p) => g.participantes.find((x) => x.id === p.participanteId)?.nombre === 'Ana')!;

const pagarParte = (cuotaParticipanteId: string, montoCents: number) =>
  pagosRepo.registrar(db, { cuotaParticipanteId, montoCents, medioPago: 'efectivo', fecha: '2026-04-12', notas: null });

const deuda = (acreedor: string, vencimientos: string[], montoCuota = 3_000) =>
  deudasRepo.crear(db, {
    acreedor,
    descripcion: 'Prestamo',
    montoTotalCents: montoCuota * vencimientos.length,
    cantidadCuotas: vencimientos.length,
    fechaPrimerPago: vencimientos[0],
    cuotas: vencimientos.map((fechaVencimiento, i) => ({ numero: i + 1, montoCents: montoCuota, fechaVencimiento })),
  });

describeConSqlite('resumenRepo against real SQLite (foreign keys ON)', () => {
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

  describe('listarCuotasDeTarjetaEntre', () => {
    const rango = ['2026-04-01', '2026-04-30'] as const;

    test('returns the FULL cuota amount, inclusive at both ends of the month, and nothing outside it', () => {
      const visa = tarjetasRepo.crear(db, { nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 });
      gastoCompartido({
        tarjetaId: visa.id,
        cuotas: ['2026-03-31', '2026-04-01', '2026-04-30', '2026-05-01'].map((vence) => ({ vence, ana: 4_000, yo: 6_000 })),
      });

      const filas = resumenRepo.listarCuotasDeTarjetaEntre(db, ...rango);

      expect(filas.map((f) => f.fechaVencimiento).sort()).toEqual(['2026-04-01', '2026-04-30']);
      expect(filas.every((f) => f.montoCents === 10_000 && f.tarjetaId === visa.id)).toBe(true);
    });

    test('ignores gastos without a card and deleted gastos, and keeps archived cards', () => {
      const vieja = tarjetasRepo.crear(db, { nombre: 'Vieja', diaCierre: 25, diaVencimiento: 5 });
      gastoCompartido({ cuotas: [{ vence: '2026-04-15', ana: 1_000, yo: 1_000 }] });
      const borrado = gastoCompartido({
        tarjetaId: vieja.id,
        cuotas: [{ vence: '2026-04-15', ana: 7_000, yo: 7_000 }],
      });
      gastosRepo.eliminar(db, borrado.gasto.id);
      gastoCompartido({ tarjetaId: vieja.id, cuotas: [{ vence: '2026-04-16', ana: 500, yo: 500 }] });
      tarjetasRepo.archivar(db, vieja.id);

      const filas = resumenRepo.listarCuotasDeTarjetaEntre(db, ...rango);

      expect(filas).toEqual([{ tarjetaId: vieja.id, montoCents: 1_000, fechaVencimiento: '2026-04-16' }]);
    });
  });

  describe('listarPartesACobrarHasta', () => {
    test('sums LIVE pagos only: an anulado pago does not reduce what is owed', () => {
      const g = gastoCompartido({ cuotas: [{ vence: '2026-04-15', ana: 10_000, yo: 10_000 }] });
      pagarParte(parteDeAna(g).id, 3_000);
      pagosRepo.anular(db, pagarParte(parteDeAna(g).id, 4_000).id);

      expect(resumenRepo.listarPartesACobrarHasta(db, '2026-04-30')).toEqual([
        { nombre: 'Ana', montoCents: 10_000, fechaVencimiento: '2026-04-15', pagadoCents: 3_000 },
      ]);
    });

    test('leaves fully paid shares in the database and brings them back when the paying pago is anulado', () => {
      const g = gastoCompartido({ cuotas: [{ vence: '2026-04-15', ana: 10_000, yo: 10_000 }] });
      pagarParte(parteDeAna(g).id, 4_000);
      const ultimo = pagarParte(parteDeAna(g).id, 6_000);

      expect(resumenRepo.listarPartesACobrarHasta(db, '2026-04-30')).toEqual([]);

      pagosRepo.anular(db, ultimo.id);
      expect(resumenRepo.listarPartesACobrarHasta(db, '2026-04-30').map((f) => f.pagadoCents)).toEqual([4_000]);
    });

    test('excludes the user share, deleted gastos, and shares due after the month (inclusive on the last day)', () => {
      gastoCompartido({
        tarjetaId: tarjetasRepo.crear(db, { nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 }).id,
        cuotas: [
          { vence: '2026-02-10', ana: 100, yo: 100 },
          { vence: '2026-04-30', ana: 200, yo: 200 },
          { vence: '2026-05-01', ana: 300, yo: 300 },
        ],
      });
      const borrado = gastoCompartido({ cuotas: [{ vence: '2026-04-01', ana: 900, yo: 900 }] });
      gastosRepo.eliminar(db, borrado.gasto.id);

      const filas = resumenRepo.listarPartesACobrarHasta(db, '2026-04-30');

      expect(filas.map((f) => [f.nombre, f.montoCents]).sort()).toEqual([['Ana', 100], ['Ana', 200]]);
    });
  });

  describe('listarCuotasDeDeudaHasta', () => {
    test('sums LIVE pagos only and excludes deleted deudas and cuotas due after the month', () => {
      const banco = deuda('Banco X', ['2026-03-15', '2026-04-30', '2026-05-01']);
      const [primera] = deudasRepo.obtenerConCuotas(db, banco.deuda.id)!.cuotas;
      pagosRepo.registrar(db, { deudaCuotaId: primera.id, montoCents: 1_000, medioPago: 'efectivo', fecha: '2026-03-16', notas: null });
      const anulado = pagosRepo.registrar(db, { deudaCuotaId: primera.id, montoCents: 500, medioPago: 'efectivo', fecha: '2026-03-17', notas: null });
      pagosRepo.anular(db, anulado.id);
      deudasRepo.eliminar(db, deuda('Borrada', ['2026-04-01']).deuda.id);

      const filas = resumenRepo.listarCuotasDeDeudaHasta(db, '2026-04-30');

      const [segunda] = deudasRepo.obtenerConCuotas(db, banco.deuda.id)!.cuotas.slice(1);
      pagosRepo.registrar(db, { deudaCuotaId: segunda.id, montoCents: 3_000, medioPago: 'efectivo', fecha: '2026-04-20', notas: null });
      const filasSinPagada = resumenRepo.listarCuotasDeDeudaHasta(db, '2026-04-30');
      expect(filasSinPagada.map((f) => f.fechaVencimiento)).toEqual(['2026-03-15']);

      expect(filas.map((f) => [f.acreedor, f.fechaVencimiento, f.pagadoCents])).toEqual([
        ['Banco X', '2026-03-15', 1_000],
        ['Banco X', '2026-04-30', 0],
      ]);
    });
  });

  describe('listarGastosDelUsuarioPorCompra', () => {
    test('counts only the user share across ALL cuotas, by purchase date (inclusive at both ends)', () => {
      gastoPersonal('2026-04-01', 27_000);
      gastoPersonal('2026-04-30', 1_000);
      gastoPersonal('2026-03-31', 5_000);
      gastoPersonal('2026-05-01', 6_000);
      // Bought in April, cuotas due in May and June: the user share of BOTH cuotas counts in April.
      gastoCompartido({
        fechaCompra: '2026-04-10',
        tarjetaId: tarjetasRepo.crear(db, { nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 }).id,
        cuotas: [
          { vence: '2026-05-05', ana: 3_000, yo: 3_334 },
          { vence: '2026-06-05', ana: 3_000, yo: 3_334 },
        ],
      });
      const borrado = gastoPersonal('2026-04-15', 99_000);
      gastosRepo.eliminar(db, borrado.gasto.id);

      const filas = resumenRepo.listarGastosDelUsuarioPorCompra(db, '2026-04-01', '2026-04-30');

      const porTipo = (tipo: string) => filas.filter((f) => f.tipo === tipo).reduce((total, f) => total + f.montoCents, 0);
      expect(porTipo('personal')).toBe(28_000);
      expect(porTipo('compartido')).toBe(6_668);
    });
  });
});
