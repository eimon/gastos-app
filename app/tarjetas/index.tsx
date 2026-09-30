// app/tarjetas/index.tsx - Listado de tarjetas activas
import { memo } from 'react'
import { View, StyleSheet, FlatList, type ListRenderItemInfo } from 'react-native'
import { ActivityIndicator, Appbar, FAB, List, Text } from 'react-native-paper'
import { router } from 'expo-router'

import { useServicio } from '../../hooks/useServicio'
import * as tarjetasService from '../../services/tarjetasService'
import type { Tarjeta } from '../../data/repositories/tarjetasRepo'

// Module-level row, renderItem and keyExtractor: stable references across
// renders, so FlatList never re-creates them and rows only re-render when
// their own `tarjeta` changes.
const FilaTarjeta = memo(function FilaTarjeta({ tarjeta }: { tarjeta: Tarjeta }) {
  return (
    <List.Item
      title={tarjeta.nombre}
      description={`Cierra el ${tarjeta.diaCierre} · Vence el ${tarjeta.diaVencimiento}`}
      left={IconoTarjeta}
      onPress={() => router.push(`/tarjetas/${tarjeta.id}`)}
    />
  )
})

function IconoTarjeta(props: { color: string; style?: object }) {
  return <List.Icon {...props} icon="credit-card-outline" />
}

const renderTarjeta = ({ item }: ListRenderItemInfo<Tarjeta>) => <FilaTarjeta tarjeta={item} />
const claveTarjeta = (tarjeta: Tarjeta) => tarjeta.id
const irANuevaTarjeta = () => router.push('/tarjetas/nueva')

export default function TarjetasScreen() {
  const { datos: tarjetas, cargando, error } = useServicio(tarjetasService.listar)
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={router.back} />
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
          <Text>No hay tarjetas todavía. Tocar + para crear la primera.</Text>
        </View>
      ) : (
        <FlatList data={tarjetas} keyExtractor={claveTarjeta} renderItem={renderTarjeta} />
      )}

      <FAB icon="plus" label="Nueva tarjeta" style={styles.fab} onPress={irANuevaTarjeta} />
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
