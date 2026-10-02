// components/DialogoPago.tsx - Confirmación de un pago de una parte de un gasto o de una cuota de una deuda (total por defecto, o un monto parcial)
import { useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Button, Dialog, HelperText, Portal, SegmentedButtons, Text } from 'react-native-paper'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'

import { CampoMonto } from './CampoMonto'
import { useAlturaTeclado } from '../hooks/useAlturaTeclado'
import type { MedioPago } from '../data/repositories/pagosRepo'
import { aCentavos, fechaHoyISO } from '../services/gastoFormulario'
import { aFechaISOLocal, deFechaISOLocal } from '../services/fechaLocal'
import { formatearFecha, formatearMonto } from '../services/gastoVista'
import { emitirCambio } from '../services/cambios'
import { errorMontoPago, mensajePagoRechazado, type SujetoPago } from '../services/pagoFormulario'
import * as pagosService from '../services/pagosService'

export type ModoPago = 'total' | 'parcial'

const MEDIOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
]

interface Props {
  objetivo: pagosService.ObjetivoPago
  /** First line of the dialog, e.g. who owes what. */
  encabezado: string
  /** Remaining amount of the target when the dialog was built; the service re-checks it. */
  restanteCents: number
  /** Wording of the target errors; a share of a gasto by default. */
  sujeto?: SujetoPago
  modo: ModoPago
  onCerrar: () => void
}

/** Mounted only while open, so every opening starts from a fresh state. */
export function DialogoPago({ objetivo, encabezado, restanteCents: restante, sujeto = 'parte', modo, onCerrar }: Props) {
  const alturaTeclado = useAlturaTeclado()
  const parcial = modo === 'parcial'
  const [monto, setMonto] = useState<number | null>(null)
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [fecha, setFecha] = useState(fechaHoyISO)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // A ref, not just state: two taps in the same frame both see enviando=false.
  const enviandoRef = useRef(false)

  const errorMonto = parcial && monto !== null ? errorMontoPago(monto, restante, sujeto) : null

  function abrirSelectorFecha() {
    DateTimePickerAndroid.open({
      value: deFechaISOLocal(fecha),
      mode: 'date',
      onValueChange: (_evento, elegida) => setFecha(aFechaISOLocal(elegida)),
    })
  }

  async function confirmar() {
    if (enviandoRef.current) return
    const invalido = parcial ? errorMontoPago(monto, restante, sujeto) : null
    if (invalido) {
      setError(invalido)
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    setError(null)
    try {
      await pagosService.registrar({
        objetivo,
        montoCents: parcial ? aCentavos(monto) : restante,
        medioPago: medio,
        fecha,
      })
      onCerrar()
    } catch (err) {
      const rechazo = mensajePagoRechazado(err, restante, sujeto)
      // A rules rejection means the screen's data is stale: reload so the dialog and the
      // detail show the fresh remaining amount instead of the old one.
      if (rechazo) emitirCambio()
      if (!rechazo) console.error(err)
      setError(rechazo ?? 'No se pudo registrar el pago.')
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  // The dialog is centered, so a bottom margin of the keyboard height lifts it above the keyboard.
  return (
    <Portal>
      <Dialog visible onDismiss={enviando ? undefined : onCerrar} style={{ marginBottom: alturaTeclado }}>
        <Dialog.Title>{parcial ? 'Pagar otro monto' : 'Registrar pago'}</Dialog.Title>
        <Dialog.Content style={styles.contenido}>
          <Text>{encabezado}</Text>
          {parcial ? (
            <CampoMonto label="Monto a pagar" valor={monto} onCambiar={setMonto} />
          ) : (
            <Text variant="titleMedium">{`Se registra el pago de ${formatearMonto(restante)}.`}</Text>
          )}
          <SegmentedButtons value={medio} onValueChange={(valor) => setMedio(valor as MedioPago)} buttons={MEDIOS} />
          <Button icon="calendar" mode="outlined" onPress={abrirSelectorFecha}>
            {`Fecha del pago: ${formatearFecha(fecha)}`}
          </Button>
          {(errorMonto ?? error) && (
            <HelperText type="error" visible>
              {errorMonto ?? error}
            </HelperText>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onPress={confirmar} loading={enviando} disabled={enviando || errorMonto !== null}>
            Confirmar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  )
}

const styles = StyleSheet.create({
  contenido: {
    gap: 12,
  },
})
