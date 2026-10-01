import { MAX_CUOTAS, MAX_MONTO_CENTS } from '../limites';
import { planificarDeuda, validarDeuda, InputDeuda } from '../deuda';

const inputBase: InputDeuda = {
  acreedor: 'Banco X',
  descripcion: 'Prestamo personal',
  montoTotalCents: 90_000,
  cuotas: 3,
  fechaPrimerPago: '2026-01-15',
};

describe('planificarDeuda', () => {
  test('generates an equal monthly cuota schedule starting at the first payment date', () => {
    const plan = planificarDeuda(inputBase);

    expect(plan.cuotas).toEqual([
      { numero: 1, montoCents: 30_000, fechaVencimiento: '2026-01-15' },
      { numero: 2, montoCents: 30_000, fechaVencimiento: '2026-02-15' },
      { numero: 3, montoCents: 30_000, fechaVencimiento: '2026-03-15' },
    ]);
  });

  test('throws when the deuda is invalid instead of leaking a raw dinero/vencimientos error', () => {
    expect(() => planificarDeuda({ ...inputBase, cuotas: 0 })).toThrow('Deuda invalida');
  });
});

describe('planificarDeuda long schedules', () => {
  const fechas = (primerPago: string, cuotas: number) =>
    planificarDeuda({ ...inputBase, cuotas, fechaPrimerPago: primerPago }).cuotas.map((c) => c.fechaVencimiento);

  test('the 31st over 14 cuotas crosses into 2028 and lands on Feb 29 of the leap year', () => {
    const resultado = fechas('2027-01-31', 14);
    expect(resultado[0]).toBe('2027-01-31');
    expect(resultado[1]).toBe('2027-02-28');
    expect(resultado[11]).toBe('2027-12-31');
    expect(resultado[12]).toBe('2028-01-31');
    expect(resultado[13]).toBe('2028-02-29');
  });

  test('a start on Feb 29 keeps the 29th in the leap year and clamps to Feb 28 in the common years after it', () => {
    const resultado = fechas('2028-02-29', 30);
    expect(resultado.slice(0, 3)).toEqual(['2028-02-29', '2028-03-29', '2028-04-29']);
    expect(resultado[12]).toBe('2029-02-28');
    expect(resultado[24]).toBe('2030-02-28');
    expect(resultado[29]).toBe('2030-07-29');
  });

  test('30 cuotas add up to the total, leftover cents included, and end 29 months later', () => {
    const total = 1_000_000_07;
    const { cuotas } = planificarDeuda({ ...inputBase, montoTotalCents: total, cuotas: 30, fechaPrimerPago: '2026-01-31' });
    expect(cuotas).toHaveLength(30);
    expect(cuotas.reduce((suma, c) => suma + c.montoCents, 0)).toBe(total);
    expect(cuotas[29].montoCents).toBe(Math.floor(total / 30) + (total % 30));
    expect(cuotas[0].fechaVencimiento).toBe('2026-01-31');
    expect(cuotas[29].fechaVencimiento).toBe('2028-06-30');
  });
});

describe('planificarDeuda rounding and clamping', () => {
  test('the last cuota absorbs the leftover cents', () => {
    const { cuotas } = planificarDeuda({ ...inputBase, montoTotalCents: 100_000 });
    expect(cuotas.map((c) => c.montoCents)).toEqual([33_333, 33_333, 33_334]);
  });

  test('due dates clamp from the ORIGINAL day (the 31st)', () => {
    const { cuotas } = planificarDeuda({ ...inputBase, cuotas: 4, fechaPrimerPago: '2026-01-31' });
    expect(cuotas.map((c) => c.fechaVencimiento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
});

describe('validarDeuda', () => {
  test('accepts exactly 30 cuotas and rejects anything above the maximum', () => {
    expect(MAX_CUOTAS).toBe(30);
    expect(validarDeuda({ ...inputBase, cuotas: 30 })).toEqual([]);
    expect(validarDeuda({ ...inputBase, cuotas: 31 })).toEqual(['CUOTAS_INVALIDA']);
    expect(validarDeuda({ ...inputBase, cuotas: 10_000_000_000 })).toContain('CUOTAS_INVALIDA');
    expect(() => planificarDeuda({ ...inputBase, cuotas: 10_000_000_000 })).toThrow('Deuda invalida');
    expect(planificarDeuda({ ...inputBase, cuotas: 30 }).cuotas).toHaveLength(30);
  });

  test('rejects a non-positive montoTotalCents', () => {
    expect(validarDeuda({ ...inputBase, montoTotalCents: 0 })).toContain('MONTO_INVALIDO');
  });

  test('accepts exactly the maximum amount and rejects one cent above it', () => {
    expect(validarDeuda({ ...inputBase, montoTotalCents: MAX_MONTO_CENTS })).toEqual([]);
    expect(validarDeuda({ ...inputBase, montoTotalCents: MAX_MONTO_CENTS + 1 })).toEqual(['MONTO_EXCESIVO']);
  });

  test('rejects a non-integer montoTotalCents', () => {
    expect(validarDeuda({ ...inputBase, montoTotalCents: 100.5 })).toContain('MONTO_INVALIDO');
  });

  test('rejects cuotas < 1', () => {
    expect(validarDeuda({ ...inputBase, cuotas: 0 })).toContain('CUOTAS_INVALIDA');
  });

  test('rejects negative cuotas', () => {
    expect(validarDeuda({ ...inputBase, cuotas: -2 })).toContain('CUOTAS_INVALIDA');
  });

  test('rejects an empty acreedor', () => {
    expect(validarDeuda({ ...inputBase, acreedor: '   ' })).toContain('ACREEDOR_REQUERIDO');
  });

  test('rejects a blank descripcion', () => {
    expect(validarDeuda({ ...inputBase, descripcion: '  ' })).toEqual(['DESCRIPCION_REQUERIDA']);
  });

  test('rejects an invalid fechaPrimerPago, including impossible calendar dates', () => {
    expect(validarDeuda({ ...inputBase, fechaPrimerPago: 'not-a-date' })).toContain('FECHA_INVALIDA');
    expect(validarDeuda({ ...inputBase, fechaPrimerPago: '2026-13-01' })).toContain('FECHA_INVALIDA');
  });

  test('accepts a valid deuda with no errors', () => {
    expect(validarDeuda(inputBase)).toEqual([]);
  });
});
