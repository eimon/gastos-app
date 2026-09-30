// app/(tabs)/deudas.tsx - Deudas del mes seleccionado (por vencimiento de cuota)
import { memo } from 'react'
import { View, StyleSheet, FlatList, type ListRenderItemInfo } from 'react-native'
import { ActivityIndicator, Appbar, Chip, FAB, List, Text } from 'react-native-paper'
import { router } from 'expo-router'

import { ErrorReintentar } from '../../components/ErrorReintentar'
import { useMonth } from '../../contexts/MonthContext'
import { useServicio } from '../../hooks/useServicio'
import * as deudasService from '../../services/deudasService'
import { ETIQUETA_ESTADO_PAGO, type FilaDeudaMes } from '../../services/deudaVista'
import { formatearFecha, formatearMonto, nombreMes } from '../../services/gastoVista'

// Module-level row, renderItem and keyExtractor keep FlatList references stable.
const FilaCuota = memo(function FilaCuota({ cuota }: { cuota: FilaDeudaMes }) {
  const { estado, restante } = cuota.resumen
  return (
    <List.Item
      title={cuota.acreedor}
      description={`${cuota.descripcion}\nCuota ${cuota.numero} de ${cuota.cantidadCuotas} · vence ${formatearFecha(cuota.fechaVencimiento)}`}
      descriptionNumberOfLines={3}
      right={() => (
        <View style={styles.derecha}>
          <Text variant="titleSmall">{formatearMonto(cuota.montoCents)}</Text>
          <Chip compact>{ETIQUETA_ESTADO_PAGO[estado]}</Chip>
          {estado !== 'pagado' && <Text variant="bodySmall">{`Falta ${formatearMonto(restante)}`}</Text>}
        </View>
      )}
    />
  )
})

const renderCuota = ({ item }: ListRenderItemInfo<FilaDeudaMes>) => <FilaCuota cuota={item} />
const claveCuota = (cuota: FilaDeudaMes) => `${cuota.deudaId}-${cuota.numero}`
const irANuevaDeuda = () => router.push('/deuda/nueva')

export default function DeudasScreen() {
  const { mesActual, añoActual, navegarMesAnterior, navegarMesSiguiente } = useMonth()
  const { datos: cuotas, cargando, error, recargar } = useServicio(
    () => deudasService.listarDelMes(mesActual, añoActual),
    [mesActual, añoActual],
  )

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Deudas" />
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
        <ErrorReintentar mensaje="No se pudieron cargar las deudas." onReintentar={recargar} />
      ) : !cuotas || cuotas.length === 0 ? (
        <View style={styles.centro}>
          <Text>No hay deudas con vencimiento este mes. Tocar + para agregar una.</Text>
        </View>
      ) : (
        <FlatList data={cuotas} keyExtractor={claveCuota} renderItem={renderCuota} contentContainerStyle={styles.lista} />
      )}

      <FAB icon="plus" label="Nueva deuda" style={styles.fab} onPress={irANuevaDeuda} />
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
  // Room below the last row so the FAB never covers it.
  lista: {
    paddingBottom: 88,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
})
