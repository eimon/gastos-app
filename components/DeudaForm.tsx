// components/DeudaForm.tsx - Formulario de alta de una deuda, con vista previa de cuotas
import { useRef, useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Appbar, Button, HelperText, List, TextInput } from 'react-native-paper'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { router } from 'expo-router'

import { Bloqueable } from './Bloqueable'
import { CampoMonto } from './CampoMonto'
import { useAlturaTeclado } from '../hooks/useAlturaTeclado'
import { showAlert } from '../lib/alerts'
import { emitirCambio } from '../services/cambios'
import { MENSAJES_ERROR_DEUDA_GUARDADA } from '../services/deudaEdicion'
import {
  MENSAJES_ERROR_DEUDA,
  erroresVisiblesDeuda,
  evaluarFormularioDeuda,
  type ValoresDeudaForm,
} from '../services/deudaFormulario'
import { esErrorDeReglas } from '../services/errorDominio'
import { aFechaISOLocal, deFechaISOLocal } from '../services/fechaLocal'
import { formatearFecha, formatearMonto } from '../services/gastoVista'

interface Props {
  titulo: string
  textoGuardar: string
  valoresIniciales: ValoresDeudaForm
  /** Persists the form; a rejection is shown to the user as an alert. */
  onGuardar: (valores: ValoresDeudaForm) => Promise<void>
  /** Edit with payments: only the acreedor and the descripcion can change, the rest is shown disabled. */
  soloTextos?: boolean
}

export function DeudaForm({ titulo, textoGuardar, valoresIniciales, onGuardar, soloTextos = false }: Props) {
  const alturaTeclado = useAlturaTeclado()
  const [valores, setValores] = useState<ValoresDeudaForm>(valoresIniciales)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // A ref, not just state: two taps in the same frame both see guardando=false.
  const guardandoRef = useRef(false)

  function cambiar<K extends keyof ValoresDeudaForm>(campo: K, valor: ValoresDeudaForm[K]) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
  }

  const evaluacion = evaluarFormularioDeuda(valores)
  // Locked edits only validate the texts; the other fields are never saved.
  const errores = soloTextos
    ? evaluacion.errores.filter((e) => e === 'ACREEDOR_REQUERIDO' || e === 'DESCRIPCION_REQUERIDA')
    : evaluacion.errores
  const plan = soloTextos ? null : evaluacion.plan

  // Imperative Android dialog: it opens once per press, so a re-render can't re-open it.
  function abrirSelectorFecha() {
    DateTimePickerAndroid.open({
      value: deFechaISOLocal(valores.fechaPrimerPago),
      mode: 'date',
      onValueChange: (_evento, fecha) => cambiar('fechaPrimerPago', aFechaISOLocal(fecha)),
    })
  }

  async function guardar() {
    if (guardandoRef.current) return
    setIntentoGuardar(true)
    if (errores.length > 0) return

    guardandoRef.current = true
    setGuardando(true)
    try {
      await onGuardar(valores)
      router.back()
    } catch (err) {
      // A rules rejection means the screen's data is stale: reload it.
      if (esErrorDeReglas(err)) {
        emitirCambio()
        showAlert('Error', err.message)
      } else {
        console.error(err)
        showAlert('Error', 'No se pudo guardar la deuda.')
      }
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  return (
    // Bottom padding of the keyboard height shrinks the ScrollView so the focused field scrolls into view.
    <View style={[styles.container, { paddingBottom: alturaTeclado }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={router.back} />
        <Appbar.Content title={titulo} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {soloTextos && (
          <HelperText type="info" visible>
            {MENSAJES_ERROR_DEUDA_GUARDADA.BLOQUEADO_POR_PAGO}
          </HelperText>
        )}
        <TextInput
          label="Acreedor (persona o entidad)"
          value={valores.acreedor}
          onChangeText={(texto) => cambiar('acreedor', texto)}
          mode="outlined"
        />
        <TextInput
          label="Descripción"
          value={valores.descripcion}
          onChangeText={(texto) => cambiar('descripcion', texto)}
          mode="outlined"
          style={styles.campo}
        />
        <Bloqueable bloqueado={soloTextos}>
          <CampoMonto label="Monto total" valor={valores.monto} onCambiar={(v) => cambiar('monto', v)} />
          <TextInput
            label="Cuotas"
            value={valores.cuotas}
            onChangeText={(texto) => cambiar('cuotas', texto)}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.campo}
          />
          <Button icon="calendar" mode="outlined" onPress={abrirSelectorFecha} style={styles.campo}>
            {`Fecha del primer pago: ${formatearFecha(valores.fechaPrimerPago)}`}
          </Button>
        </Bloqueable>

        {erroresVisiblesDeuda(errores, intentoGuardar).map((error) => (
          <HelperText key={error} type="error" visible>
            {MENSAJES_ERROR_DEUDA[error]}
          </HelperText>
        ))}

        {plan && (
          <List.Section title="Vista previa de cuotas">
            {plan.cuotas.map((cuota) => (
              <List.Item
                key={cuota.numero}
                title={`Cuota ${cuota.numero} de ${plan.cuotas.length} · ${formatearMonto(cuota.montoCents)}`}
                description={`Vence el ${formatearFecha(cuota.fechaVencimiento)}`}
              />
            ))}
          </List.Section>
        )}

        <Button mode="contained" onPress={guardar} loading={guardando} disabled={guardando} style={styles.boton}>
          {textoGuardar}
        </Button>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 16,
    paddingBottom: 48,
  },
  campo: {
    marginTop: 12,
  },
  boton: {
    marginTop: 16,
  },
})
