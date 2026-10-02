import { compararNombres, ordenarPorVencimientoYNombre } from '../orden';

describe('compararNombres', () => {
  test('sorts with the Spanish locale, ignoring case and accents (binary order would put Zeta before Ángel)', () => {
    const nombres = ['beta', 'Zeta', 'Ángel', 'álvaro'];
    expect([...nombres].sort()).not.toEqual(['álvaro', 'Ángel', 'beta', 'Zeta']);
    expect([...nombres].sort(compararNombres)).toEqual(['álvaro', 'Ángel', 'beta', 'Zeta']);
  });
});

test('the Spanish alphabet puts ñ after n (an English collation would put it before "nube")', () => {
  expect(['oso', 'ñandú', 'nube'].sort(compararNombres)).toEqual(['nube', 'ñandú', 'oso']);
});

describe('ordenarPorVencimientoYNombre', () => {
  const fila = (fechaVencimiento: string, nombre: string, numero = 1) => ({ fechaVencimiento, nombre, numero });

  test('the due date stays the primary order; the name only breaks ties within a date', () => {
    const ordenadas = ordenarPorVencimientoYNombre(
      [fila('2026-02-01', 'Álvaro'), fila('2026-01-31', 'Zeta'), fila('2026-01-31', 'ángel'), fila('2026-01-31', 'beta')],
      (f) => f.nombre,
    );
    expect(ordenadas.map((f) => `${f.fechaVencimiento} ${f.nombre}`)).toEqual([
      '2026-01-31 ángel',
      '2026-01-31 beta',
      '2026-01-31 Zeta',
      '2026-02-01 Álvaro',
    ]);
  });

  test('the cuota number breaks a tie between the same name and date, and the input is not mutated', () => {
    const entrada = [fila('2026-01-31', 'Banco', 2), fila('2026-01-31', 'banco', 1)];
    expect(ordenarPorVencimientoYNombre(entrada, (f) => f.nombre).map((f) => f.numero)).toEqual([1, 2]);
    expect(entrada.map((f) => f.numero)).toEqual([2, 1]);
  });
});
