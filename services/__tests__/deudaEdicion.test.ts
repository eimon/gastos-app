import type { DeudaConCuotas } from '../../data/repositories/deudasRepo';
import { esErrorDeReglas } from '../errorDominio';
import {
  DeudaRechazadaError,
  construirEdicionDeuda,
  exigirDeudaValida,
  exigirSinPagos,
  exigirTextos,
  nucleoDeudaSinCambios,
} from '../deudaEdicion';

// Stored dates deliberately differ from what the plan would compute, to prove they are kept.
const guardada = {
  deuda: { acreedor: 'Banco X', descripcion: 'Préstamo', montoTotalCents: 90_000, cantidadCuotas: 3, fechaPrimerPago: '2026-01-15' },
  cuotas: [
    { numero: 1, montoCents: 30_000, fechaVencimiento: '2026-01-16' },
    { numero: 2, montoCents: 30_000, fechaVencimiento: '2026-02-16' },
    { numero: 3, montoCents: 30_000, fechaVencimiento: '2026-03-16' },
  ],
} as unknown as DeudaConCuotas;

const input = (cambios = {}) => ({
  acreedor: 'Banco X',
  descripcion: 'Préstamo',
  montoTotalCents: 90_000,
  cuotas: 3,
  fechaPrimerPago: '2026-01-15',
  ...cambios,
});

function capturar(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe('rules errors', () => {
  test('are recognized by code, not by instanceof, and carry a Spanish message', () => {
    const err = capturar(() => exigirSinPagos(true, 'ELIMINAR_CON_PAGOS'));
    expect(esErrorDeReglas(err)).toBe(true);
    expect((err as DeudaRechazadaError).codigos).toEqual(['ELIMINAR_CON_PAGOS']);
    expect((err as Error).message).toContain('anular los pagos');
  });

  test('exigirSinPagos lets a deuda without pagos through', () => {
    expect(() => exigirSinPagos(false, 'BLOQUEADO_POR_PAGO')).not.toThrow();
  });
});

describe('exigirTextos', () => {
  test('returns both texts trimmed', () => {
    expect(exigirTextos({ acreedor: ' Ana ', descripcion: ' Moto ' })).toEqual({ acreedor: 'Ana', descripcion: 'Moto' });
  });

  test('reports every blank text before any branch can write it', () => {
    const err = capturar(() => exigirTextos({ acreedor: ' ', descripcion: '' })) as DeudaRechazadaError;
    expect(err.codigos).toEqual(['ACREEDOR_REQUERIDO', 'DESCRIPCION_REQUERIDA']);
  });
});

test('exigirDeudaValida throws the domain codes as a rules error', () => {
  const err = capturar(() => exigirDeudaValida(input({ cuotas: 0, montoTotalCents: 0 }))) as DeudaRechazadaError;
  expect(err.codigos).toEqual(['MONTO_INVALIDO', 'CUOTAS_INVALIDA']);
  expect(() => exigirDeudaValida(input())).not.toThrow();
});

describe('nucleoDeudaSinCambios', () => {
  test('is true only when amount, cuotas and first payment date all match', () => {
    const nucleo = { montoTotalCents: 90_000, cuotas: 3, fechaPrimerPago: '2026-01-15' };
    expect(nucleoDeudaSinCambios(guardada, nucleo)).toBe(true);
    expect(nucleoDeudaSinCambios(guardada, { ...nucleo, montoTotalCents: 90_001 })).toBe(false);
    expect(nucleoDeudaSinCambios(guardada, { ...nucleo, cuotas: 4 })).toBe(false);
    expect(nucleoDeudaSinCambios(guardada, { ...nucleo, fechaPrimerPago: '2026-01-16' })).toBe(false);
  });
});

describe('construirEdicionDeuda', () => {
  test('a new amount alone recomputes the amounts but KEEPS the stored due dates', () => {
    const edicion = construirEdicionDeuda(guardada, input({ montoTotalCents: 100_000 }));
    expect(edicion.cuotas).toEqual([
      { numero: 1, montoCents: 33_333, fechaVencimiento: '2026-01-16' },
      { numero: 2, montoCents: 33_333, fechaVencimiento: '2026-02-16' },
      { numero: 3, montoCents: 33_334, fechaVencimiento: '2026-03-16' },
    ]);
  });

  test('a new first payment date recomputes the due dates', () => {
    const edicion = construirEdicionDeuda(guardada, input({ fechaPrimerPago: '2026-01-31' }));
    expect(edicion.cuotas.map((c) => c.fechaVencimiento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  test('a new cuota count recomputes the due dates and the amounts', () => {
    const edicion = construirEdicionDeuda(guardada, input({ cuotas: 2 }));
    expect(edicion.cantidadCuotas).toBe(2);
    expect(edicion.cuotas).toEqual([
      { numero: 1, montoCents: 45_000, fechaVencimiento: '2026-01-15' },
      { numero: 2, montoCents: 45_000, fechaVencimiento: '2026-02-15' },
    ]);
  });
});
