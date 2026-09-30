import type { GastoConDetalle } from '../../data/repositories/gastosRepo';
import {
  GastoRechazadoError,
  construirEdicion,
  conservarVencimientos,
  exigirSinPagos,
  nucleoSinCambios,
  valoresDesdeDetalle,
  type NucleoGasto,
} from '../gastoEdicion';

const VISA = { id: 't1', diaCierre: 25, diaVencimiento: 5 };
const MASTER = { id: 't2', diaCierre: 10, diaVencimiento: 20 };

// A 2-cuota personal gasto on "Visa" whose stored dates deliberately differ
// from what Visa's current days would compute (the card was edited after).
function gastoGuardado(extra: Record<string, unknown> = {}): GastoConDetalle {
  return {
    gasto: {
      descripcion: 'Notebook',
      fechaCompra: '2026-03-20',
      tipo: 'personal',
      montoTotalCents: 200_00,
      descuentoCents: 0,
      tipoDescuento: null,
      cantidadCuotas: 2,
      tarjetaId: 't1',
      ...extra,
    },
    participantes: [{ id: 'p1', nombre: 'Amon', esUsuario: true, orden: 0 }],
    cuotas: [
      { numero: 1, montoCents: 100_00, fechaCierre: '2026-03-01', fechaVencimiento: '2026-03-02', partes: [] },
      { numero: 2, montoCents: 100_00, fechaCierre: '2026-04-01', fechaVencimiento: '2026-04-02', partes: [] },
    ],
  } as unknown as GastoConDetalle;
}

const nucleo = (cambios: Partial<NucleoGasto> = {}): NucleoGasto => ({
  tipo: 'personal',
  fechaCompra: '2026-03-20',
  montoTotalCents: 300_00,
  descuentoCents: 0,
  tipoDescuento: null,
  cuotas: 2,
  tarjetaId: 't1',
  participantes: [],
  ...cambios,
});

describe('construirEdicion: due dates', () => {
  test('keeps the stored dates when only the amount changes', () => {
    const resultado = construirEdicion(gastoGuardado(), 'Notebook', nucleo(), VISA);

    expect(resultado.cuotas.map((c) => c.montoCents)).toEqual([150_00, 150_00]);
    expect(resultado.cuotas.map((c) => c.fechaVencimiento)).toEqual(['2026-03-02', '2026-04-02']);
    expect(resultado.cuotas.map((c) => c.fechaCierre)).toEqual(['2026-03-01', '2026-04-01']);
  });

  test.each([
    ['purchase date', { fechaCompra: '2026-03-26' }, VISA],
    ['cuota count', { cuotas: 3 }, VISA],
    ['card', { tarjetaId: 't2' }, MASTER],
  ])('recomputes the dates when the %s changes', (_nombre, cambios, tarjeta) => {
    const resultado = construirEdicion(gastoGuardado(), 'Notebook', nucleo(cambios), tarjeta);

    expect(resultado.cuotas[0].fechaVencimiento).not.toBe('2026-03-02');
  });

  test('conservarVencimientos leaves a plan without a stored cuota untouched', () => {
    const plan = { cuotas: [{ numero: 9, montoCents: 1, fechaCierre: null, fechaVencimiento: '2027-01-01' }] };

    expect(conservarVencimientos(plan, gastoGuardado(), nucleo())).toEqual(plan);
  });
});

describe('construirEdicion: rules', () => {
  test('rejects a discount when the gasto ends up with 1 cuota', () => {
    const malo = nucleo({ cuotas: 1, tarjetaId: null, descuentoCents: 10_00, tipoDescuento: 'uniforme' });

    expect(() => construirEdicion(gastoGuardado(), 'Notebook', malo, null)).toThrow('DESCUENTO_SOLO_EN_CUOTAS');
  });

  test('rejects a blank description through the domain gate', () => {
    expect(() => construirEdicion(gastoGuardado(), '  ', nucleo(), VISA)).toThrow('DESCRIPCION_REQUERIDA');
  });

  test('requires a card for several cuotas', () => {
    expect(() => construirEdicion(gastoGuardado(), 'Notebook', nucleo({ tarjetaId: null }), null)).toThrow(
      'TARJETA_REQUERIDA',
    );
  });

  test('uses custom amounts for a shared gasto with 1 cuota and keeps the user name', () => {
    const actual = gastoGuardado();
    const resultado = construirEdicion(
      actual,
      ' Cena ',
      nucleo({
        tipo: 'compartido',
        cuotas: 1,
        tarjetaId: null,
        montoTotalCents: 60_00,
        participantes: ['Ana'],
        montosPersonalizadosCents: [45_00, 15_00],
      }),
      null,
    );

    expect(resultado.descripcion).toBe('Cena');
    expect(resultado.participantes).toEqual([
      { nombre: 'Ana', esUsuario: false },
      { nombre: 'Amon', esUsuario: true },
    ]);
    expect(resultado.cuotas[0].partes).toEqual([45_00, 15_00]);
  });
});

