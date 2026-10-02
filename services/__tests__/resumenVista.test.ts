import type { Tarjeta } from '../../data/repositories/tarjetasRepo';
import { armarResumen, type DatosResumen } from '../resumenVista';

const abril = { mes: 4, año: 2026 };

const tarjeta = (id: string, nombre: string, archivada = false) =>
  ({ id, nombre, diaCierre: 25, diaVencimiento: 5, deletedAt: archivada ? '2026-01-01' : null }) as Tarjeta;

const vacio: DatosResumen = { tarjetas: [], cuotasDeTarjeta: [], partesACobrar: [], cuotasDeDeuda: [], gastosDelUsuario: [] };

describe('armarResumen', () => {
  test('empty data gives four empty blocks with zero totals', () => {
    expect(armarResumen(vacio, abril)).toEqual({
      tarjetas: { filas: [], totalCents: 0 },
      meDeben: { filas: [], totales: { delMesCents: 0, vencidoCents: 0, totalCents: 0 } },
      debo: { filas: [], totales: { delMesCents: 0, vencidoCents: 0, totalCents: 0 } },
      gastosDelMes: { personalCents: 0, compartidoCents: 0, totalCents: 0 },
    });
  });

  test('cards: only cuotas due in the month, archived cards labeled, sorted by name, with a grand total', () => {
    const { tarjetas } = armarResumen(
      {
        ...vacio,
        tarjetas: [tarjeta('v', 'Visa'), tarjeta('m', 'Mastercard', true), tarjeta('a', 'Ágil')],
        cuotasDeTarjeta: [
          { tarjetaId: 'v', montoCents: 2_700_000, fechaVencimiento: '2026-04-05' },
          { tarjetaId: 'v', montoCents: 100, fechaVencimiento: '2026-05-05' },
          { tarjetaId: 'm', montoCents: 1_500_000, fechaVencimiento: '2026-04-30' },
        ],
      },
      abril,
    );

    expect(tarjetas.filas).toEqual([
      { tarjetaId: 'm', nombre: 'Mastercard (archivada)', totalCents: 1_500_000 },
      { tarjetaId: 'v', nombre: 'Visa', totalCents: 2_700_000 },
    ]);
    expect(tarjetas.totalCents).toBe(4_200_000);
  });

  test('me deben: remaining after live pagos, vencido apart, name variants merged, sorted, with totals', () => {
    const { meDeben } = armarResumen(
      {
        ...vacio,
        partesACobrar: [
          { nombre: 'Luis', montoCents: 3_000, pagadoCents: 0, fechaVencimiento: '2026-04-12' },
          { nombre: 'Ana', montoCents: 3_000, pagadoCents: 1_000, fechaVencimiento: '2026-04-12' },
          { nombre: ' ana ', montoCents: 1_000, pagadoCents: 0, fechaVencimiento: '2026-03-31' },
          { nombre: 'Pedro', montoCents: 500, pagadoCents: 500, fechaVencimiento: '2026-04-01' },
          { nombre: 'Luis', montoCents: 900, pagadoCents: 0, fechaVencimiento: '2026-05-01' },
        ],
      },
      abril,
    );

    expect(meDeben.filas).toEqual([
      { nombre: 'Ana', delMesCents: 2_000, vencidoCents: 1_000, totalCents: 3_000 },
      { nombre: 'Luis', delMesCents: 3_000, vencidoCents: 0, totalCents: 3_000 },
    ]);
    expect(meDeben.totales).toEqual({ delMesCents: 5_000, vencidoCents: 1_000, totalCents: 6_000 });
  });

  test('debo: groups by acreedor with del mes, vencido and totals', () => {
    const { debo } = armarResumen(
      {
        ...vacio,
        cuotasDeDeuda: [
          { acreedor: 'Banco X', montoCents: 3_000, pagadoCents: 1_000, fechaVencimiento: '2026-04-15' },
          { acreedor: 'Banco X', montoCents: 3_000, pagadoCents: 0, fechaVencimiento: '2026-03-15' },
        ],
      },
      abril,
    );

    expect(debo.filas).toEqual([{ nombre: 'Banco X', delMesCents: 2_000, vencidoCents: 3_000, totalCents: 5_000 }]);
    expect(debo.totales).toEqual({ delMesCents: 2_000, vencidoCents: 3_000, totalCents: 5_000 });
  });

  test('gastos del mes: personal and shared are separate and add up to the total', () => {
    const { gastosDelMes } = armarResumen(
      {
        ...vacio,
        gastosDelUsuario: [
          { tipo: 'personal', montoCents: 1_500_000 },
          { tipo: 'compartido', montoCents: 3_000_000 },
          { tipo: 'personal', montoCents: 500 },
        ],
      },
      abril,
    );

    expect(gastosDelMes).toEqual({ personalCents: 1_500_500, compartidoCents: 3_000_000, totalCents: 4_500_500 });
  });
});
