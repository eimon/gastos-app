import { dividirEnPartes } from '../dinero';

describe('dividirEnPartes', () => {
  test('splits evenly across 3 monthly cuotas, remainder goes to the last one', () => {
    // $100,000.00 split into 3 -> $33,333.33, $33,333.33, $33,333.34
    const total = 100_000_00;
    expect(dividirEnPartes(total, 3)).toEqual([33_333_33, 33_333_33, 33_333_34]);
  });
});
