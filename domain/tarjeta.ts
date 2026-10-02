export interface InputTarjeta {
  nombre: string;
  diaCierre: number;
  diaVencimiento: number;
}

export type ErrorTarjeta = 'NOMBRE_REQUERIDO' | 'DIA_CIERRE_INVALIDO' | 'DIA_VENCIMIENTO_INVALIDO';

function esDiaValido(dia: number): boolean {
  return Number.isInteger(dia) && dia >= 1 && dia <= 31;
}

/**
 * Validates a tarjeta before it's persisted — symmetric with
 * `validarGasto`/`validarDeuda`. Used both for inline form errors and as
 * the gate `tarjetasService.crear`/`actualizar` check before writing.
 * The DB schema also has a CHECK constraint on both day columns, but that
 * only guards the data layer — the service/form layer needs this to
 * reject bad input before ever reaching SQLite, and to reject an empty
 * name, which the schema can't express.
 */
export function validarTarjeta(input: InputTarjeta): ErrorTarjeta[] {
  const errores: ErrorTarjeta[] = [];

  if (!input.nombre || input.nombre.trim().length === 0) {
    errores.push('NOMBRE_REQUERIDO');
  }

  if (!esDiaValido(input.diaCierre)) {
    errores.push('DIA_CIERRE_INVALIDO');
  }

  if (!esDiaValido(input.diaVencimiento)) {
    errores.push('DIA_VENCIMIENTO_INVALIDO');
  }

  return errores;
}
