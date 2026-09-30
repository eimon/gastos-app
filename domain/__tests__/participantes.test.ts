import { repartirEntreParticipantes, sumarMontos, validarMontosPersonalizados, validarNombresParticipantes } from '../participantes';

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

describe('validarNombresParticipantes', () => {
  test('accepts distinct names and reports each problem once', () => {
    expect(validarNombresParticipantes(['Ana', 'Luis'])).toEqual([]);
    expect(validarNombresParticipantes(['', ' ', 'Ana', 'ana'])).toEqual(['PARTICIPANTE_VACIO', 'PARTICIPANTE_DUPLICADO']);
  });
});

describe('validarMontosPersonalizados', () => {
  test('others must be > 0, the last (payer) may be 0, all integers, count must match', () => {
    expect(validarMontosPersonalizados([10, 5, 0], 3)).toBe(true);
    expect(validarMontosPersonalizados([10, 0, 5], 3)).toBe(false);
    expect(validarMontosPersonalizados([10, 5], 3)).toBe(false);
    expect(validarMontosPersonalizados([10.5, 5], 2)).toBe(false);
    expect(validarMontosPersonalizados([5], 1)).toBe(false);
    expect(sumarMontos([10, 5, 1])).toBe(16);
  });
});
