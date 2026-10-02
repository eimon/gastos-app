import {
  calcularVencimientosTarjeta,
  calcularVencimientosMensuales,
  clampearDia,
} from '../vencimientos';

describe('calcularVencimientosTarjeta — statement assignment by closing day', () => {
  test('before closing day: purchase belongs to the statement closing this month', () => {
    const [primera] = calcularVencimientosTarjeta(
      '2026-03-20',
      { diaCierre: 25, diaVencimiento: 10 },
      1,
    );
    expect(primera.cierre).toBe('2026-03-25');
  });

  test('on closing day: purchase belongs to the statement closing this month', () => {
    const [primera] = calcularVencimientosTarjeta(
      '2026-03-25',
      { diaCierre: 25, diaVencimiento: 10 },
      1,
    );
    expect(primera.cierre).toBe('2026-03-25');
  });

  test('after closing day: purchase rolls to next month statement', () => {
    const [primera] = calcularVencimientosTarjeta(
      '2026-03-26',
      { diaCierre: 25, diaVencimiento: 10 },
      1,
    );
    expect(primera.cierre).toBe('2026-04-25');
  });
});

describe('calcularVencimientosTarjeta — due date relative to closing day', () => {
  test('due day <= closing day: due date falls the month AFTER closing', () => {
    const [primera] = calcularVencimientosTarjeta(
      '2026-03-01',
      { diaCierre: 25, diaVencimiento: 5 },
      1,
    );
    expect(primera.cierre).toBe('2026-03-25');
    expect(primera.vencimiento).toBe('2026-04-05');
  });

  test('due day > closing day: due date falls the SAME month as closing', () => {
    const [primera] = calcularVencimientosTarjeta(
      '2026-03-01',
      { diaCierre: 5, diaVencimiento: 15 },
      1,
    );
    expect(primera.cierre).toBe('2026-03-05');
    expect(primera.vencimiento).toBe('2026-03-15');
  });
});

describe('calcularVencimientosTarjeta — year rollover', () => {
  test('December closing rolls the due date into January of the next year', () => {
    const [primera] = calcularVencimientosTarjeta(
      '2025-12-20',
      { diaCierre: 25, diaVencimiento: 5 },
      1,
    );
    expect(primera.cierre).toBe('2025-12-25');
    expect(primera.vencimiento).toBe('2026-01-05');
  });
});

describe('clampearDia — day clamping for short months', () => {
  test('31 clamps to Apr 30', () => {
    expect(clampearDia(2026, 4, 31)).toBe(30);
  });

  test('31 clamps to Feb 28 in a non-leap year (2025)', () => {
    expect(clampearDia(2025, 2, 31)).toBe(28);
  });

  test('30 clamps to Feb 29 in a leap year (2024)', () => {
    expect(clampearDia(2024, 2, 30)).toBe(29);
  });
});

describe('calcularVencimientosMensuales', () => {
  test('generates one due date per month starting at the given date', () => {
    expect(calcularVencimientosMensuales('2026-01-15', 3)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
  });

  test('clamps from the ORIGINAL day every month, not the previously clamped day', () => {
    // Day 31 clamps independently each month: Feb has 28 days (2026 is not
    // leap), March has 31, April has 30 — the clamp never "sticks" at 28.
    expect(calcularVencimientosMensuales('2026-01-31', 4)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });
});
