import { Centavos, dividirEnPartes } from './dinero';

export type TipoDescuento = 'uniforme' | 'prorrateo';

export interface ParametrosMontosCuotas {
  totalCents: Centavos;
  descuentoCents: Centavos;
  cuotas: number;
  tipoDescuento: TipoDescuento | null;
}

/**
 * Computes the cents amount of each cuota for a total split into
 * `cuotas` installments, applying the discount distribution mode.
 *
 * - No discount: the total is split evenly (rounding-remainder to the
 *   last cuota).
 * - `uniforme`: the discount is subtracted from the total BEFORE
 *   dividing evenly.
 * - `prorrateo`: equal base cuotas are computed from the total first,
 *   then the discount is consumed sequentially starting at cuota 1
 *   until exhausted. An individual cuota MAY resolve to 0.
 */
export function calcularMontosCuotas({
  totalCents,
  descuentoCents,
  cuotas,
  tipoDescuento,
}: ParametrosMontosCuotas): Centavos[] {
  if (descuentoCents === 0) {
    return dividirEnPartes(totalCents, cuotas);
  }

  if (tipoDescuento === 'uniforme') {
    const neto = totalCents - descuentoCents;
    return dividirEnPartes(neto, cuotas);
  }

  if (tipoDescuento === 'prorrateo') {
    const base = dividirEnPartes(totalCents, cuotas);
    let descuentoRestante = descuentoCents;

    return base.map((monto) => {
      if (descuentoRestante <= 0) {
        return monto;
      }
      const consumido = Math.min(monto, descuentoRestante);
      descuentoRestante -= consumido;
      return monto - consumido;
    });
  }

  throw new Error('Se requiere un tipo de descuento cuando hay un descuento aplicado.');
}
