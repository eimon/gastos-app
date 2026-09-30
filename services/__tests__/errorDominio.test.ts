import { esErrorDeReglas, restanteDeError } from '../errorDominio';

function errorConCodigos(codigos: unknown, restanteCents?: unknown): Error {
  return Object.assign(new Error('rechazado'), { codigos, restanteCents });
}

describe('esErrorDeReglas', () => {
  test('recognizes an error with string codes', () => {
    expect(esErrorDeReglas(errorConCodigos(['YA_PAGADO']))).toBe(true);
  });

  test.each([
    ['a plain error', new Error('x')],
    ['an empty code list', errorConCodigos([])],
    ['non-string codes', errorConCodigos([1])],
    ['a non-error object', { codigos: ['A'] }],
    ['null', null],
  ])('rejects %s', (_nombre, valor) => {
    expect(esErrorDeReglas(valor)).toBe(false);
  });
});

describe('restanteDeError', () => {
  test('returns the fresh remaining amount when the error reports one', () => {
    expect(restanteDeError(errorConCodigos(['EXCEDE_RESTANTE'], 1500))).toBe(1500);
  });

  test('returns undefined when missing or not a number', () => {
    expect(restanteDeError(errorConCodigos(['ES_USUARIO']))).toBeUndefined();
    expect(restanteDeError(errorConCodigos(['ES_USUARIO'], '10'))).toBeUndefined();
    expect(restanteDeError(new Error('x'))).toBeUndefined();
  });
});
