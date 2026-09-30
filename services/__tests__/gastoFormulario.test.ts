import {
  aCentavos,
  construirInputCrear,
  erroresVisibles,
  MENSAJES_ERROR_GASTO,
  esFechaISOValida,
  evaluarFormulario,
  esRepartoPersonalizado,
  siguienteIdFila,
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
  participantes: [],
  modoReparto: 'iguales',
  montoUsuario: null,
};

const fila = (nombre: string, monto: number | null = null, id = nombre) => ({ id, nombre, monto });

describe('helpers', () => {
  test('aCentavos rounds to integer cents and treats null as 0', () => {
    expect(aCentavos(10.5)).toBe(1050);
    expect(aCentavos(0.29)).toBe(29);
    expect(aCentavos(null)).toBe(0);
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
    const tres = { ...base, cuotas: '3', tarjetaId: 't1' };
    expect(evaluarFormulario({ ...tres, descuento: 300 }, [tarjeta]).errores).toEqual(['DESCUENTO_INVALIDO']);
    expect(evaluarFormulario({ ...tres, descuento: 400 }, [tarjeta]).errores).toEqual(['DESCUENTO_INVALIDO']);
  });

  test('with 1 cuota a stale discount is ignored instead of applied', () => {
    const input = construirInputCrear({ ...base, descuento: 50 });
    expect(input).toMatchObject({ descuentoCents: 0, tipoDescuento: null });
    expect(evaluarFormulario({ ...base, descuento: 50 }, []).errores).toEqual([]);
  });

  test('a shared gasto needs at least one participant', () => {
    expect(evaluarFormulario({ ...base, tipo: 'compartido' }, []).errores).toEqual(['SIN_PARTICIPANTES']);
    expect(
      evaluarFormulario({ ...base, tipo: 'compartido', participantes: [fila('Ana'), fila('Luis')] }, []).errores,
    ).toEqual([]);
  });

  test('rejects empty and duplicate participant names (trimmed, case-insensitive, including "Yo")', () => {
    const conFilas = (...nombres: string[]) => ({ ...base, tipo: 'compartido' as const, participantes: nombres.map((n, i) => fila(n, null, String(i))) });
    expect(evaluarFormulario(conFilas('Ana', '  '), []).errores).toEqual(['PARTICIPANTE_VACIO']);
    expect(evaluarFormulario(conFilas('Ana', ' ana '), []).errores).toEqual(['PARTICIPANTE_DUPLICADO']);
    expect(evaluarFormulario(conFilas('yo'), []).errores).toEqual(['PARTICIPANTE_DUPLICADO']);
  });

  describe('custom amounts (shared, 1 cuota)', () => {
    const personalizado = {
      ...base,
      tipo: 'compartido' as const,
      modoReparto: 'personalizado' as const,
      monto: null,
      participantes: [fila('Ana', 30), fila('Luis', 20.5)],
      montoUsuario: 10,
    };

    test('the total is the sum of the amounts, the cuota shows it and each share is listed with the user last', () => {
      const { errores, plan, partes } = evaluarFormulario(personalizado, []);
      expect(errores).toEqual([]);
      expect(plan?.cuotas[0].montoCents).toBe(6050);
      expect(partes).toEqual([
        { nombre: 'Ana', montoCents: 3000 },
        { nombre: 'Luis', montoCents: 2050 },
        { nombre: 'Yo', montoCents: 1000 },
      ]);
      expect(construirInputCrear(personalizado)).toMatchObject({
        montoTotalCents: 6050,
        montosPersonalizadosCents: [3000, 2050, 1000],
      });
    });

    test('the user share may be 0 but another participant at 0 or empty is rejected', () => {
      expect(evaluarFormulario({ ...personalizado, montoUsuario: null }, []).errores).toEqual([]);
      expect(evaluarFormulario({ ...personalizado, participantes: [fila('Ana', 0), fila('Luis', 5)] }, []).errores).toEqual([
        'MONTOS_PERSONALIZADOS_INVALIDOS',
      ]);
      expect(evaluarFormulario({ ...personalizado, participantes: [fila('Ana', null)] }, []).errores).toEqual([
        'MONTOS_PERSONALIZADOS_INVALIDOS',
      ]);
    });

    test('a zero total is rejected', () => {
      expect(evaluarFormulario({ ...personalizado, participantes: [], montoUsuario: 0 }, []).errores).toContain('MONTO_INVALIDO');
    });

    test('with more than 1 cuota the custom mode does not apply and the equal split is used', () => {
      const tres = { ...personalizado, monto: 90, cuotas: '3', tarjetaId: 't1' };
      expect(esRepartoPersonalizado(tres)).toBe(false);
      const { errores, partes } = evaluarFormulario(tres, [tarjeta]);
      expect(errores).toEqual([]);
      expect(partes).toBeNull();
      expect(construirInputCrear(tres).montosPersonalizadosCents).toBeUndefined();
    });
  });

  test('reports a missing description, an invalid date and an invalid cuota count without planning', () => {
    const { errores, plan } = evaluarFormulario(
      { ...base, descripcion: '  ', fechaCompra: '2026-13-01', cuotas: '' },
      [],
    );
    expect(errores).toEqual(['DESCRIPCION_REQUERIDA', 'FECHA_INVALIDA', 'CUOTAS_INVALIDA']);
    expect(plan).toBeNull();
  });

  test('an absurd cuota count is rejected without planning (no freeze, no RangeError)', () => {
    for (const cuotas of ['361', '300000', '10000000000']) {
      const { errores, plan } = evaluarFormulario({ ...base, cuotas, tarjetaId: 't1' }, [tarjeta]);
      expect(errores).toEqual(['CUOTAS_INVALIDA']);
      expect(plan).toBeNull();
    }
    expect(evaluarFormulario({ ...base, cuotas: '360', tarjetaId: 't1' }, [tarjeta]).errores).toEqual([]);
    expect(MENSAJES_ERROR_GASTO.CUOTAS_INVALIDA).toContain('360');
  });

  test('an untouched form reports only the missing amount and description, never a discount error', () => {
    const vacio: ValoresGastoForm = { ...base, descripcion: '', monto: null };
    expect(evaluarFormulario(vacio, []).errores).toEqual(['DESCRIPCION_REQUERIDA', 'MONTO_INVALIDO']);
  });

  test('a custom form with every amount empty reports no discount error', () => {
    const errores = evaluarFormulario(
      { ...base, tipo: 'compartido', modoReparto: 'personalizado', monto: null, participantes: [fila('Ana')] },
      [],
    ).errores;
    expect(errores).not.toContain('DESCUENTO_INVALIDO');
    expect(errores).toEqual(['MONTO_INVALIDO', 'MONTOS_PERSONALIZADOS_INVALIDOS']);
  });

  test('an id that is not an active card counts as no card', () => {
    expect(evaluarFormulario({ ...base, cuotas: '2', tarjetaId: 'archivada' }, [tarjeta]).errores).toEqual([
      'TARJETA_REQUERIDA',
    ]);
  });
});

