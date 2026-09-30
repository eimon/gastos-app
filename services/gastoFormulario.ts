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
import type { InputCrearGasto } from './gastosService';

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
  /** Comma or line separated names, excluding the user. */
  participantes: string;
}

export type ErrorFormularioGasto = ErrorGasto | 'DESCRIPCION_REQUERIDA' | 'FECHA_INVALIDA';

export const MENSAJES_ERROR_GASTO: Record<ErrorFormularioGasto, string> = {
  DESCRIPCION_REQUERIDA: 'La descripción es obligatoria.',
  FECHA_INVALIDA: 'La fecha debe ser válida y tener el formato AAAA-MM-DD.',
  MONTO_INVALIDO: 'El monto debe ser mayor a cero.',
  DESCUENTO_INVALIDO: 'El descuento debe ser mayor o igual a cero y menor al monto total.',
  CUOTAS_INVALIDA: 'La cantidad de cuotas debe ser un número entero de 1 o más.',
  TARJETA_REQUERIDA: 'Para pagar en más de una cuota hay que elegir una tarjeta.',
  TIPO_DESCUENTO_REQUERIDO: 'Hay que elegir cómo se aplica el descuento.',
  SIN_PARTICIPANTES: 'Un gasto compartido necesita al menos un participante.',
};

export function aCentavos(valor: number | null): number {
  if (valor === null || !Number.isFinite(valor)) {
    return 0;
  }
  return Math.round(valor * 100);
}

export function parsearParticipantes(texto: string): string[] {
  return texto
    .split(/[,\n]/)
    .map((nombre) => nombre.trim())
    .filter((nombre) => nombre.length > 0);
}

export function esFechaISOValida(fecha: string): boolean {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!coincidencia) {
    return false;
  }
  const [anio, mes, dia] = [Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3])];
  const real = new Date(Date.UTC(anio, mes - 1, dia));
  return real.getUTCFullYear() === anio && real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia;
}

export function fechaHoyISO(ahora: Date = new Date()): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export function construirInputCrear(valores: ValoresGastoForm): InputCrearGasto {
  const descuentoCents = aCentavos(valores.descuento);
  return {
    tipo: valores.tipo,
    descripcion: valores.descripcion.trim(),
    fechaCompra: valores.fechaCompra,
    montoTotalCents: aCentavos(valores.monto),
    descuentoCents,
    tipoDescuento: descuentoCents > 0 ? valores.tipoDescuento : null,
    cuotas: valores.cuotas.trim() === '' ? Number.NaN : Number(valores.cuotas),
    tarjetaId: valores.tarjetaId,
    participantes: valores.tipo === 'compartido' ? parsearParticipantes(valores.participantes) : [],
  };
}

export interface EvaluacionGasto {
  errores: ErrorFormularioGasto[];
  /** Cuota preview; null while any rule blocks planning. */
  plan: PlanGasto | null;
}

/** Validates the form and, when valid, previews the cuota schedule via `planificarGasto`. */
export function evaluarFormulario(valores: ValoresGastoForm, tarjetasActivas: TarjetaGasto[]): EvaluacionGasto {
  const input = construirInputCrear(valores);
  const tarjeta = tarjetasActivas.find((t) => t.id === input.tarjetaId) ?? null;
  const inputDominio: InputGasto = {
    tipo: input.tipo,
    fechaCompra: input.fechaCompra,
    montoTotalCents: input.montoTotalCents,
    descuentoCents: input.descuentoCents,
    tipoDescuento: input.tipoDescuento,
    cuotas: input.cuotas,
    tarjeta: tarjeta && { id: tarjeta.id, diaCierre: tarjeta.diaCierre, diaVencimiento: tarjeta.diaVencimiento },
    participantes: input.participantes,
  };

  const errores: ErrorFormularioGasto[] = [];
  if (input.descripcion === '') {
    errores.push('DESCRIPCION_REQUERIDA');
  }
  const fechaValida = esFechaISOValida(input.fechaCompra);
  if (!fechaValida) {
    errores.push('FECHA_INVALIDA');
  }
  const erroresDominio = validarGasto(inputDominio);
  errores.push(...erroresDominio);

  const plan = fechaValida && erroresDominio.length === 0 ? planificarGasto(inputDominio) : null;
  return { errores, plan };
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
  const enVivo: ErrorFormularioGasto[] = ['FECHA_INVALIDA', 'CUOTAS_INVALIDA', 'TARJETA_REQUERIDA'];
  if ((valores.descuento ?? 0) > 0 && (valores.monto ?? 0) > 0) {
    enVivo.push('DESCUENTO_INVALIDO', 'TIPO_DESCUENTO_REQUERIDO');
  }
  return errores.filter((error) => enVivo.includes(error));
}
