import { Centavos, dividirEnPartes } from './dinero';
import { calcularVencimientosMensuales, FechaISO } from './vencimientos';

export interface InputDeuda {
  acreedor: string;
  descripcion: string;
  montoTotalCents: Centavos;
  cuotas: number;
  fechaPrimerPago: FechaISO;
}

export interface CuotaDeudaPlan {
  numero: number;
  montoCents: Centavos;
  fechaVencimiento: FechaISO;
}

export interface PlanDeuda {
  cuotas: CuotaDeudaPlan[];
}

/**
 * Plans a Deuda's equal monthly cuota schedule, one per month starting
 * at `fechaPrimerPago`. No card and no discount apply — the
 * rounding-remainder rule from `dividirEnPartes` still does.
 */
export function planificarDeuda(input: InputDeuda): PlanDeuda {
  const montos = dividirEnPartes(input.montoTotalCents, input.cuotas);
  const vencimientos = calcularVencimientosMensuales(input.fechaPrimerPago, input.cuotas);

  return {
    cuotas: montos.map((montoCents, i) => ({
      numero: i + 1,
      montoCents,
      fechaVencimiento: vencimientos[i],
    })),
  };
}
