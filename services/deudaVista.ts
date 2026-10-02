/** Pure presentation helpers for the deuda screens; the status is ALWAYS derived from the live pagos. */
import { estadoDePago, type EstadoPago, type ResumenPago } from '../domain/pagos';
import type { CuotaDeudaListada, Deuda, DeudaConCuotas } from '../data/repositories/deudasRepo';
import type { PagoDetalle } from './gastoVista';

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
};

export interface FilaDeudaMes extends CuotaDeudaListada {
  resumen: ResumenPago;
}

export function armarFilasDeudaMes(cuotas: CuotaDeudaListada[]): FilaDeudaMes[] {
  return cuotas.map((cuota) => ({ ...cuota, resumen: estadoDePago(cuota.montoCents, [cuota.pagadoCents]) }));
}

export interface CuotaDeudaDetalle {
  id: string;
  numero: number;
  montoCents: number;
  fechaVencimiento: string;
  resumen: ResumenPago;
  pagos: PagoDetalle[];
}

export interface DetalleDeuda {
  deuda: Deuda;
  resumen: ResumenPago;
  cuotas: CuotaDeudaDetalle[];
}

export function armarDetalleDeuda(detalle: DeudaConCuotas, pagosPorCuota: Record<string, PagoDetalle[]>): DetalleDeuda {
  const cuotas = detalle.cuotas.map((cuota) => {
    const pagos = pagosPorCuota[cuota.id] ?? [];
    return {
      id: cuota.id,
      numero: cuota.numero,
      montoCents: cuota.montoCents,
      fechaVencimiento: cuota.fechaVencimiento,
      resumen: estadoDePago(cuota.montoCents, pagos.map((pago) => pago.montoCents)),
      pagos,
    };
  });
  const pagado = cuotas.flatMap((cuota) => cuota.pagos.map((pago) => pago.montoCents));

  return { deuda: detalle.deuda, resumen: estadoDePago(detalle.deuda.montoTotalCents, pagado), cuotas };
}

/** Total live pagos across every cuota of the deuda. */
export function contarPagosDeuda(detalle: DetalleDeuda): number {
  return detalle.cuotas.reduce((total, cuota) => total + cuota.pagos.length, 0);
}
