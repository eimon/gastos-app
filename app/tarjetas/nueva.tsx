// app/tarjetas/nueva.tsx - Alta de una tarjeta
import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Appbar } from 'react-native-paper'
import { router } from 'expo-router'

import TarjetaForm, { ValoresTarjetaForm } from '../../components/TarjetaForm'
import { validarTarjeta, ErrorTarjeta } from '../../domain/tarjeta'
import * as tarjetasService from '../../services/tarjetasService'
import { showAlert } from '../../lib/alerts'

const valoresIniciales: ValoresTarjetaForm = { nombre: '', diaCierre: '', diaVencimiento: '' }

export default function NuevaTarjetaScreen() {
  const [valores, setValores] = useState<ValoresTarjetaForm>(valoresIniciales)
  const [errores, setErrores] = useState<ErrorTarjeta[]>([])
  const [guardando, setGuardando] = useState(false)

  function actualizarCampo(campo: keyof ValoresTarjetaForm, valor: string) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
  }

  async function guardar() {
    const input = {
      nombre: valores.nombre.trim(),
      diaCierre: Number(valores.diaCierre),
      diaVencimiento: Number(valores.diaVencimiento),
    }
    const erroresValidacion = validarTarjeta(input)
    setErrores(erroresValidacion)
    if (erroresValidacion.length > 0) return

    setGuardando(true)
    try {
      await tarjetasService.crear(input)
      router.back()
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo crear la tarjeta')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nueva tarjeta" />
      </Appbar.Header>
      <TarjetaForm
        valores={valores}
        errores={errores}
        guardando={guardando}
        textoBoton="Crear tarjeta"
        onCambiar={actualizarCampo}
        onGuardar={guardar}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
})
