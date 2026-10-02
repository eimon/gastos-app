import { describeConSqlite } from '../../test/dbPrueba';
import { db } from '../../data/db/client';
import { cuotaParticipantes, gastoCuotas, gastoParticipantes, gastos, pagos, tarjetas } from '../../data/db/schema';
import * as gastosRepo from '../../data/repositories/gastosRepo';
import * as gastosService from '../gastosService';
import * as tarjetasService from '../tarjetasService';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../test/dbPrueba').expoSqliteFalso());

const gastoBase = (tarjetaId: string) => ({
  tipo: 'personal' as const,
  descripcion: 'Heladera',
  fechaCompra: '2026-03-10',
  montoTotalCents: 300_000,
  descuentoCents: 0,
  tipoDescuento: null,
  cuotas: 3,
  tarjetaId,
  participantes: [],
});

const vencimientos = (gastoId: string) =>
  gastosRepo.obtenerConDetalle(db, gastoId)!.cuotas.map((c) => c.fechaVencimiento);

describeConSqlite('archived tarjetas against real SQLite (foreign keys ON)', () => {
  beforeEach(() => {
    db.delete(pagos).run();
    db.delete(cuotaParticipantes).run();
    db.delete(gastoCuotas).run();
    db.delete(gastoParticipantes).run();
    db.delete(gastos).run();
    db.delete(tarjetas).run();
  });

  test('an archived tarjeta is excluded from the list used for new gastos but kept in listarTodas', async () => {
    const visa = await tarjetasService.crear({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 });
    const master = await tarjetasService.crear({ nombre: 'Master', diaCierre: 20, diaVencimiento: 1 });
    await tarjetasService.archivar(visa.id);

    expect((await tarjetasService.listar()).map((t) => t.id)).toEqual([master.id]);
    expect((await tarjetasService.listarTodas()).map((t) => t.id).sort()).toEqual([visa.id, master.id].sort());
  });

  test('creating a gasto on an archived tarjeta is rejected', async () => {
    const visa = await tarjetasService.crear({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 });
    await tarjetasService.archivar(visa.id);

    await expect(gastosService.crear(gastoBase(visa.id))).rejects.toThrow('La tarjeta seleccionada está archivada.');
    expect(db.select().from(gastos).all()).toHaveLength(0);
  });

  test('an archived tarjeta is still readable by id', async () => {
    const visa = await tarjetasService.crear({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 });
    await tarjetasService.archivar(visa.id);

    const leida = await tarjetasService.obtener(visa.id);
    expect(leida).toMatchObject({ id: visa.id, nombre: 'Visa' });
    expect(leida?.deletedAt).not.toBeNull();
  });

  test('archiving a tarjeta leaves the stored due dates of an existing gasto unchanged', async () => {
    const visa = await tarjetasService.crear({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 });
    const creado = await gastosService.crear(gastoBase(visa.id));
    const antes = vencimientos(creado.gasto.id);
    expect(antes).toHaveLength(3);

    await tarjetasService.archivar(visa.id);

    expect(vencimientos(creado.gasto.id)).toEqual(antes);
    expect(gastosRepo.obtenerConDetalle(db, creado.gasto.id)?.gasto.tarjetaId).toBe(visa.id);
  });
});
