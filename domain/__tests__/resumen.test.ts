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

  test('merges the same person written with different casing/whitespace, keeping the first variant seen as display name', () => {
    const cobros = cobrosPorPersona(
      [
        { nombre: 'Juan', montoCents: 10_000_00, pagos: [], fechaVencimiento: '2026-03-10' },
        { nombre: '  juan  ', montoCents: 5_000_00, pagos: [], fechaVencimiento: '2026-03-15' },
        { nombre: 'JUAN', montoCents: 2_000_00, pagos: [], fechaVencimiento: '2026-03-20' },
      ],
      marzo2026,
    );

    expect(cobros).toEqual([
      { nombre: 'Juan', delMesCents: 17_000_00, vencidoCents: 0, totalCents: 17_000_00 },
    ]);
  });
});

describe('saldos pendientes (remaining, vencido and future)', () => {
  const juan = (montoCents: number, pagos: number[], fechaVencimiento: string) => ({
    nombre: 'Juan',
    montoCents,
    pagos,
    fechaVencimiento,
  });

  test('splits del mes and vencido on the remaining amount, skips paid shares and ignores future ones', () => {
    const cobros = cobrosPorPersona(
      [
        juan(10_000, [4_000], '2026-03-31'), // vencido, partially paid -> 6.000
        juan(10_000, [], '2026-04-01'), // del mes (first day)
        juan(5_000, [5_000], '2026-04-10'), // fully paid -> skipped
        juan(7_000, [], '2026-04-30'), // del mes (last day)
        juan(9_000, [], '2026-05-01'), // future -> excluded
      ],
      abril2026,
    );

    expect(cobros).toEqual([{ nombre: 'Juan', delMesCents: 17_000, vencidoCents: 6_000, totalCents: 23_000 }]);
  });

  test('a share due on the last day of the previous month is vencido, never del mes', () => {
    const [linea] = deudasPorAcreedor(
      [{ acreedor: 'Banco X', montoCents: 3_000, pagos: [], fechaVencimiento: '2025-12-31' }],
      { mes: 1, año: 2026 },
    );

    expect(linea).toMatchObject({ delMesCents: 0, vencidoCents: 3_000 });
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

  test('merges "Banco X", "  banco x  " and "BANCO X" into one entry, keeping the first variant seen as display name', () => {
    const deudas = deudasPorAcreedor(
      [
        { acreedor: 'Banco X', montoCents: 10_000_00, pagos: [], fechaVencimiento: '2026-03-10' },
        { acreedor: '  banco x  ', montoCents: 5_000_00, pagos: [], fechaVencimiento: '2026-03-15' },
        { acreedor: 'BANCO X', montoCents: 2_000_00, pagos: [], fechaVencimiento: '2026-03-20' },
      ],
      marzo2026,
    );

    expect(deudas).toEqual([
      { acreedor: 'Banco X', delMesCents: 17_000_00, vencidoCents: 0, totalCents: 17_000_00 },
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
