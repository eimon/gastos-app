import { validarGasto, planificarGasto, InputGasto } from '../gasto';

const inputBase: InputGasto = {
  tipo: 'personal',
  fechaCompra: '2026-03-01',
  montoTotalCents: 100_000_00,
  descuentoCents: 0,
  tipoDescuento: null,
  cuotas: 1,
  tarjeta: null,
  participantes: [],
};

describe('validarGasto', () => {
  test('rejects a discount equal to the total (net amount would be 0)', () => {
    const errores = validarGasto({ ...inputBase, descuentoCents: 100_000_00 });
    expect(errores).toContain('DESCUENTO_INVALIDO');
  });

  test('rejects a discount greater than the total', () => {
    const errores = validarGasto({ ...inputBase, descuentoCents: 110_000_00 });
    expect(errores).toContain('DESCUENTO_INVALIDO');
  });

  test('rejects a personal gasto with cuotas > 1 and no card', () => {
    const errores = validarGasto({ ...inputBase, cuotas: 3, tarjeta: null });
    expect(errores).toContain('TARJETA_REQUERIDA');
  });

  test('rejects a shared gasto with cuotas > 1 and no card', () => {
    const errores = validarGasto({
      ...inputBase,
      tipo: 'compartido',
      cuotas: 2,
      tarjeta: null,
      participantes: ['Juan'],
    });
    expect(errores).toContain('TARJETA_REQUERIDA');
  });

  test('rejects cuotas = 0', () => {
    const errores = validarGasto({ ...inputBase, cuotas: 0 });
    expect(errores).toContain('CUOTAS_INVALIDA');
  });

  test('rejects negative cuotas', () => {
    const errores = validarGasto({ ...inputBase, cuotas: -2 });
    expect(errores).toContain('CUOTAS_INVALIDA');
  });

  test('rejects a non-integer cuotas', () => {
    const errores = validarGasto({ ...inputBase, cuotas: 1.5 });
    expect(errores).toContain('CUOTAS_INVALIDA');
  });

  test('rejects a non-positive montoTotalCents', () => {
    const errores = validarGasto({ ...inputBase, montoTotalCents: 0 });
    expect(errores).toContain('MONTO_INVALIDO');
  });

  test('rejects a non-integer montoTotalCents', () => {
    const errores = validarGasto({ ...inputBase, montoTotalCents: 100.5 });
    expect(errores).toContain('MONTO_INVALIDO');
  });
});

describe('planificarGasto', () => {
  test('throws when the gasto is invalid instead of silently planning it', () => {
    expect(() =>
      planificarGasto({ ...inputBase, cuotas: 3, tarjeta: null }),
    ).toThrow();
  });

  test('throws for cuotas = 0 instead of leaking a raw error from dividirEnPartes', () => {
    expect(() => planificarGasto({ ...inputBase, cuotas: 0 })).toThrow('Gasto invalido');
  });

  test('happy path: prorrateo discount with a card computes amounts and dates together', () => {
    // $120,000.00 total, 3 cuotas, $50,000.00 prorrateo discount, card
    // closing the 25th and due the 10th, purchased before closing in March.
    const plan = planificarGasto({
      tipo: 'personal',
      fechaCompra: '2026-03-01',
      montoTotalCents: 120_000_00,
      descuentoCents: 50_000_00,
      tipoDescuento: 'prorrateo',
      cuotas: 3,
      tarjeta: { id: 'visa', diaCierre: 25, diaVencimiento: 10 },
      participantes: [],
    });

    expect(plan.cuotas).toEqual([
      { numero: 1, montoCents: 0, fechaCierre: '2026-03-25', fechaVencimiento: '2026-04-10' },
      { numero: 2, montoCents: 30_000_00, fechaCierre: '2026-04-25', fechaVencimiento: '2026-05-10' },
      { numero: 3, montoCents: 40_000_00, fechaCierre: '2026-05-25', fechaVencimiento: '2026-06-10' },
    ]);
  });

  test('happy path: single cuota with no card, due date equals the purchase date', () => {
    const plan = planificarGasto({
      tipo: 'personal',
      fechaCompra: '2026-03-15',
      montoTotalCents: 50_000_00,
      descuentoCents: 0,
      tipoDescuento: null,
      cuotas: 1,
      tarjeta: null,
      participantes: [],
    });

    expect(plan.cuotas).toEqual([
      { numero: 1, montoCents: 50_000_00, fechaCierre: null, fechaVencimiento: '2026-03-15' },
    ]);
  });
});
