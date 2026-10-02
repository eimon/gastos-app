import { validarOLanzar } from '../tarjetaGate';

describe('validarOLanzar', () => {
  test('does not throw for a valid tarjeta', () => {
    expect(() =>
      validarOLanzar({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 10 }),
    ).not.toThrow();
  });

  test('throws a user-facing Spanish message for an empty name', () => {
    expect(() => validarOLanzar({ nombre: '', diaCierre: 25, diaVencimiento: 10 })).toThrow(
      'El nombre de la tarjeta es obligatorio.',
    );
  });

  test('throws a user-facing Spanish message for an invalid diaCierre', () => {
    expect(() => validarOLanzar({ nombre: 'Visa', diaCierre: 0, diaVencimiento: 10 })).toThrow(
      'El día de cierre debe ser un número entre 1 y 31.',
    );
  });

  test('throws a user-facing Spanish message for an invalid diaVencimiento', () => {
    expect(() => validarOLanzar({ nombre: 'Visa', diaCierre: 25, diaVencimiento: 32 })).toThrow(
      'El día de vencimiento debe ser un número entre 1 y 31.',
    );
  });

  test('never leaks an internal error code like NOMBRE_REQUERIDO', () => {
    try {
      validarOLanzar({ nombre: '', diaCierre: 0, diaVencimiento: 0 });
      throw new Error('expected validarOLanzar to throw');
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      expect(mensaje).not.toMatch(/NOMBRE_REQUERIDO|DIA_CIERRE_INVALIDO|DIA_VENCIMIENTO_INVALIDO/);
    }
  });

  test('joins every failing rule into a single message, in order', () => {
    expect(() => validarOLanzar({ nombre: '', diaCierre: 0, diaVencimiento: 32 })).toThrow(
      'El nombre de la tarjeta es obligatorio. El día de cierre debe ser un número entre 1 y 31. El día de vencimiento debe ser un número entre 1 y 31.',
    );
  });
});
