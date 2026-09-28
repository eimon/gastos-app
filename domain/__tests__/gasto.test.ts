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
});

describe('planificarGasto', () => {
  test('throws when the gasto is invalid instead of silently planning it', () => {
    expect(() =>
      planificarGasto({ ...inputBase, cuotas: 3, tarjeta: null }),
    ).toThrow();
  });
});
