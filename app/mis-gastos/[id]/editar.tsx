// app/mis-gastos/[id]/editar.tsx - Edición de un gasto: con pagos registrados solo se edita la descripción
import { View, StyleSheet } from 'react-native'
import { ActivityIndicator, Appbar, Text } from 'react-native-paper'
import { router, useLocalSearchParams } from 'expo-router'

import { ErrorReintentar } from '../../../components/ErrorReintentar'
import { GastoForm } from '../../../components/GastoForm'
import { useServicio } from '../../../hooks/useServicio'
import * as gastosService from '../../../services/gastosService'
import { construirInputCrear, type ValoresGastoForm } from '../../../services/gastoFormulario'

export default function EditarGastoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { datos, cargando, error, recargar } = useServicio(
    () => (id ? gastosService.obtenerParaEdicion(id) : undefined),
    [id],
  )

  async function guardar(valores: ValoresGastoForm) {
    if (!id || !datos) return
    const { descripcion, ...nucleo } = construirInputCrear(valores)
    await gastosService.editar(id, {
      descripcion,
      nucleo: datos.tienePagos ? undefined : nucleo,
    })
  }

  // The form keeps its own state after the first load; later reloads (focus,
  // change events) must not unmount it, so only the FIRST load gates rendering.
  if (!datos) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={router.back} />
          <Appbar.Content title="Editar gasto" />
        </Appbar.Header>
        {error ? (
          <ErrorReintentar mensaje="No se pudo cargar el gasto." onReintentar={recargar} />
        ) : (
          <View style={styles.centro}>{cargando ? <ActivityIndicator size="large" /> : <Text>No se encontró el gasto.</Text>}</View>
        )}
      </View>
    )
  }

  return (
    <GastoForm
      titulo="Editar gasto"
      textoGuardar="Guardar cambios"
      valoresIniciales={datos.valores}
      original={datos.original}
      tarjetaVinculada={datos.tarjetaVinculada}
      soloDescripcion={datos.tienePagos}
      onGuardar={guardar}
    />
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
})
