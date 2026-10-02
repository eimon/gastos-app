import { Centavos } from './dinero';
import { estadoDePago } from './pagos';
import { FechaISO, parsearFechaISO } from './vencimientos';

export interface Mes {
  mes: number; // 1-12
  año: number;
}

export interface Pendiente {
  montoCents: Centavos;
  pagos: Centavos[];
  fechaVencimiento: FechaISO;
}

export interface LineaSaldo {
  delMesCents: Centavos;
  vencidoCents: Centavos;
  totalCents: Centavos;
}

type ClaseDeMes = 'delMes' | 'vencido' | 'futuro';

/**
 * Classifies a due date relative to the selected month:
 * - `delMes`: due within the selected month.
 * - `vencido`: due before the first day of the selected month (overdue,
 *   carried forward).
 * - `futuro`: due after the selected month (excluded from Resumen).
 */
function claseDeMes(fechaVencimiento: FechaISO, m: Mes): ClaseDeMes {
  const { anio, mes } = parsearFechaISO(fechaVencimiento);
  if (anio === m.año && mes === m.mes) {
    return 'delMes';
  }
  if (anio < m.año || (anio === m.año && mes < m.mes)) {
    return 'vencido';
  }
  return 'futuro';
}

function montoPendiente(item: Pendiente): Centavos {
  return estadoDePago(item.montoCents, item.pagos).restante;
}

export interface TarjetaCuota {
  tarjetaId: string;
  montoCents: Centavos;
  fechaVencimiento: FechaISO;
}

/** Sums cuotas due in the selected month, grouped by card. */
export function totalesPorTarjeta(
  cuotas: TarjetaCuota[],
  m: Mes,
): { tarjetaId: string; totalCents: Centavos }[] {
  const totales = new Map<string, Centavos>();

  for (const cuota of cuotas) {
    if (claseDeMes(cuota.fechaVencimiento, m) !== 'delMes') {
      continue;
    }
    totales.set(cuota.tarjetaId, (totales.get(cuota.tarjetaId) ?? 0) + cuota.montoCents);
  }

  return Array.from(totales.entries()).map(([tarjetaId, totalCents]) => ({ tarjetaId, totalCents }));
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/**
 * Groups pending items by a normalized (trimmed, case-insensitive) key
 * so "Juan", " juan " and "JUAN" merge into one entry. The DISPLAY name
 * kept for the merged entry is the FIRST variant seen (trimmed only,
 * casing preserved) — later variants only contribute their amounts.
 */
function agruparPendientesPorNombre<T extends Pendiente>(
  items: T[],
  m: Mes,
  obtenerNombre: (item: T) => string,
): Map<string, { nombreOriginal: string; linea: LineaSaldo }> {
  const grupos = new Map<string, { nombreOriginal: string; linea: LineaSaldo }>();

  for (const item of items) {
    const monto = montoPendiente(item);
    if (monto <= 0) {
      continue; // fully paid — excluded
    }

    const clase = claseDeMes(item.fechaVencimiento, m);
    if (clase === 'futuro') {
      continue;
    }

    const nombre = obtenerNombre(item);
    const clave = normalizarNombre(nombre);
    const grupo = grupos.get(clave) ?? {
      nombreOriginal: nombre.trim(),
      linea: { delMesCents: 0, vencidoCents: 0, totalCents: 0 },
    };

    if (clase === 'delMes') {
      grupo.linea.delMesCents += monto;
    } else {
      grupo.linea.vencidoCents += monto;
    }
    grupo.linea.totalCents = grupo.linea.delMesCents + grupo.linea.vencidoCents;

    grupos.set(clave, grupo);
  }

  return grupos;
}

/**
 * "Me deben": pending participant repayments due in the selected month
 * plus any unpaid repayments from earlier months (marked `vencidoCents`),
 * grouped by person (trimmed, case-insensitive name).
 */
export function cobrosPorPersona(
  partes: (Pendiente & { nombre: string })[],
  m: Mes,
): (LineaSaldo & { nombre: string })[] {
  const grupos = agruparPendientesPorNombre(partes, m, (parte) => parte.nombre);
  return Array.from(grupos.values()).map(({ nombreOriginal, linea }) => ({
    nombre: nombreOriginal,
    ...linea,
  }));
}

/**
 * "Debo": pending Deuda cuotas due in the selected month plus any
 * unpaid cuotas from earlier months (marked `vencidoCents`), grouped by
 * acreedor (trimmed, case-insensitive name).
 */
export function deudasPorAcreedor(
  cuotas: (Pendiente & { acreedor: string })[],
  m: Mes,
): (LineaSaldo & { acreedor: string })[] {
  const grupos = agruparPendientesPorNombre(cuotas, m, (cuota) => cuota.acreedor);
  return Array.from(grupos.values()).map(({ nombreOriginal, linea }) => ({
    acreedor: nombreOriginal,
    ...linea,
  }));
}

/**
 * "Gastos del mes": total personal vs. shared amounts. `partes` MUST
 * already be filtered to the user's own shares due in the selected
 * month (personal gastos + the user's own share of shared gastos) —
 * this function does not filter by month or by participant.
 */
export function totalesGastosUsuario(
  partes: { tipo: 'personal' | 'compartido'; montoCents: Centavos }[],
): { personalCents: Centavos; compartidoCents: Centavos } {
  return partes.reduce(
    (acc, parte) => {
      if (parte.tipo === 'personal') {
        acc.personalCents += parte.montoCents;
      } else {
        acc.compartidoCents += parte.montoCents;
      }
      return acc;
    },
    { personalCents: 0, compartidoCents: 0 },
  );
}
