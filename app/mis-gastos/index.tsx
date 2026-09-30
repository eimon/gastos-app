// app/mis-gastos/index.tsx - Gastos del mes seleccionado (por vencimiento de cuota)
import { memo } from 'react'
import { View, StyleSheet, FlatList, type ListRenderItemInfo } from 'react-native'
import { ActivityIndicator, Appbar, Chip, FAB, List, Text } from 'react-native-paper'
import { router } from 'expo-router'

import { useMonth } from '../../contexts/MonthContext'
import { useServicio } from '../../hooks/useServicio'
import * as gastosService from '../../services/gastosService'
import { formatearFecha, formatearMonto, nombreMes } from '../../services/gastoVista'
import type { CuotaListada } from '../../data/repositories/gastosRepo'

// Module-level row, renderItem and keyExtractor keep FlatList references stable.
const FilaCuota = memo(function FilaCuota({ cuota }: { cuota: CuotaListada }) {
  const compartido = cuota.tipo === 'compartido'
  return (
    <List.Item
      title={cuota.descripcion}
      description={`Cuota ${cuota.numero} de ${cuota.cantidadCuotas} · vence ${formatearFecha(cuota.fechaVencimiento)}`}
      right={() => (
        <View style={styles.derecha}>
          <Text variant="titleSmall">{formatearMonto(cuota.montoCents)}</Text>
          <Chip compact icon={compartido ? 'account-multiple' : 'account'}>
            {compartido ? 'Compartido' : 'Personal'}
          </Chip>
        </View>
      )}
      onPress={() => router.push(`/mis-gastos/${cuota.gastoId}`)}
    />
  )
})

const renderCuota = ({ item }: ListRenderItemInfo<CuotaListada>) => <FilaCuota cuota={item} />
const claveCuota = (cuota: CuotaListada) => `${cuota.gastoId}-${cuota.numero}`
const irANuevoGasto = () => router.push('/mis-gastos/nuevo')
const irATarjetas = () => router.push('/tarjetas')

export default function MisGastosScreen() {
  const { mesActual, añoActual, navegarMesAnterior, navegarMesSiguiente } = useMonth()
  const { datos: cuotas, cargando, error } = useServicio(
    () => gastosService.listarDelMes(mesActual, añoActual),
    [mesActual, añoActual],
  )
  // Hidden (not a no-op) when this screen was reached through the temporary
  // logged-out dev bypass, which mounts the Stack here with no history.
  // TODO(offline-redesign PR 4b): remove this check along with the bypass.
  const puedeVolver = router.canGoBack()

  return (
    <View style={styles.container}>
      <Appbar.Header>
        {puedeVolver && <Appbar.BackAction onPress={router.back} />}
        <Appbar.Content title="Mis gastos" />
        <Appbar.Action icon="credit-card-outline" accessibilityLabel="Tarjetas" onPress={irATarjetas} />
      </Appbar.Header>

      <View style={styles.mes}>
        <Appbar.Action icon="chevron-left" accessibilityLabel="Mes anterior" onPress={navegarMesAnterior} />
        <Text variant="titleMedium">{nombreMes(mesActual, añoActual)}</Text>
        <Appbar.Action icon="chevron-right" accessibilityLabel="Mes siguiente" onPress={navegarMesSiguiente} />
      </View>

      {cargando && !cuotas ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centro}>
          <Text>No se pudieron cargar los gastos.</Text>
        </View>
      ) : !cuotas || cuotas.length === 0 ? (
        <View style={styles.centro}>
          <Text>No hay gastos con vencimiento este mes. Use el botón + para agregar uno.</Text>
        </View>
      ) : (
        <FlatList data={cuotas} keyExtractor={claveCuota} renderItem={renderCuota} />
      )}

      <FAB icon="plus" label="Nuevo gasto" style={styles.fab} onPress={irANuevoGasto} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  derecha: {
    alignItems: 'flex-end',
    gap: 4,
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
