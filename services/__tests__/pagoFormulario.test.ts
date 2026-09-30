import { errorMontoPago, mensajeCodigoPago, mensajePagoRechazado } from '../pagoFormulario';

describe('errorMontoPago', () => {
  const restante = 33_333_33;

  test.each([
    ['nothing typed', null],
    ['zero', 0],
  ])('rejects %s as an invalid amount', (_nombre, monto) => {
    expect(errorMontoPago(monto, restante)).toBe('El monto debe ser mayor a cero.');
  });

  test('accepts a partial amount and exactly the remaining amount', () => {
    expect(errorMontoPago(200, restante)).toBeNull();
    expect(errorMontoPago(33_333.33, restante)).toBeNull();
  });

  test('rejects an overpayment and mentions what is left', () => {
    expect(errorMontoPago(33_333.34, restante)).toBe('El monto no puede superar lo que falta pagar ($ 33.333,33).');
  });

  test('rejects any payment when nothing is left', () => {
    expect(errorMontoPago(1, 0)).toBe('Esta parte ya está pagada.');
  });
});

describe('mensajeCodigoPago', () => {
  test('maps the service-only codes', () => {
    expect(mensajeCodigoPago('ES_USUARIO', 0)).toBe('La parte propia es informativa y no se paga.');
    expect(mensajeCodigoPago('OBJETIVO_NO_ENCONTRADO', 0)).toBe('No se encontró la parte a pagar.');
  });
});

describe('mensajePagoRechazado', () => {
  const rechazo = (codigos: string[], restanteCents?: number) => Object.assign(new Error('x'), { codigos, restanteCents });

  test('uses the fresh remaining amount from the service, not the stale one from the dialog', () => {
    const mensaje = mensajePagoRechazado(rechazo(['EXCEDE_RESTANTE'], 10_00), 50_00);

    expect(mensaje).toBe('El monto no puede superar lo que falta pagar ($ 10,00).');
  });

  test('falls back to the dialog amount when the service reports none', () => {
    expect(mensajePagoRechazado(rechazo(['EXCEDE_RESTANTE']), 50_00)).toContain('$ 50,00');
  });

  test('maps a deleted gasto', () => {
    expect(mensajePagoRechazado(rechazo(['GASTO_ELIMINADO']), 0)).toBe('El gasto fue eliminado y ya no admite pagos.');
  });

  test('returns null for errors that are not rules errors', () => {
    expect(mensajePagoRechazado(new Error('boom'), 0)).toBeNull();
  });
});
