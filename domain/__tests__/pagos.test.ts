import { estadoDePago, validarPago } from '../pagos';

describe('validarPago', () => {
  test('rejects a payment that exceeds the restante', () => {
    // Juan owes $10,000.00; attempts to pay $15,000.00.
    expect(validarPago(15_000_00, 10_000_00)).toEqual(['EXCEDE_RESTANTE']);
  });

  test('accepts a payment exactly equal to the restante', () => {
    expect(validarPago(10_000_00, 10_000_00)).toEqual([]);
  });

  test('rejects a payment of restante + 1 as EXCEDE_RESTANTE', () => {
    expect(validarPago(10_000_01, 10_000_00)).toEqual(['EXCEDE_RESTANTE']);
  });

  test('rejects any payment when restante is 0 as YA_PAGADO', () => {
    expect(validarPago(1, 0)).toEqual(['YA_PAGADO']);
  });
});

describe('estadoDePago', () => {
  test('records an advance payment against the next cuota separately', () => {
    // Cuota 1 (monto $10,000.00) is fully paid.
    const cuota1 = estadoDePago(10_000_00, [10_000_00]);
    expect(cuota1.estado).toBe('pagado');
    expect(cuota1.restante).toBe(0);

    // Cuota 2 (monto $10,000.00) receives a $5,000.00 advance payment.
    const cuota2 = estadoDePago(10_000_00, [5_000_00]);
    expect(cuota2.estado).toBe('parcial');
    expect(cuota2.restante).toBe(5_000_00);
  });
});
