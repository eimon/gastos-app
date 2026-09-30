import type { GastoConDetalle } from '../../data/repositories/gastosRepo';
import {
  armarDetalleGasto,
  etiquetaTipoDescuento,
  formatearFecha,
  formatearMonto,
  nombreMes,
  rangoDelMes,
} from '../gastoVista';

describe('formatters', () => {
  test('rangoDelMes returns the first and last day, including leap years', () => {
    expect(rangoDelMes(10, 2026)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoDelMes(2, 2028)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });

  test('formatearMonto groups thousands and always shows two decimals', () => {
    expect(formatearMonto(123456)).toBe('$ 1.234,56');
    expect(formatearMonto(5)).toBe('$ 0,05');
    expect(formatearMonto(100000000)).toBe('$ 1.000.000,00');
  });

  test('formatearFecha and nombreMes', () => {
    expect(formatearFecha('2026-11-05')).toBe('05/11/2026');
    expect(nombreMes(1, 2027)).toBe('Enero 2027');
  });
});

describe('armarDetalleGasto', () => {
  const detalle = {
    gasto: { id: 'g1' },
    participantes: [
      { id: 'p1', nombre: 'Ana', esUsuario: false, orden: 0 },
      { id: 'p2', nombre: 'Yo', esUsuario: true, orden: 1 },
    ],
    cuotas: [
      {
        numero: 1,
        montoCents: 1001,
        fechaVencimiento: '2026-11-05',
        // Read order deliberately differs from participant order.
        partes: [
          { id: 's2', participanteId: 'p2', montoCents: 501 },
          { id: 's1', participanteId: 'p1', montoCents: 500 },
        ],
      },
    ],
  } as unknown as GastoConDetalle;

  test('orders shares by participant order, derives status for others and none for the user', () => {
    const resultado = armarDetalleGasto(detalle, { s1: [200], s2: [] }, 'Visa');
    const [ana, yo] = resultado.cuotas[0].partes;
    expect(resultado.tarjetaNombre).toBe('Visa');
    expect(ana).toMatchObject({ nombre: 'Ana', esUsuario: false });
    expect(ana.resumen).toEqual({ pagado: 200, restante: 300, estado: 'parcial' });
    expect(yo).toMatchObject({ nombre: 'Yo', esUsuario: true, resumen: null });
  });
});

describe('etiquetaTipoDescuento', () => {
  test('maps the stored enum to a Spanish label', () => {
    expect(etiquetaTipoDescuento('uniforme')).toBe('Uniforme');
    expect(etiquetaTipoDescuento('prorrateo')).toBe('Prorrateo');
    expect(etiquetaTipoDescuento(null)).toBe('');
  });
});
