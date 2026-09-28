import { planificarDeuda } from '../deuda';

describe('planificarDeuda', () => {
  test('generates an equal monthly cuota schedule starting at the first payment date', () => {
    const plan = planificarDeuda({
      acreedor: 'Banco X',
      descripcion: 'Prestamo personal',
      montoTotalCents: 90_000,
      cuotas: 3,
      fechaPrimerPago: '2026-01-15',
    });

    expect(plan.cuotas).toEqual([
      { numero: 1, montoCents: 30_000, fechaVencimiento: '2026-01-15' },
      { numero: 2, montoCents: 30_000, fechaVencimiento: '2026-02-15' },
      { numero: 3, montoCents: 30_000, fechaVencimiento: '2026-03-15' },
    ]);
  });
});