describe('valoresDesdeDetalle', () => {
  test('maps a personal gasto with a discount', () => {
    const valores = valoresDesdeDetalle(gastoGuardado({ descuentoCents: 20_00, tipoDescuento: 'prorrateo' }));

    expect(valores).toMatchObject({
      descripcion: 'Notebook',
      monto: 200,
      descuento: 20,
      tipoDescuento: 'prorrateo',
      cuotas: '2',
      tarjetaId: 't1',
      participantes: [],
      modoReparto: 'iguales',
    });
  });

  test('loads a legacy 1-cuota discount as the net price so saving normalizes it', () => {
    const legacy = gastoGuardado({ cantidadCuotas: 1, tarjetaId: null, descuentoCents: 20_00, tipoDescuento: 'uniforme' });
    const valores = valoresDesdeDetalle(legacy);

    expect(valores).toMatchObject({ monto: 180, descuento: null, cuotas: '1' });
  });

  function compartido(montos: [number, number]): GastoConDetalle {
    return {
      gasto: {
        descripcion: 'Cena',
        fechaCompra: '2026-03-20',
        tipo: 'compartido',
        montoTotalCents: 60_00,
        descuentoCents: 0,
        tipoDescuento: null,
        cantidadCuotas: 1,
        tarjetaId: null,
      },
      participantes: [
        { id: 'p1', nombre: 'Ana', esUsuario: false, orden: 0 },
        { id: 'p2', nombre: 'Yo', esUsuario: true, orden: 1 },
      ],
      cuotas: [
        {
          numero: 1,
          montoCents: 60_00,
          partes: [
            { participanteId: 'p2', montoCents: montos[1] },
            { participanteId: 'p1', montoCents: montos[0] },
          ],
        },
      ],
    } as unknown as GastoConDetalle;
  }

  test('detects custom amounts when the shares differ from the equal split', () => {
    const valores = valoresDesdeDetalle(compartido([45_00, 15_00]));

    expect(valores.modoReparto).toBe('personalizado');
    expect(valores.participantes).toEqual([{ id: 'participante-1', nombre: 'Ana', monto: 45 }]);
    expect(valores.montoUsuario).toBe(15);
  });

  test('keeps the equal split when the shares match it', () => {
    const valores = valoresDesdeDetalle(compartido([30_00, 30_00]));

    expect(valores.modoReparto).toBe('iguales');
    expect(valores.participantes).toEqual([{ id: 'participante-1', nombre: 'Ana', monto: null }]);
    expect(valores.montoUsuario).toBeNull();
  });
});

describe('exigirSinPagos', () => {
  test('passes when there are no pagos', () => {
    expect(() => exigirSinPagos(false, 'ELIMINAR_CON_PAGOS')).not.toThrow();
  });

  test('blocks deleting a gasto with pagos and tells the user to cancel them first', () => {
    expect(() => exigirSinPagos(true, 'ELIMINAR_CON_PAGOS')).toThrow(
      'No se puede eliminar un gasto con pagos registrados. Primero hay que anular los pagos.',
    );
  });

  test('blocks core edits with pagos using a coded error', () => {
    try {
      exigirSinPagos(true, 'BLOQUEADO_POR_PAGO');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GastoRechazadoError);
      expect((err as GastoRechazadoError).codigo).toBe('BLOQUEADO_POR_PAGO');
    }
  });
});

describe('nucleoSinCambios', () => {
  function compartidoGuardado(montos: [number, number] = [30_00, 30_00]): GastoConDetalle {
    return {
      gasto: {
        tipo: 'compartido',
        fechaCompra: '2026-03-20',
        montoTotalCents: 60_00,
        descuentoCents: 0,
        tipoDescuento: null,
        cantidadCuotas: 1,
        tarjetaId: null,
      },
      participantes: [
        { id: 'p1', nombre: 'Ana', esUsuario: false, orden: 0 },
        { id: 'p2', nombre: 'Yo', esUsuario: true, orden: 1 },
      ],
      cuotas: [
        {
          numero: 1,
          montoCents: 60_00,
          partes: [
            { participanteId: 'p2', montoCents: montos[1] },
            { participanteId: 'p1', montoCents: montos[0] },
          ],
        },
      ],
    } as unknown as GastoConDetalle;
  }

  const igual = (cambios: Partial<NucleoGasto> = {}): NucleoGasto => ({
    tipo: 'compartido',
    fechaCompra: '2026-03-20',
    montoTotalCents: 60_00,
    descuentoCents: 0,
    tipoDescuento: null,
    cuotas: 1,
    tarjetaId: null,
    participantes: ['Ana'],
    ...cambios,
  });

  test('is true for the stored core, even when the shares come back in another order', () => {
    expect(nucleoSinCambios(compartidoGuardado(), igual())).toBe(true);
  });

  test('is true for stored custom amounts that the form sends back unchanged', () => {
    expect(nucleoSinCambios(compartidoGuardado([45_00, 15_00]), igual({ montosPersonalizadosCents: [45_00, 15_00] }))).toBe(
      true,
    );
  });

  test.each([
    ['amount', { montoTotalCents: 70_00 }],
    ['date', { fechaCompra: '2026-03-21' }],
    ['card', { tarjetaId: 't1' }],
    ['participant name', { participantes: ['Ani'] }],
    ['participant count', { participantes: ['Ana', 'Luis'] }],
    ['custom amounts', { montosPersonalizadosCents: [50_00, 10_00] }],
  ])('is false when the %s changes', (_nombre, cambios) => {
    expect(nucleoSinCambios(compartidoGuardado(), igual(cambios as Partial<NucleoGasto>))).toBe(false);
  });

  test('is false when stored custom shares no longer match an equal-split form', () => {
    expect(nucleoSinCambios(compartidoGuardado([45_00, 15_00]), igual())).toBe(false);
  });
});
