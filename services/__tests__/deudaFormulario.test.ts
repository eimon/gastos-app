import {
  MENSAJES_ERROR_DEUDA,
  construirInputDeuda,
  erroresVisiblesDeuda,
  evaluarFormularioDeuda,
  resumirPlanDeuda,
  valoresDesdeDeuda,
  valoresInicialesDeuda,
  type ValoresDeudaForm,
} from '../deudaFormulario';
import type { Deuda } from '../../data/repositories/deudasRepo';

const valores = (cambios: Partial<ValoresDeudaForm> = {}): ValoresDeudaForm => ({
  acreedor: ' Banco X ',
  descripcion: 'Préstamo',
  monto: 900,
  cuotas: '3',
  fechaPrimerPago: '2026-01-31',
  ...cambios,
});

describe('construirInputDeuda', () => {
  test('converts the amount to cents and trims the texts', () => {
    expect(construirInputDeuda(valores({ monto: 1234.56 }))).toEqual({
      acreedor: 'Banco X',
      descripcion: 'Préstamo',
      montoTotalCents: 123_456,
      cuotas: 3,
      fechaPrimerPago: '2026-01-31',
    });
  });

  test('an empty cuotas text is NaN so the domain rejects it instead of coercing it to 0', () => {
    expect(construirInputDeuda(valores({ cuotas: '  ' })).cuotas).toBeNaN();
  });
});

describe('evaluarFormularioDeuda', () => {
  test('the untouched form reports every required field and no plan', () => {
    const { errores, plan } = evaluarFormularioDeuda(valoresInicialesDeuda());
    expect(errores).toEqual(['MONTO_INVALIDO', 'ACREEDOR_REQUERIDO', 'DESCRIPCION_REQUERIDA']);
    expect(plan).toBeNull();
  });

  test('a valid form previews equal cuotas, clamped dates and the last cuota absorbing the cents', () => {
    const { errores, plan } = evaluarFormularioDeuda(valores({ monto: 1000, cuotas: '3' }));
    expect(errores).toEqual([]);
    expect(plan?.cuotas).toEqual([
      { numero: 1, montoCents: 33_333, fechaVencimiento: '2026-01-31' },
      { numero: 2, montoCents: 33_333, fechaVencimiento: '2026-02-28' },
      { numero: 3, montoCents: 33_334, fechaVencimiento: '2026-03-31' },
    ]);
  });

  test('rejects cuotas above the maximum with the maximum in the message', () => {
    const { errores } = evaluarFormularioDeuda(valores({ cuotas: '31' }));
    expect(errores).toEqual(['CUOTAS_INVALIDA']);
    expect(MENSAJES_ERROR_DEUDA.CUOTAS_INVALIDA).toContain('30');
  });
});

test('an amount above the cap is rejected with a message that states the maximum', () => {
  expect(evaluarFormularioDeuda(valores({ monto: 10_000_000_000 })).errores).toEqual(['MONTO_EXCESIVO']);
  expect(MENSAJES_ERROR_DEUDA.MONTO_EXCESIVO).toBe('El monto no puede superar $ 9.999.999.999,99.');
});

describe('erroresVisiblesDeuda', () => {
  test('before the first save only date and cuotas errors show; after it, all of them', () => {
    const errores = evaluarFormularioDeuda(valores({ acreedor: '', cuotas: '0' })).errores;
    expect(erroresVisiblesDeuda(errores, false)).toEqual(['CUOTAS_INVALIDA']);
    expect(erroresVisiblesDeuda(errores, true)).toEqual(['CUOTAS_INVALIDA', 'ACREEDOR_REQUERIDO']);
  });
});

test('valoresDesdeDeuda loads a stored deuda back into the form', () => {
  const deuda = { acreedor: 'Ana', descripcion: 'Moto', montoTotalCents: 150_050, cantidadCuotas: 12, fechaPrimerPago: '2026-05-10' };
  expect(valoresDesdeDeuda(deuda as Deuda)).toEqual({
    acreedor: 'Ana',
    descripcion: 'Moto',
    monto: 1500.5,
    cuotas: '12',
    fechaPrimerPago: '2026-05-10',
  });
});

describe('resumirPlanDeuda', () => {
  const plan = (cuotas: number) => evaluarFormularioDeuda(valores({ cuotas: String(cuotas) })).plan!.cuotas;

  test('a short plan is shown in full', () => {
    expect(resumirPlanDeuda(plan(12))).toMatchObject({ ocultas: 0, ultima: null });
    expect(resumirPlanDeuda(plan(12)).primeras).toHaveLength(12);
  });

  test('a long plan shows the first cuotas, the hidden count and always the last cuota', () => {
    const resumen = resumirPlanDeuda(plan(360));
    expect(resumen.primeras).toHaveLength(11);
    expect(resumen.ocultas).toBe(348);
    expect(resumen.ultima?.numero).toBe(360);
  });
});
