import { MAX_CUOTAS, MAX_MONTO_CENTS } from '../limites';
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

describe('validarGasto amount cap', () => {
  test('accepts exactly the maximum and rejects one cent above it', () => {
    expect(validarGasto({ ...inputBase, montoTotalCents: MAX_MONTO_CENTS })).toEqual([]);
    expect(validarGasto({ ...inputBase, montoTotalCents: MAX_MONTO_CENTS + 1 })).toEqual(['MONTO_EXCESIVO']);
  });
});

describe('validarGasto', () => {
  test('rejects a discount equal to the total (net amount would be 0)', () => {
    const errores = validarGasto({ ...inputBase, descuentoCents: 100_000_00 });
    expect(errores).toContain('DESCUENTO_INVALIDO');
  });

  test('rejects a discount greater than the total', () => {
    const errores = validarGasto({ ...inputBase, descuentoCents: 110_000_00 });
    expect(errores).toContain('DESCUENTO_INVALIDO');
  });

  test('rejects any discount with 1 cuota, for personal and shared gastos', () => {
    const personal = validarGasto({ ...inputBase, descuentoCents: 10_00, tipoDescuento: 'uniforme' });
    expect(personal).toContain('DESCUENTO_SOLO_EN_CUOTAS');
    const compartido = validarGasto({
      ...inputBase,
      tipo: 'compartido',
      participantes: ['Ana'],
      descuentoCents: 10_00,
      tipoDescuento: 'uniforme',
    });
    expect(compartido).toContain('DESCUENTO_SOLO_EN_CUOTAS');
  });

  test('accepts a discount with more than 1 cuota', () => {
    const errores = validarGasto({
      ...inputBase,
      cuotas: 3,
      tarjeta: { id: 'v', diaCierre: 25, diaVencimiento: 10 },
      descuentoCents: 10_00,
      tipoDescuento: 'uniforme',
    });
    expect(errores).toEqual([]);
  });

  test('rejects blank and duplicate participant names', () => {
    const compartido = { ...inputBase, tipo: 'compartido' as const };
    expect(validarGasto({ ...compartido, participantes: ['Ana', ' '] })).toContain('PARTICIPANTE_VACIO');
    expect(validarGasto({ ...compartido, participantes: ['Ana', 'ANA '] })).toContain('PARTICIPANTE_DUPLICADO');
  });

  describe('custom amounts', () => {
    const compartido: InputGasto = {
      ...inputBase,
      tipo: 'compartido',
      montoTotalCents: 60_00,
      participantes: ['Ana', 'Luis'],
      montosPersonalizadosCents: [30_00, 20_00, 10_00],
    };

    test('accepts fixed amounts that sum to the total and plans a single cuota with that total', () => {
      expect(validarGasto(compartido)).toEqual([]);
      expect(planificarGasto(compartido).cuotas).toEqual([
        { numero: 1, montoCents: 60_00, fechaCierre: null, fechaVencimiento: '2026-03-01' },
      ]);
    });

    test('accepts a 0 amount for the payer only', () => {
      expect(validarGasto({ ...compartido, montoTotalCents: 50_00, montosPersonalizadosCents: [30_00, 20_00, 0] })).toEqual([]);
      expect(
        validarGasto({ ...compartido, montoTotalCents: 30_00, montosPersonalizadosCents: [30_00, 0, 0] }),
      ).toContain('MONTOS_PERSONALIZADOS_INVALIDOS');
    });

    test('rejects custom amounts on a personal gasto, even when they add up', () => {
      const personal: InputGasto = { ...inputBase, montoTotalCents: 10_00, participantes: [], montosPersonalizadosCents: [10_00] };
      expect(validarGasto(personal)).toContain('MONTOS_PERSONALIZADOS_INVALIDOS');
      expect(() => planificarGasto(personal)).toThrow('Gasto invalido');
    });

    test('rejects custom amounts with cuotas > 1 at domain level', () => {
      const tarjeta = { id: 'v', diaCierre: 25, diaVencimiento: 10 };
      const errores = validarGasto({ ...compartido, cuotas: 2, tarjeta });
      expect(errores).toEqual(['MONTOS_PERSONALIZADOS_INVALIDOS']);
      expect(() => planificarGasto({ ...compartido, cuotas: 2, tarjeta })).toThrow('Gasto invalido');
    });

    test('a custom gasto where every amount is 0 reports amounts and total, never a discount error', () => {
      const errores = validarGasto({ ...compartido, montoTotalCents: 0, montosPersonalizadosCents: [0, 0, 0] });
      expect(errores).toEqual(['MONTO_INVALIDO', 'MONTOS_PERSONALIZADOS_INVALIDOS']);
    });

    test.each([
      ['a sum different from the total', { montoTotalCents: 70_00 }],
      ['a wrong number of amounts', { montosPersonalizadosCents: [30_00, 30_00] }],
      ['a non-integer amount', { montoTotalCents: 60_50, montosPersonalizadosCents: [30_25, 20_25, 10] }],
      ['a negative payer amount', { montoTotalCents: 40_00, montosPersonalizadosCents: [30_00, 20_00, -10_00] }],
      ['cuotas > 1', { cuotas: 3, tarjeta: { id: 'v', diaCierre: 25, diaVencimiento: 10 } }],
      ['a personal gasto', { tipo: 'personal' as const }],
    ])('rejects %s', (_nombre, cambios) => {
      expect(validarGasto({ ...compartido, ...cambios })).toContain('MONTOS_PERSONALIZADOS_INVALIDOS');
    });
  });

  test('rejects more cuotas than the maximum, accepts exactly the maximum', () => {
    const tarjeta = { id: 'v', diaCierre: 25, diaVencimiento: 10 };
    expect(validarGasto({ ...inputBase, cuotas: 31, tarjeta })).toEqual(['CUOTAS_INVALIDA']);
    expect(validarGasto({ ...inputBase, cuotas: 10_000_000_000, tarjeta })).toContain('CUOTAS_INVALIDA');
    expect(validarGasto({ ...inputBase, cuotas: 30, tarjeta })).toEqual([]);
    expect(MAX_CUOTAS).toBe(30);
    expect(() => planificarGasto({ ...inputBase, cuotas: 10_000_000_000, tarjeta })).toThrow('Gasto invalido');
  });

  test('an untouched form (no amount, no discount) reports only MONTO_INVALIDO', () => {
    expect(validarGasto({ ...inputBase, montoTotalCents: 0 })).toEqual(['MONTO_INVALIDO']);
  });

  test('a discount with no amount still reports the discount problem', () => {
    const errores = validarGasto({ ...inputBase, cuotas: 3, tarjeta: { id: 'v', diaCierre: 1, diaVencimiento: 2 }, montoTotalCents: 0, descuentoCents: 5_00, tipoDescuento: 'uniforme' });
    expect(errores).toEqual(['MONTO_INVALIDO', 'DESCUENTO_INVALIDO']);
  });

  test('rejects a blank description and an impossible date', () => {
    expect(validarGasto({ ...inputBase, descripcion: '   ' })).toEqual(['DESCRIPCION_REQUERIDA']);
    expect(validarGasto({ ...inputBase, descripcion: 'Heladera' })).toEqual([]);
    expect(validarGasto({ ...inputBase, fechaCompra: '2026-02-30' })).toEqual(['FECHA_INVALIDA']);
    expect(validarGasto({ ...inputBase, fechaCompra: '' })).toEqual(['FECHA_INVALIDA']);
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
