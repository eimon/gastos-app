import { claveDeDeps, esVigente, estaCargando } from '../datosVigentes';

describe('claveDeDeps', () => {
  test('is equal for equal deps and different when the month, the year or the order changes', () => {
    expect(claveDeDeps([4, 2026])).toBe(claveDeDeps([4, 2026]));
    expect(claveDeDeps([4, 2026])).not.toBe(claveDeDeps([5, 2026]));
    expect(claveDeDeps([1, 2027])).not.toBe(claveDeDeps([1, 2026]));
    expect(claveDeDeps([1, 12])).not.toBe(claveDeDeps([12, 1]));
  });

  test('keeps a list without deps constant and does not mix "1,2" with [1, 2]', () => {
    expect(claveDeDeps([])).toBe(claveDeDeps([]));
    expect(claveDeDeps(['1,2'])).not.toBe(claveDeDeps([1, 2]));
  });
});

describe('esVigente', () => {
  test('only data tagged with the current key is current', () => {
    const abril = claveDeDeps([4, 2026]);
    expect(esVigente(abril, abril)).toBe(true);
    expect(esVigente(claveDeDeps([3, 2026]), abril)).toBe(false);
    expect(esVigente(undefined, abril)).toBe(false);
  });
});

describe('estaCargando', () => {
  test('a request in flight is loading, even with current data (a focus reload keeps showing it)', () => {
    expect(estaCargando(true, true, false)).toBe(true);
  });

  test('current data without a request is not loading', () => {
    expect(estaCargando(false, true, false)).toBe(false);
  });

  test('a current error without a request is not loading, so the retry state shows', () => {
    expect(estaCargando(false, false, true)).toBe(false);
  });

  test('no current data and no current error is loading, so there is no flash after a month change', () => {
    expect(estaCargando(false, false, false)).toBe(true);
  });
});
