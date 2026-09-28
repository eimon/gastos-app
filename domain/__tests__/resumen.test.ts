import {
  totalesPorTarjeta,
  cobrosPorPersona,
  deudasPorAcreedor,
  totalesGastosUsuario,
} from '../resumen';

const marzo2026 = { mes: 3, año: 2026 };
const abril2026 = { mes: 4, año: 2026 };

describe('totalesPorTarjeta', () => {
  test('sums cuotas due in the month, per card', () => {
    const totales = totalesPorTarjeta(
      [
        { tarjetaId: 'visa', montoCents: 27_000_00, fechaVencimiento: '2026-03-25' },
        { tarjetaId: 'mastercard', montoCents: 15_000_00, fechaVencimiento: '2026-03-05' },
      ],
      marzo2026,
    );

    expect(totales).toEqual([
      { tarjetaId: 'visa', totalCents: 27_000_00 },
      { tarjetaId: 'mastercard', totalCents: 15_000_00 },
    ]);
    const granTotal = totales.reduce((acc, t) => acc + t.totalCents, 0);
    expect(granTotal).toBe(42_000_00);
  });
});

describe('cobrosPorPersona ("Me deben")', () => {
  test('groups two participants owing in the current month as separate entries', () => {
    const cobros = cobrosPorPersona(
      [
        { nombre: 'Juan', montoCents: 33_333_33, pagos: [], fechaVencimiento: '2026-03-15' },
        { nombre: 'Pedro', montoCents: 33_333_33, pagos: [], fechaVencimiento: '2026-03-15' },
      ],
      marzo2026,
    );

    expect(cobros).toEqual([
      { nombre: 'Juan', delMesCents: 33_333_33, vencidoCents: 0, totalCents: 33_333_33 },
      { nombre: 'Pedro', delMesCents: 33_333_33, vencidoCents: 0, totalCents: 33_333_33 },
    ]);
  });

  test('carries an unpaid March share forward into April as vencido', () => {
    const cobros = cobrosPorPersona(
      [{ nombre: 'Juan', montoCents: 33_333_33, pagos: [], fechaVencimiento: '2026-03-15' }],
      abril2026,
    );

    expect(cobros).toEqual([
      { nombre: 'Juan', delMesCents: 0, vencidoCents: 33_333_33, totalCents: 33_333_33 },
    ]);
  });
});

describe('deudasPorAcreedor ("Debo")', () => {
  test('shows a Deuda cuota due in the current month', () => {
    const deudas = deudasPorAcreedor(
      [{ acreedor: 'Banco X', montoCents: 30_000_00, pagos: [], fechaVencimiento: '2026-03-10' }],
      marzo2026,
    );

    expect(deudas).toEqual([
      { acreedor: 'Banco X', delMesCents: 30_000_00, vencidoCents: 0, totalCents: 30_000_00 },
    ]);
  });

  test('carries an unpaid February Deuda cuota forward into April as vencido', () => {
    const deudas = deudasPorAcreedor(
      [{ acreedor: 'Banco X', montoCents: 30_000_00, pagos: [], fechaVencimiento: '2026-02-15' }],
      abril2026,
    );

    expect(deudas).toEqual([
      { acreedor: 'Banco X', delMesCents: 0, vencidoCents: 30_000_00, totalCents: 30_000_00 },
    ]);
  });
});

describe('totalesGastosUsuario ("Gastos del mes")', () => {
  test('splits the total into personal and the users own share of shared gastos', () => {
    const totales = totalesGastosUsuario([
      { tipo: 'personal', montoCents: 27_000_00 },
      { tipo: 'compartido', montoCents: 33_333_34 },
    ]);

    expect(totales).toEqual({ personalCents: 27_000_00, compartidoCents: 33_333_34 });
    expect(totales.personalCents + totales.compartidoCents).toBe(60_333_34);
  });
});
