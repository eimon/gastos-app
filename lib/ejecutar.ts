// lib/ejecutar.ts - Ejecuta una acción de una pantalla con protección contra doble toque
import { emitirCambio } from '../services/cambios'
import { esErrorDeReglas } from '../services/errorDominio'
import { showAlert } from './alerts'

// Module-level guard: a second tap before the first action settles is ignored.
let ocupado = false

/** A rules rejection shows its own message and reloads the screens, since their data was stale. */
export async function ejecutar(accion: () => Promise<void>, mensajeError: string) {
  if (ocupado) return
  ocupado = true
  try {
    await accion()
  } catch (err) {
    if (esErrorDeReglas(err)) emitirCambio()
    showAlert('Error', esErrorDeReglas(err) ? err.message : mensajeError)
  } finally {
    ocupado = false
  }
}
