import type { GastoConDetalle } from '../../data/repositories/gastosRepo';
import {
  armarDetalleGasto,
  contarPagos,
  etiquetaTipoDescuento,
  formatearFecha,
  formatearMonto,
  mesDeFecha,
  nombreMes,
  primerVencimiento,
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

const pago = (id: string, montoCents: number) => ({ id, montoCents, fecha: '2026-11-05', medioPago: 'efectivo' as const });

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
    const resultado = armarDetalleGasto(detalle, { s1: [pago('x1', 200)], s2: [] }, 'Visa');
    const [ana, yo] = resultado.cuotas[0].partes;
    expect(resultado.tarjetaNombre).toBe('Visa');
    expect(ana).toMatchObject({ nombre: 'Ana', esUsuario: false });
    expect(ana.resumen).toEqual({ pagado: 200, restante: 300, estado: 'parcial' });
    expect(yo).toMatchObject({ nombre: 'Yo', esUsuario: true, resumen: null, pagos: [] });
    expect(ana.pagos).toEqual([pago('x1', 200)]);
  });

  test('contarPagos adds the live pagos of every share', () => {
    const conPagos = armarDetalleGasto(detalle, { s1: [pago('x1', 100), pago('x2', 100)], s2: [] }, null);

    expect(contarPagos(conPagos)).toBe(2);
    expect(contarPagos(armarDetalleGasto(detalle, {}, null))).toBe(0);
  });
});

describe('etiquetaTipoDescuento', () => {
  test('maps the stored enum to a Spanish label', () => {
    expect(etiquetaTipoDescuento('uniforme')).toBe('Uniforme');
    expect(etiquetaTipoDescuento('prorrateo')).toBe('Prorrateo');
    expect(etiquetaTipoDescuento(null)).toBe('');
  });
});

describe('month of a new item', () => {
  test('mesDeFecha reads the month and year of an ISO date', () => {
    expect(mesDeFecha('2027-03-31')).toEqual({ mes: 3, año: 2027 });
    expect(mesDeFecha('2026-12-01')).toEqual({ mes: 12, año: 2026 });
  });

  test('primerVencimiento is the earliest cuota due date whatever the order', () => {
    const cuotas = [{ fechaVencimiento: '2027-02-28' }, { fechaVencimiento: '2026-12-31' }, { fechaVencimiento: '2027-01-31' }];
    expect(primerVencimiento(cuotas)).toBe('2026-12-31');
  });
});
