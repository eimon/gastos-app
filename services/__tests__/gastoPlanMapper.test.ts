import { planificarGasto } from '../../domain/gasto';
import { construirCuotasRepo, construirParticipantes } from '../gastoPlanMapper';

describe('construirParticipantes', () => {
  test('personal gasto: only the user, marked esUsuario', () => {
    const participantes = construirParticipantes({ tipo: 'personal', participantes: [] });

    expect(participantes).toEqual([{ nombre: 'Yo', esUsuario: true }]);
  });

  test('shared gasto: other participants first, the payer LAST', () => {
    const participantes = construirParticipantes({
      tipo: 'compartido',
      participantes: ['Juan', 'Pedro'],
    });

    expect(participantes).toEqual([
      { nombre: 'Juan', esUsuario: false },
      { nombre: 'Pedro', esUsuario: false },
      { nombre: 'Yo', esUsuario: true },
    ]);
  });

  test('honors a custom display name for the user', () => {
    const participantes = construirParticipantes({
      tipo: 'compartido',
      participantes: ['Juan'],
      nombreUsuario: 'Amon',
    });

    expect(participantes[participantes.length - 1]).toEqual({ nombre: 'Amon', esUsuario: true });
  });
});

describe('construirCuotasRepo', () => {
  test('splits each planned cuota amount across all participant shares, payer absorbs leftover cents', () => {
    const plan = planificarGasto({
      tipo: 'compartido',
      fechaCompra: '2026-03-10',
      montoTotalCents: 100_000_00,
      descuentoCents: 0,
      tipoDescuento: null,
      cuotas: 1,
      tarjeta: null,
      participantes: ['Juan', 'Pedro'],
    });

    const [cuota] = construirCuotasRepo(plan, 3);

    expect(cuota.partes).toEqual([33_333_33, 33_333_33, 33_333_34]);
  });

  test('preserves cuota numero/montoCents/fechaVencimiento from the plan', () => {
    const plan = planificarGasto({
      tipo: 'personal',
      fechaCompra: '2026-01-01',
      montoTotalCents: 90_000_00,
      descuentoCents: 0,
      tipoDescuento: null,
      cuotas: 1,
      tarjeta: null,
      participantes: [],
    });

    const [cuota] = construirCuotasRepo(plan, 1);

    expect(cuota).toMatchObject({
      numero: 1,
      montoCents: 90_000_00,
      fechaVencimiento: '2026-01-01',
      partes: [90_000_00],
    });
  });
});
