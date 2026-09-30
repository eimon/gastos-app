// components/DeudaForm.tsx - Formulario de alta de una deuda, con vista previa de cuotas
import { useRef, useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Appbar, Button, HelperText, List, TextInput } from 'react-native-paper'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { router } from 'expo-router'

import { CampoMonto } from './CampoMonto'
import { useAlturaTeclado } from '../hooks/useAlturaTeclado'
import { showAlert } from '../lib/alerts'
import { emitirCambio } from '../services/cambios'
import {
  MENSAJES_ERROR_DEUDA,
  erroresVisiblesDeuda,
  evaluarFormularioDeuda,
  resumirPlanDeuda,
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
}

export function DeudaForm({ titulo, textoGuardar, valoresIniciales, onGuardar }: Props) {
  const alturaTeclado = useAlturaTeclado()
  const [valores, setValores] = useState<ValoresDeudaForm>(valoresIniciales)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // A ref, not just state: two taps in the same frame both see guardando=false.
  const guardandoRef = useRef(false)

  function cambiar<K extends keyof ValoresDeudaForm>(campo: K, valor: ValoresDeudaForm[K]) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
  }

  const { errores, plan } = evaluarFormularioDeuda(valores)
  const resumen = plan ? resumirPlanDeuda(plan.cuotas) : null

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
      if (esErrorDeReglas(err)) emitirCambio()
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo guardar la deuda.')
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

        {erroresVisiblesDeuda(errores, intentoGuardar).map((error) => (
          <HelperText key={error} type="error" visible>
            {MENSAJES_ERROR_DEUDA[error]}
          </HelperText>
        ))}

        {plan && resumen && (
          <List.Section title="Vista previa de cuotas">
            {resumen.primeras.map((cuota) => (
              <List.Item
                key={cuota.numero}
                title={`Cuota ${cuota.numero} de ${plan.cuotas.length} · ${formatearMonto(cuota.montoCents)}`}
                description={`Vence el ${formatearFecha(cuota.fechaVencimiento)}`}
              />
            ))}
            {resumen.ultima && (
              <>
                <List.Item title={`… ${resumen.ocultas} cuotas más`} />
                <List.Item
                  title={`Cuota ${resumen.ultima.numero} de ${plan.cuotas.length} · ${formatearMonto(resumen.ultima.montoCents)}`}
                  description={`Vence el ${formatearFecha(resumen.ultima.fechaVencimiento)}`}
                />
              </>
            )}
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
