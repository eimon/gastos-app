import { MAX_CUOTAS } from '../limites';
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

describe('validarDeuda', () => {
  test('accepts a 30-year loan (360 cuotas) but rejects anything above the maximum', () => {
    expect(validarDeuda({ ...inputBase, cuotas: MAX_CUOTAS })).toEqual([]);
    expect(validarDeuda({ ...inputBase, cuotas: MAX_CUOTAS + 1 })).toContain('CUOTAS_INVALIDA');
    expect(validarDeuda({ ...inputBase, cuotas: 10_000_000_000 })).toContain('CUOTAS_INVALIDA');
    expect(() => planificarDeuda({ ...inputBase, cuotas: 10_000_000_000 })).toThrow('Deuda invalida');
    expect(planificarDeuda({ ...inputBase, cuotas: MAX_CUOTAS }).cuotas).toHaveLength(MAX_CUOTAS);
  });

  test('rejects a non-positive montoTotalCents', () => {
    expect(validarDeuda({ ...inputBase, montoTotalCents: 0 })).toContain('MONTO_INVALIDO');
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

  test('rejects an invalid fechaPrimerPago', () => {
    expect(validarDeuda({ ...inputBase, fechaPrimerPago: 'not-a-date' })).toContain('FECHA_INVALIDA');
  });

  test('accepts a valid deuda with no errors', () => {
    expect(validarDeuda(inputBase)).toEqual([]);
  });
});