describe('construirInputCrear', () => {
  test('converts to cents, drops the discount type without a discount and ignores participants for personal', () => {
    const input = construirInputCrear({ ...base, descripcion: ' Heladera ', monto: 12.34, participantes: [fila('Ana')] });
    expect(input).toMatchObject({
      descripcion: 'Heladera',
      montoTotalCents: 1234,
      descuentoCents: 0,
      tipoDescuento: null,
      participantes: [],
    });
  });
});

describe('siguienteIdFila', () => {
  test('starts at 1 and never repeats an id already in the rows, even after a remount', () => {
    expect(siguienteIdFila([])).toBe('participante-1');
    const filas = [fila('Ana', null, 'participante-1'), fila('Luis', null, 'participante-2')];
    expect(siguienteIdFila(filas)).toBe('participante-3');
    expect(siguienteIdFila([filas[0]])).toBe('participante-2');
    expect(siguienteIdFila([fila('X', null, 'otro'), fila('Y', null, 'participante-7')])).toBe('participante-8');
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
    const valores = { ...base, descuento: 500, cuotas: '3', tarjetaId: 't1' };
    expect(erroresVisibles(evaluarFormulario(valores, [tarjeta]).errores, valores, false)).toEqual(['DESCUENTO_INVALIDO']);
  });
});
