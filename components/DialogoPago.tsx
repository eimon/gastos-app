// components/DialogoPago.tsx - Confirmación de un pago de un participante (total por defecto, o un monto parcial)
import { useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Button, Dialog, HelperText, Portal, SegmentedButtons, Text } from 'react-native-paper'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'

import { CampoMonto } from './CampoMonto'
import type { MedioPago } from '../data/repositories/pagosRepo'
import { aCentavos, fechaHoyISO } from '../services/gastoFormulario'
import { aFechaISOLocal, deFechaISOLocal } from '../services/fechaLocal'
import { formatearFecha, formatearMonto, type ParteDetalle } from '../services/gastoVista'
import { errorMontoPago, mensajePagoRechazado } from '../services/pagoFormulario'
import * as pagosService from '../services/pagosService'

export type ModoPago = 'total' | 'parcial'

const MEDIOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
]

interface Props {
  parte: ParteDetalle
  modo: ModoPago
  onCerrar: () => void
}

/** Mounted only while open, so every opening starts from a fresh state. */
export function DialogoPago({ parte, modo, onCerrar }: Props) {
  const restante = parte.resumen?.restante ?? 0
  const parcial = modo === 'parcial'
  const [monto, setMonto] = useState<number | null>(null)
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [fecha, setFecha] = useState(fechaHoyISO)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // A ref, not just state: two taps in the same frame both see enviando=false.
  const enviandoRef = useRef(false)

  const errorMonto = parcial && monto !== null ? errorMontoPago(monto, restante) : null

  function abrirSelectorFecha() {
    DateTimePickerAndroid.open({
      value: deFechaISOLocal(fecha),
      mode: 'date',
      onValueChange: (_evento, elegida) => setFecha(aFechaISOLocal(elegida)),
    })
  }

  async function confirmar() {
    if (enviandoRef.current) return
    const invalido = parcial ? errorMontoPago(monto, restante) : null
    if (invalido) {
      setError(invalido)
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    setError(null)
    try {
      await pagosService.registrar({
        objetivo: { tipo: 'participante', cuotaParticipanteId: parte.id },
        montoCents: parcial ? aCentavos(monto) : restante,
        medioPago: medio,
        fecha,
      })
      onCerrar()
    } catch (err) {
      setError(mensajePagoRechazado(err, restante) ?? 'No se pudo registrar el pago.')
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  return (
    <Portal>
      <Dialog visible onDismiss={enviando ? undefined : onCerrar}>
        <Dialog.Title>{parcial ? 'Pagar otro monto' : 'Registrar pago'}</Dialog.Title>
        <Dialog.Content style={styles.contenido}>
          <Text>{`${parte.nombre} debe ${formatearMonto(restante)}.`}</Text>
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
