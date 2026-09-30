/**
 * Form-level rules for the "nuevo gasto" screen. Kept in their own module
 * (no `data/db/client` import) so they run under Jest without expo-sqlite —
 * same convention as `gastoPlanMapper.ts` and `tarjetaGate.ts`. All money
 * and date math is delegated to `domain/`; this module only adapts raw form
 * values to the domain input and maps error codes to user-facing messages.
 */
import type { TipoDescuento } from '../domain/cuotas';
import {
  planificarGasto,
  validarGasto,
  type ErrorGasto,
  type InputGasto,
  type PlanGasto,
  type TarjetaGasto,
  type TipoGasto,
} from '../domain/gasto';
import { MAX_CUOTAS, MAX_MONTO_CENTS } from '../domain/limites';
import { formatearMonto } from './gastoVista';
import { esFechaISOValida } from '../domain/vencimientos';
import { NOMBRE_USUARIO, sumarMontos } from '../domain/participantes';
import type { InputCrearGasto } from './gastosService';
import { aFechaISOLocal } from './fechaLocal';

export type ModoReparto = 'iguales' | 'personalizado';

/** One "other participant" row; `id` is a stable list key, not persisted. */
export interface FilaParticipante {
  id: string;
  nombre: string;
  /** Only used in custom mode. */
  monto: number | null;
}

export interface ValoresGastoForm {
  descripcion: string;
  /** `AAAA-MM-DD`. */
  fechaCompra: string;
  /** Amounts as typed by the money input (whole currency units, may have decimals). */
  monto: number | null;
  descuento: number | null;
  tipo: TipoGasto;
  tipoDescuento: TipoDescuento;
  /** Raw text so an empty or invalid entry can be rejected instead of coerced. */
  cuotas: string;
  tarjetaId: string | null;
  /** Other participants, excluding the user (always present as the payer). */
  participantes: FilaParticipante[];
  modoReparto: ModoReparto;
  /** The user's own share in custom mode; may be 0. */
  montoUsuario: number | null;
}

export type ErrorFormularioGasto = ErrorGasto;

export const MENSAJES_ERROR_GASTO: Record<ErrorFormularioGasto, string> = {
  DESCRIPCION_REQUERIDA: 'La descripción es obligatoria.',
  FECHA_INVALIDA: 'La fecha de compra no es válida.',
  MONTO_INVALIDO: 'El monto debe ser mayor a cero.',
  MONTO_EXCESIVO: `El monto no puede superar ${formatearMonto(MAX_MONTO_CENTS)}.`,
  DESCUENTO_INVALIDO: 'El descuento debe ser mayor o igual a cero y menor al monto total.',
  CUOTAS_INVALIDA: `La cantidad de cuotas debe ser un número entero entre 1 y ${MAX_CUOTAS}.`,
  TARJETA_REQUERIDA: 'Para pagar en más de una cuota hay que elegir una tarjeta.',
  TIPO_DESCUENTO_REQUERIDO: 'Hay que elegir cómo se aplica el descuento.',
  SIN_PARTICIPANTES: 'Un gasto compartido necesita al menos un participante.',
  DESCUENTO_SOLO_EN_CUOTAS: 'El descuento solo se puede aplicar cuando hay más de una cuota.',
  MONTOS_PERSONALIZADOS_INVALIDOS:
    'Cada participante debe tener un monto mayor a cero y el total debe ser mayor a cero.',
  PARTICIPANTE_VACIO: 'Los participantes no pueden tener el nombre vacío.',
  PARTICIPANTE_DUPLICADO: 'No puede haber participantes con el mismo nombre (ni llamarse "Yo").',
};

export const valoresInicialesGasto = (): ValoresGastoForm => ({
  descripcion: '',
  fechaCompra: fechaHoyISO(),
  monto: null,
  descuento: null,
  tipo: 'personal',
  tipoDescuento: 'uniforme',
  cuotas: '1',
  tarjetaId: null,
  participantes: [],
  modoReparto: 'iguales',
  montoUsuario: null,
});

export function aCentavos(valor: number | null): number {
  if (valor === null || !Number.isFinite(valor)) {
    return 0;
  }
  return Math.round(valor * 100);
}

export { esFechaISOValida };

export function fechaHoyISO(ahora: Date = new Date()): string {
  return aFechaISOLocal(ahora);
}

function cuotasNumericas(valores: ValoresGastoForm): number {
  return valores.cuotas.trim() === '' ? Number.NaN : Number(valores.cuotas);
}

/** Custom amounts only exist for a shared gasto paid in exactly 1 cuota. */
const PREFIJO_ID_FILA = 'participante-';

