import { aFechaISOLocal, deFechaISOLocal } from '../fechaLocal';

describe('fechaLocal', () => {
  test('uses the local calendar day, even late at night', () => {
    expect(aFechaISOLocal(new Date(2026, 0, 31, 23, 45))).toBe('2026-01-31');
    expect(aFechaISOLocal(new Date(2026, 11, 1, 0, 5))).toBe('2026-12-01');
  });

  test('pads month and day', () => {
    expect(aFechaISOLocal(new Date(2026, 2, 5, 12))).toBe('2026-03-05');
  });

  test('round-trips an ISO date without shifting the day', () => {
    for (const iso of ['2026-01-01', '2026-03-08', '2026-10-25', '2028-02-29', '2026-12-31']) {
      expect(aFechaISOLocal(deFechaISOLocal(iso))).toBe(iso);
    }
  });

  test('falls back to today for text that is not a date', () => {
    expect(aFechaISOLocal(deFechaISOLocal('hoy'))).toBe(aFechaISOLocal(new Date()));
  });
});
