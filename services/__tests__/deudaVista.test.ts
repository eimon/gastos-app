import type { DeudaConCuotas } from '../../data/repositories/deudasRepo';
import { armarDetalleDeuda, armarFilasDeudaMes, contarPagosDeuda } from '../deudaVista';

const fila = (pagadoCents: number) => ({
  deudaId: 'd1',
  acreedor: 'Banco X',
  descripcion: 'Préstamo',
  cantidadCuotas: 3,
  numero: 1,
  montoCents: 30_000,
  fechaVencimiento: '2026-01-15',
  pagadoCents,
});

test('a month row is pendiente, parcial or pagado according to its live pagos', () => {
  const [pendiente, parcial, pagado] = armarFilasDeudaMes([fila(0), fila(10_000), fila(30_000)]);
  expect(pendiente.resumen).toEqual({ pagado: 0, restante: 30_000, estado: 'pendiente' });
  expect(parcial.resumen).toEqual({ pagado: 10_000, restante: 20_000, estado: 'parcial' });
  expect(pagado.resumen).toEqual({ pagado: 30_000, restante: 0, estado: 'pagado' });
});

describe('armarDetalleDeuda', () => {
  const conCuotas = {
    deuda: { id: 'd1', montoTotalCents: 60_000 },
    cuotas: [
      { id: 'c1', numero: 1, montoCents: 30_000, fechaVencimiento: '2026-01-15' },
      { id: 'c2', numero: 2, montoCents: 30_000, fechaVencimiento: '2026-02-15' },
    ],
  } as unknown as DeudaConCuotas;
  const pago = (id: string, montoCents: number) => ({ id, montoCents, fecha: '2026-01-20', medioPago: 'efectivo' as const });

  test('derives each cuota status and the whole-deuda totals from the pagos', () => {
    const detalle = armarDetalleDeuda(conCuotas, { c1: [pago('p1', 10_000), pago('p2', 20_000)], c2: [pago('p3', 5_000)] });
    expect(detalle.cuotas.map((c) => c.resumen.estado)).toEqual(['pagado', 'parcial']);
    expect(detalle.resumen).toEqual({ pagado: 35_000, restante: 25_000, estado: 'parcial' });
    expect(contarPagosDeuda(detalle)).toBe(3);
  });

  test('a deuda without pagos is pendiente and has none to count', () => {
    const detalle = armarDetalleDeuda(conCuotas, {});
    expect(detalle.resumen.estado).toBe('pendiente');
    expect(contarPagosDeuda(detalle)).toBe(0);
  });
});
