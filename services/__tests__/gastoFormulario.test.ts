import {
  aCentavos,
  construirInputCrear,
  erroresVisibles,
  esFechaISOValida,
  evaluarFormulario,
  parsearParticipantes,
  type ValoresGastoForm,
} from '../gastoFormulario';

const tarjeta = { id: 't1', diaCierre: 25, diaVencimiento: 5 };

const base: ValoresGastoForm = {
  descripcion: 'Heladera',
  fechaCompra: '2026-10-10',
  monto: 300,
  descuento: null,
  tipo: 'personal',
  tipoDescuento: 'uniforme',
  cuotas: '1',
  tarjetaId: null,
  participantes: '',
};

describe('helpers', () => {
  test('aCentavos rounds to integer cents and treats null as 0', () => {
    expect(aCentavos(10.5)).toBe(1050);
    expect(aCentavos(0.29)).toBe(29);
    expect(aCentavos(null)).toBe(0);
  });

  test('parsearParticipantes trims and drops empty names', () => {
    expect(parsearParticipantes(' Ana, Luis ,, \nMar ')).toEqual(['Ana', 'Luis', 'Mar']);
  });

  test('esFechaISOValida rejects malformed and impossible dates', () => {
    expect(esFechaISOValida('2026-02-28')).toBe(true);
    expect(esFechaISOValida('2026-02-30')).toBe(false);
    expect(esFechaISOValida('10/10/2026')).toBe(false);
  });
});

describe('evaluarFormulario', () => {
  test('a personal gasto in 1 cuota without a card is valid and previews one cuota due on the purchase date', () => {
    const { errores, plan } = evaluarFormulario(base, []);
    expect(errores).toEqual([]);
    expect(plan?.cuotas).toEqual([
      { numero: 1, montoCents: 30000, fechaCierre: null, fechaVencimiento: '2026-10-10' },
    ]);
  });

  test('more than 1 cuota without a card is rejected and has no preview', () => {
    const { errores, plan } = evaluarFormulario({ ...base, cuotas: '3' }, [tarjeta]);
    expect(errores).toEqual(['TARJETA_REQUERIDA']);
    expect(plan).toBeNull();
  });

  test('3 cuotas with a card previews one due date per cuota, prorrateo discount and last-cuota rounding', () => {
    const { errores, plan } = evaluarFormulario(
      { ...base, monto: 100, descuento: 10, tipoDescuento: 'prorrateo', cuotas: '3', tarjetaId: 't1' },
      [tarjeta],
    );
    expect(errores).toEqual([]);
    expect(plan?.cuotas.map((c) => c.montoCents).reduce((a, b) => a + b, 0)).toBe(9000);
    expect(plan?.cuotas.map((c) => c.fechaVencimiento)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05']);
  });

  test('a discount equal to or above the total is rejected', () => {
    expect(evaluarFormulario({ ...base, descuento: 300 }, []).errores).toEqual(['DESCUENTO_INVALIDO']);
    expect(evaluarFormulario({ ...base, descuento: 400 }, []).errores).toEqual(['DESCUENTO_INVALIDO']);
  });

  test('a shared gasto needs at least one participant', () => {
    expect(evaluarFormulario({ ...base, tipo: 'compartido' }, []).errores).toEqual(['SIN_PARTICIPANTES']);
    expect(evaluarFormulario({ ...base, tipo: 'compartido', participantes: 'Ana, Luis' }, []).errores).toEqual([]);
  });

  test('reports a missing description, an invalid date and an invalid cuota count without planning', () => {
    const { errores, plan } = evaluarFormulario(
      { ...base, descripcion: '  ', fechaCompra: '2026-13-01', cuotas: '' },
      [],
    );
    expect(errores).toEqual(['DESCRIPCION_REQUERIDA', 'FECHA_INVALIDA', 'CUOTAS_INVALIDA']);
    expect(plan).toBeNull();
  });

  test('an id that is not an active card counts as no card', () => {
    expect(evaluarFormulario({ ...base, cuotas: '2', tarjetaId: 'archivada' }, [tarjeta]).errores).toEqual([
      'TARJETA_REQUERIDA',
    ]);
  });
});

describe('construirInputCrear', () => {
  test('converts to cents, drops the discount type without a discount and ignores participants for personal', () => {
    const input = construirInputCrear({ ...base, descripcion: ' Heladera ', monto: 12.34, participantes: 'Ana' });
    expect(input).toMatchObject({
      descripcion: 'Heladera',
      montoTotalCents: 1234,
      descuentoCents: 0,
      tipoDescuento: null,
      participantes: [],
    });
  });
});

describe('erroresVisibles', () => {
  test('hides not-yet-relevant errors before the first save attempt and shows all after it', () => {
    const vacio: ValoresGastoForm = { ...base, descripcion: '', monto: null };
    const errores = evaluarFormulario(vacio, []).errores;
    expect(erroresVisibles(errores, vacio, false)).toEqual([]);
    expect(erroresVisibles(errores, vacio, true)).toEqual(errores);
  });

  test('shows a too-large discount live once amount and discount are typed', () => {
    const valores = { ...base, descuento: 500 };
    expect(erroresVisibles(evaluarFormulario(valores, []).errores, valores, false)).toEqual(['DESCUENTO_INVALIDO']);
  });
});
