import { describeConSqlite } from '../../test/dbPrueba';
import { db } from '../../data/db/client';
import { cuotaParticipantes, gastoCuotas, gastoParticipantes, gastos, pagos, tarjetas } from '../../data/db/schema';
import * as pagosRepo from '../../data/repositories/pagosRepo';
import * as tarjetasRepo from '../../data/repositories/tarjetasRepo';
import { mensajePagoRechazado } from '../pagoFormulario';
import * as gastosService from '../gastosService';
import * as pagosService from '../pagosService';

// babel-jest hoists these above the imports, so the client sees the fake driver.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-sqlite', () => jest.requireActual('../../test/dbPrueba').expoSqliteFalso());

const MENSAJE_TRIGGER = 'pagos.medio_pago must be efectivo or transferencia';

const codigos = (promesa: Promise<unknown>) =>
  promesa.then(
    () => null,
    (err: { codigos?: string[] }) => err.codigos ?? String(err),
  );

/** A shared gasto in 2 cuotas with Juan; returns Juan's share of each cuota (10_000 each). */
async function gastoEnDosCuotas() {
  const tarjeta = tarjetasRepo.crear(db, { nombre: 'Visa', diaCierre: 25, diaVencimiento: 5 });
  const creado = await gastosService.crear({
    tipo: 'compartido',
    descripcion: 'Cena',
    fechaCompra: '2026-03-10',
    montoTotalCents: 40_000,
    descuentoCents: 0,
    tipoDescuento: null,
    cuotas: 2,
    tarjetaId: tarjeta.id,
    participantes: ['Juan'],
  });
  const nombreDe = (id: string) => creado.participantes.find((p) => p.id === id)?.nombre;
  return creado.cuotas.map((c) => c.partes.find((p) => nombreDe(p.participanteId) === 'Juan')!);
}

describeConSqlite('pagosService against real SQLite (foreign keys ON)', () => {
  beforeEach(() => {
    db.delete(pagos).run();
    db.delete(cuotaParticipantes).run();
    db.delete(gastoCuotas).run();
    db.delete(gastoParticipantes).run();
    db.delete(gastos).run();
    db.delete(tarjetas).run();
  });

  test('a pago with an invalid medio is rejected by the service with a coded, mappable error', async () => {
    const [cuota1] = await gastoEnDosCuotas();
    for (const medioPago of ['descuento', 'cheque', '']) {
      const entrada = {
        objetivo: { tipo: 'participante' as const, cuotaParticipanteId: cuota1.id },
        montoCents: 1_000,
        medioPago: medioPago as pagosRepo.MedioPago,
        fecha: '2026-03-11',
      };
      expect(await codigos(pagosService.registrar(entrada))).toEqual(['MEDIO_PAGO_INVALIDO']);
    }
    expect(db.select().from(pagos).all()).toHaveLength(0);

    const err = Object.assign(new Error('x'), { codigos: ['MEDIO_PAGO_INVALIDO'] });
    expect(mensajePagoRechazado(err, 0)).toBe('El medio de pago debe ser efectivo o transferencia.');
  });

  test('the database rejects an INSERT with an invalid medio_pago, even bypassing the service', async () => {
    const [cuota1] = await gastoEnDosCuotas();
    for (const medioPago of ['descuento', 'cheque']) {
      expect(() =>
        pagosRepo.registrar(db, {
          cuotaParticipanteId: cuota1.id,
          montoCents: 1_000,
          medioPago: medioPago as pagosRepo.MedioPago,
          fecha: '2026-03-11',
          notas: null,
        }),
      ).toThrow(MENSAJE_TRIGGER);
    }
    for (const medioPago of ['efectivo', 'transferencia'] as const) {
      pagosRepo.registrar(db, { cuotaParticipanteId: cuota1.id, montoCents: 1_000, medioPago, fecha: '2026-03-11', notas: null });
    }
    expect(db.select().from(pagos).all()).toHaveLength(2);
  });

  test('the database rejects an UPDATE that sets an invalid medio_pago', async () => {
    const [cuota1] = await gastoEnDosCuotas();
    const pago = await pagosService.registrar({
      objetivo: { tipo: 'participante', cuotaParticipanteId: cuota1.id },
      montoCents: 1_000,
      medioPago: 'efectivo',
      fecha: '2026-03-11',
    });

    expect(() => db.update(pagos).set({ medioPago: 'descuento' as pagosRepo.MedioPago }).run()).toThrow(MENSAJE_TRIGGER);
    expect(db.select().from(pagos).all()[0]).toMatchObject({ id: pago.id, medioPago: 'efectivo' });

    db.update(pagos).set({ medioPago: 'transferencia' }).run();
    expect(db.select().from(pagos).all()[0].medioPago).toBe('transferencia');
  });

  test('with cuota 1 settled, a partial advance of 5000 against cuota 2 is accepted and reduces its remaining amount', async () => {
    const [cuota1, cuota2] = await gastoEnDosCuotas();
    const pagar = (id: string, montoCents: number) =>
      pagosService.registrar({ objetivo: { tipo: 'participante', cuotaParticipanteId: id }, montoCents, medioPago: 'efectivo', fecha: '2026-03-11' });

    await pagar(cuota1.id, cuota1.montoCents);
    expect(await codigos(pagar(cuota1.id, 1))).toEqual(['YA_PAGADO']);

    await pagar(cuota2.id, 5_000);

    const pagosCuota2 = pagosRepo.listarPorCuotaParticipante(db, cuota2.id);
    expect(pagosCuota2.map((p) => p.montoCents)).toEqual([5_000]);
    // The remaining amount is still 5000 (10000 - 5000): paying 5001 overflows, paying 5000 settles it.
    expect(await codigos(pagar(cuota2.id, 5_001))).toEqual(['EXCEDE_RESTANTE']);
    await pagar(cuota2.id, 5_000);
    expect(pagosRepo.listarPorCuotaParticipante(db, cuota2.id).reduce((a, p) => a + p.montoCents, 0)).toBe(cuota2.montoCents);
  });
});
