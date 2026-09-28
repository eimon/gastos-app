import { repartirEntreParticipantes } from '../participantes';

describe('repartirEntreParticipantes', () => {
  test('splits a cuota among 2 participants and the payer (last), payer absorbs leftover cents', () => {
    // $100,000.00 cuota split 3 ways: Juan, Pedro, then the payer last.
    const montoCuota = 100_000_00;
    const [juan, pedro, usuario] = repartirEntreParticipantes(montoCuota, 3);

    expect(juan).toBe(33_333_33);
    expect(pedro).toBe(33_333_33);
    expect(usuario).toBe(33_333_34);
  });
});
