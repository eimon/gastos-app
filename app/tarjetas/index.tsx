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
    return
  }
  // No back history means this screen was reached via the temporary
  // logged-out dev bypass (see app/_layout.tsx's `enTarjetas` check) —
  // there's no session here to decide a safe destination, and replacing
  // to '/' would briefly mount the (tabs) tree (which redirects to
  // /gastos and fires legacy Supabase fetches) before the root layout
  // flips back to LoginScreen. Simplest safe fix: no-op instead of
  // navigating through that tree. This whole bypass is deleted in PR 4b,
  // where a normal `router.back()` will always have real history.
}

export default function TarjetasScreen() {
  const { datos: tarjetas, cargando, error } = useServicio(tarjetasService.listar)
  // False only when this screen was reached via the temporary logged-out
  // dev bypass (see app/_layout.tsx's `enTarjetas` check), which mounts the
  // root Stack fresh at this exact path with no history. volver() already
  // no-ops in that case, but a back button that visibly does nothing is a
  // dead end for the user — hide it instead. The Android hardware back
  // button still exits the app normally, which is acceptable until PR 4b
  // removes this whole bypass and canGoBack() is always true here.
  // TODO(offline-redesign PR 4b): remove this check along with volver()'s
  // no-op branch once the bypass is gone.
  const puedeVolver = router.canGoBack()

  return (
    <View style={styles.container}>
      <Appbar.Header>
        {puedeVolver && <Appbar.BackAction onPress={volver} />}
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
