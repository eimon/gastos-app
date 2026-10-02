import { calcularMontosCuotas } from '../cuotas';

describe('calcularMontosCuotas', () => {
  test('uniforme: exact division ($90,000.00 - $9,000.00 discount, 3 cuotas)', () => {
    const montos = calcularMontosCuotas({
      totalCents: 90_000_00,
      descuentoCents: 9_000_00,
      cuotas: 3,
      tipoDescuento: 'uniforme',
    });
    expect(montos).toEqual([27_000_00, 27_000_00, 27_000_00]);
  });

  test('uniforme: division needing rounding ($100,000.00 - $5,000.00 discount, 3 cuotas)', () => {
    const montos = calcularMontosCuotas({
      totalCents: 100_000_00,
      descuentoCents: 5_000_00,
      cuotas: 3,
      tipoDescuento: 'uniforme',
    });
    expect(montos).toEqual([31_666_66, 31_666_66, 31_666_68]);
  });

  test('prorrateo: discount larger than one cuota ($120,000.00, 3 cuotas, $50,000.00 discount)', () => {
    // Base cuotas before discount: $40,000.00 each.
    const montos = calcularMontosCuotas({
      totalCents: 120_000_00,
      descuentoCents: 50_000_00,
      cuotas: 3,
      tipoDescuento: 'prorrateo',
    });
    // Cuota 1 absorbs $40,000.00 of the discount and resolves to 0 (valid);
    // the remaining $10,000.00 is consumed by cuota 2; cuota 3 is untouched.
    expect(montos).toEqual([0, 30_000_00, 40_000_00]);
  });
});
