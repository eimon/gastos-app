import { validarTarjeta } from '../tarjeta';

describe('validarTarjeta', () => {
  test('accepts a valid tarjeta', () => {
    expect(validarTarjeta({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 10 })).toEqual([]);
  });

  test('rejects an empty name', () => {
    expect(validarTarjeta({ nombre: '', diaCierre: 25, diaVencimiento: 10 })).toContain(
      'NOMBRE_REQUERIDO',
    );
  });

  test('rejects a whitespace-only name', () => {
    expect(validarTarjeta({ nombre: '   ', diaCierre: 25, diaVencimiento: 10 })).toContain(
      'NOMBRE_REQUERIDO',
    );
  });

  test.each([0, 32, 1.5, -1, NaN])('rejects an invalid diaCierre: %p', (diaCierre) => {
    expect(
      validarTarjeta({ nombre: 'Visa', diaCierre, diaVencimiento: 10 }),
    ).toContain('DIA_CIERRE_INVALIDO');
  });

  test.each([0, 32, 1.5, -1, NaN])('rejects an invalid diaVencimiento: %p', (diaVencimiento) => {
    expect(
      validarTarjeta({ nombre: 'Visa', diaCierre: 25, diaVencimiento }),
    ).toContain('DIA_VENCIMIENTO_INVALIDO');
  });

  test.each([1, 31])('accepts the boundary day %p', (dia) => {
    expect(validarTarjeta({ nombre: 'Visa', diaCierre: dia, diaVencimiento: dia })).toEqual([]);
  });

  test('reports every error at once', () => {
    expect(
      validarTarjeta({ nombre: '', diaCierre: 0, diaVencimiento: 32 }),
    ).toEqual(
      expect.arrayContaining(['NOMBRE_REQUERIDO', 'DIA_CIERRE_INVALIDO', 'DIA_VENCIMIENTO_INVALIDO']),
    );
  });
});
