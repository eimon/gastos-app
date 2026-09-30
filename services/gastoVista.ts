/**
 * Pure presentation helpers for the gastos screens (month range, money and
 * date formatting, detail view-model). No `data/db/client` import, so they
 * run under Jest; repository types are imported with `import type` only.
 */
import { estadoDePago, type ResumenPago } from '../domain/pagos';
import type { CuotaParticipante, Gasto, GastoConDetalle } from '../data/repositories/gastosRepo';
import type { Pago } from '../data/repositories/pagosRepo';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function nombreMes(mes: number, anio: number): string {
  return `${MESES[mes - 1]} ${anio}`;
}

/** Inclusive first and last calendar day of a month (`mes` is 1-12). */
export function rangoDelMes(mes: number, anio: number): { desde: string; hasta: string } {
  const mesTexto = String(mes).padStart(2, '0');
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { desde: `${anio}-${mesTexto}-01`, hasta: `${anio}-${mesTexto}-${String(ultimoDia).padStart(2, '0')}` };
}

/** `123456` cents -> `$ 1.234,56`. */
export function formatearMonto(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const enteros = String(Math.floor(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimales = String(absoluto % 100).padStart(2, '0');
  return `${signo}$ ${enteros},${decimales}`;
}

/** `2026-11-05` -> `05/11/2026`. */
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

const ETIQUETAS_DESCUENTO: Record<string, string> = { uniforme: 'Uniforme', prorrateo: 'Prorrateo' };

/** Spanish label for the stored discount type; empty when there is none. */
export function etiquetaTipoDescuento(tipo: string | null): string {
  return (tipo && ETIQUETAS_DESCUENTO[tipo]) || '';
}

export type PagoDetalle = Pick<Pago, 'id' | 'montoCents' | 'fecha' | 'medioPago'>;

export interface ParteDetalle {
  id: string;
  nombre: string;
  esUsuario: boolean;
  montoCents: number;
  /** Null for the user's own share: it is informational and has no payment status. */
  resumen: ResumenPago | null;
  /** Live pagos of the share, oldest first. */
  pagos: PagoDetalle[];
}

export interface CuotaDetalle {
  numero: number;
  montoCents: number;
  fechaVencimiento: string;
  partes: ParteDetalle[];
}

export interface DetalleGasto {
  gasto: Gasto;
  tarjetaNombre: string | null;
  cuotas: CuotaDetalle[];
}

/** Builds the detail view-model; `pagosPorParte` maps a share id to its live pagos. */
export function armarDetalleGasto(
  detalle: GastoConDetalle,
  pagosPorParte: Record<string, PagoDetalle[]>,
  tarjetaNombre: string | null,
): DetalleGasto {
  const participantes = new Map(detalle.participantes.map((p) => [p.id, p]));

  const ordenDe = (parte: CuotaParticipante): number => participantes.get(parte.participanteId)?.orden ?? 0;

  const armarParte =(parte: CuotaParticipante): ParteDetalle => {
    const participante = participantes.get(parte.participanteId);
    const esUsuario = participante?.esUsuario ?? false;
    const pagos = pagosPorParte[parte.id] ?? [];
    return {
      id: parte.id,
      nombre: participante?.nombre ?? '',
      esUsuario,
      montoCents: parte.montoCents,
      resumen: esUsuario ? null : estadoDePago(parte.montoCents, pagos.map((pago) => pago.montoCents)),
      pagos,
    };
  };

  return {
    gasto: detalle.gasto,
    tarjetaNombre,
    cuotas: detalle.cuotas.map((cuota) => ({
      numero: cuota.numero,
      montoCents: cuota.montoCents,
      fechaVencimiento: cuota.fechaVencimiento,
      // Share rows have no guaranteed read order; follow the participant order (user last).
      partes: [...cuota.partes].sort((a, b) => ordenDe(a) - ordenDe(b)).map(armarParte),
    })),
  };
}

/** Total live pagos across every share of the gasto. */
export function contarPagos(detalle: DetalleGasto): number {
  return detalle.cuotas.reduce((total, cuota) => total + cuota.partes.reduce((n, parte) => n + parte.pagos.length, 0), 0);
}