/** Next unique row id: one above the highest numeric suffix among the existing rows, so it survives remounts. */
export function siguienteIdFila(filas: FilaParticipante[]): string {
  const mayor = filas.reduce((max, fila) => {
    const numero = fila.id.startsWith(PREFIJO_ID_FILA) ? Number(fila.id.slice(PREFIJO_ID_FILA.length)) : 0;
    return Number.isInteger(numero) && numero > max ? numero : max;
  }, 0);
  return `${PREFIJO_ID_FILA}${mayor + 1}`;
}

export function esRepartoPersonalizado(valores: ValoresGastoForm): boolean {
  return valores.tipo === 'compartido' && valores.modoReparto === 'personalizado' && cuotasNumericas(valores) === 1;
}

/** Custom amounts in split order: other participants first, the user LAST. */
export function montosPersonalizadosCents(valores: ValoresGastoForm): number[] {
  return [...valores.participantes.map((fila) => aCentavos(fila.monto)), aCentavos(valores.montoUsuario)];
}

export function construirInputCrear(valores: ValoresGastoForm): InputCrearGasto {
  const cuotas = cuotasNumericas(valores);
  // The discount field is hidden with 1 cuota, so a stale value must not count.
  const descuentoCents = cuotas > 1 ? aCentavos(valores.descuento) : 0;
  const personalizado = esRepartoPersonalizado(valores);
  const montos = personalizado ? montosPersonalizadosCents(valores) : undefined;
  return {
    tipo: valores.tipo,
    descripcion: valores.descripcion.trim(),
    fechaCompra: valores.fechaCompra,
    montoTotalCents: montos ? sumarMontos(montos) : aCentavos(valores.monto),
    descuentoCents,
    tipoDescuento: descuentoCents > 0 ? valores.tipoDescuento : null,
    cuotas,
    tarjetaId: valores.tarjetaId,
    participantes: valores.tipo === 'compartido' ? valores.participantes.map((fila) => fila.nombre.trim()) : [],
    montosPersonalizadosCents: montos,
  };
}

export interface EvaluacionGasto {
  errores: ErrorFormularioGasto[];
  /** Cuota preview; null while any rule blocks planning. */
  plan: PlanGasto | null;
  /** Each person's share (user last) in custom mode when the gasto is valid; else null. */
  partes: { nombre: string; montoCents: number }[] | null;
}

/** Validates the form and, when valid, previews the cuota schedule via `planificarGasto`. */
export function evaluarFormulario(valores: ValoresGastoForm, tarjetasActivas: TarjetaGasto[]): EvaluacionGasto {
  const input = construirInputCrear(valores);
  const tarjeta = tarjetasActivas.find((t) => t.id === input.tarjetaId) ?? null;
  const inputDominio: InputGasto = {
    descripcion: input.descripcion,
    tipo: input.tipo,
    fechaCompra: input.fechaCompra,
    montoTotalCents: input.montoTotalCents,
    descuentoCents: input.descuentoCents,
    tipoDescuento: input.tipoDescuento,
    cuotas: input.cuotas,
    tarjeta: tarjeta && { id: tarjeta.id, diaCierre: tarjeta.diaCierre, diaVencimiento: tarjeta.diaVencimiento },
    participantes: input.participantes,
    montosPersonalizadosCents: input.montosPersonalizadosCents,
  };

  const errores = validarGasto(inputDominio);
  const plan = errores.length === 0 ? planificarGasto(inputDominio) : null;
  const partes =
    plan && input.montosPersonalizadosCents
      ? [...input.participantes, NOMBRE_USUARIO].map((nombre, i) => ({
          nombre,
          montoCents: input.montosPersonalizadosCents![i],
        }))
      : null;
  return { errores, plan, partes };
}

/**
 * Errors shown before the first save attempt: only those that are
 * meaningful while the user is still filling in the form. After a save
 * attempt every error is shown.
 */
export function erroresVisibles(
  errores: ErrorFormularioGasto[],
  valores: ValoresGastoForm,
  intentoGuardar: boolean,
): ErrorFormularioGasto[] {
  if (intentoGuardar) {
    return errores;
  }
  const enVivo: ErrorFormularioGasto[] = [
    'FECHA_INVALIDA',
    'CUOTAS_INVALIDA',
    'TARJETA_REQUERIDA',
    'PARTICIPANTE_VACIO',
    'PARTICIPANTE_DUPLICADO',
  ];
  if ((valores.descuento ?? 0) > 0 && (valores.monto ?? 0) > 0) {
    enVivo.push('DESCUENTO_INVALIDO', 'TIPO_DESCUENTO_REQUERIDO');
  }
  return errores.filter((error) => enVivo.includes(error));
}
