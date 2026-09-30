// app/deuda/[id]/editar.tsx - Edición de una deuda: con pagos registrados solo se editan el acreedor y la descripción
import { View, StyleSheet } from 'react-native'
import { ActivityIndicator, Appbar, Text } from 'react-native-paper'
import { router, useLocalSearchParams } from 'expo-router'

import { DeudaForm } from '../../../components/DeudaForm'
import { ErrorReintentar } from '../../../components/ErrorReintentar'
import { useServicio } from '../../../hooks/useServicio'
import * as deudasService from '../../../services/deudasService'
import { construirInputDeuda, type ValoresDeudaForm } from '../../../services/deudaFormulario'

export default function EditarDeudaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { datos, cargando, error, recargar } = useServicio(() => (id ? deudasService.obtenerParaEdicion(id) : undefined), [id])

  async function guardar(valores: ValoresDeudaForm) {
    if (!id || !datos) return
    const { acreedor, descripcion, ...nucleo } = construirInputDeuda(valores)
    await deudasService.editar(id, { acreedor, descripcion, nucleo: datos.tienePagos ? undefined : nucleo })
  }

  // The form keeps its own state after the first load; later reloads (focus,
  // change events) must not unmount it, so only the FIRST load gates rendering.
  if (!datos) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={router.back} />
          <Appbar.Content title="Editar deuda" />
        </Appbar.Header>
        {error ? (
          <ErrorReintentar mensaje="No se pudo cargar la deuda." onReintentar={recargar} />
        ) : (
          <View style={styles.centro}>{cargando ? <ActivityIndicator size="large" /> : <Text>No se encontró la deuda.</Text>}</View>
        )}
      </View>
    )
  }

  return (
    <DeudaForm
      titulo="Editar deuda"
      textoGuardar="Guardar cambios"
      valoresIniciales={datos.valores}
      soloTextos={datos.tienePagos}
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
