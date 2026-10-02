// app/tarjetas/[id].tsx - Edición y archivado de una tarjeta
import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { ActivityIndicator, Appbar, Banner, Button, Text } from 'react-native-paper'
import { router, useLocalSearchParams } from 'expo-router'

import TarjetaForm, { ValoresTarjetaForm } from '../../components/TarjetaForm'
import { useServicio } from '../../hooks/useServicio'
import { validarTarjeta, ErrorTarjeta } from '../../domain/tarjeta'
import * as tarjetasService from '../../services/tarjetasService'
import { showAlert, showConfirm } from '../../lib/alerts'

const valoresVacios: ValoresTarjetaForm = { nombre: '', diaCierre: '', diaVencimiento: '' }

export default function EditarTarjetaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { datos: tarjeta, cargando } = useServicio(
    () => (id ? tarjetasService.obtener(id) : undefined),
    [id],
  )

  const [valores, setValores] = useState<ValoresTarjetaForm>(valoresVacios)
  const [errores, setErrores] = useState<ErrorTarjeta[]>([])
  const [guardando, setGuardando] = useState(false)
  const [archivando, setArchivando] = useState(false)
  // Tracks which tarjeta.id the form was last populated from. Setting state
  // directly in the render body (not an effect) is the documented React
  // pattern for "adjust state when a prop/query result changes" — this
  // project's react-hooks/set-state-in-effect rule forbids the equivalent
  // useEffect version (it would cause an extra commit + cascading render).
  const [idCargado, setIdCargado] = useState<string | null>(null)
  if (tarjeta && idCargado !== tarjeta.id) {
    setIdCargado(tarjeta.id)
    setValores({
      nombre: tarjeta.nombre,
      diaCierre: String(tarjeta.diaCierre),
      diaVencimiento: String(tarjeta.diaVencimiento),
    })
  }

  function actualizarCampo(campo: keyof ValoresTarjetaForm, valor: string) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
  }

  async function guardar() {
    if (!id) return
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
      await tarjetasService.actualizar(id, input)
      router.back()
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo actualizar la tarjeta')
    } finally {
      setGuardando(false)
    }
  }

  function archivar() {
    if (!id) return
    showConfirm(
      'Archivar tarjeta',
      'La tarjeta dejará de aparecer al crear nuevos gastos. Los gastos que ya la usan mantienen sus fechas de vencimiento sin cambios.',
      async () => {
        setArchivando(true)
        try {
          await tarjetasService.archivar(id)
          router.back()
        } catch (err) {
          showAlert('Error', err instanceof Error ? err.message : 'No se pudo archivar la tarjeta')
        } finally {
          setArchivando(false)
        }
      },
    )
  }

  if (cargando && !tarjeta) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!tarjeta) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Tarjeta" />
        </Appbar.Header>
        <View style={styles.centro}>
          <Text>No se encontró la tarjeta.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Editar tarjeta" />
      </Appbar.Header>
      {tarjeta.deletedAt && (
        <Banner visible icon="archive">
          Esta tarjeta está archivada. No aparece al crear nuevos gastos.
        </Banner>
      )}
      <TarjetaForm
        valores={valores}
        errores={errores}
        guardando={guardando}
        textoBoton="Guardar cambios"
        onCambiar={actualizarCampo}
        onGuardar={guardar}
      />
      {!tarjeta.deletedAt && (
        <Button
          mode="outlined"
          textColor="#f44336"
          icon="archive"
          onPress={archivar}
          loading={archivando}
          disabled={archivando}
          style={styles.archivar}
        >
          Archivar tarjeta
        </Button>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archivar: {
    marginHorizontal: 16,
    marginTop: 8,
  },
})
