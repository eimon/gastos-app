// app/tarjetas/index.tsx - Listado de tarjetas activas
import { View, StyleSheet, FlatList } from 'react-native'
import { ActivityIndicator, Appbar, FAB, List, Text } from 'react-native-paper'
import { router } from 'expo-router'

import { useServicio } from '../../hooks/useServicio'
import * as tarjetasService from '../../services/tarjetasService'
import type { Tarjeta } from '../../data/repositories/tarjetasRepo'

function volver() {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.replace('/')
  }
}

export default function TarjetasScreen() {
  const { datos: tarjetas, cargando, error } = useServicio(tarjetasService.listar)

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={volver} />
        <Appbar.Content title="Tarjetas" />
      </Appbar.Header>

      {cargando && !tarjetas ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centro}>
          <Text>No se pudieron cargar las tarjetas.</Text>
        </View>
      ) : !tarjetas || tarjetas.length === 0 ? (
        <View style={styles.centro}>
          <Text>No hay tarjetas todavía. Creá la primera con el botón +.</Text>
        </View>
      ) : (
        <FlatList
          data={tarjetas}
          keyExtractor={(tarjeta: Tarjeta) => tarjeta.id}
          renderItem={({ item }) => (
            <List.Item
              title={item.nombre}
              description={`Cierra el ${item.diaCierre} · Vence el ${item.diaVencimiento}`}
              left={(props) => <List.Icon {...props} icon="credit-card-outline" />}
              onPress={() => router.push(`/tarjetas/${item.id}`)}
            />
          )}
        />
      )}

      <FAB icon="plus" label="Nueva tarjeta" style={styles.fab} onPress={() => router.push('/tarjetas/nueva')} />
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
    padding: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
})
