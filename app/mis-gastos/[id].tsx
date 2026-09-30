// app/mis-gastos/[id].tsx - Detalle de solo lectura: cuotas, vencimientos y parte de cada participante
import { memo } from 'react'
import { View, StyleSheet, FlatList, type ListRenderItemInfo } from 'react-native'
import { ActivityIndicator, Appbar, Card, Chip, List, Text } from 'react-native-paper'
import { router, useLocalSearchParams } from 'expo-router'

import { useServicio } from '../../hooks/useServicio'
import * as gastosService from '../../services/gastosService'
import { formatearFecha, formatearMonto, type CuotaDetalle, type DetalleGasto, type ParteDetalle } from '../../services/gastoVista'
import type { EstadoPago } from '../../domain/pagos'

const ETIQUETA_ESTADO: Record<EstadoPago, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
}

function Parte({ parte }: { parte: ParteDetalle }) {
  return (
    <List.Item
      title={parte.esUsuario ? `${parte.nombre} (tu parte, informativa)` : parte.nombre}
      description={formatearMonto(parte.montoCents)}
      right={() => (parte.resumen ? <Chip compact>{ETIQUETA_ESTADO[parte.resumen.estado]}</Chip> : null)}
    />
  )
}

const FilaCuota = memo(function FilaCuota({ cuota }: { cuota: CuotaDetalle }) {
  return (
    <List.Section title={`Cuota ${cuota.numero} · ${formatearMonto(cuota.montoCents)} · vence ${formatearFecha(cuota.fechaVencimiento)}`}>
      {cuota.partes.map((parte) => (
        <Parte key={parte.id} parte={parte} />
      ))}
    </List.Section>
  )
})

const renderCuota = ({ item }: ListRenderItemInfo<CuotaDetalle>) => <FilaCuota cuota={item} />
const claveCuota = (cuota: CuotaDetalle) => String(cuota.numero)

function Encabezado({ detalle }: { detalle: DetalleGasto }) {
  return (
    <Card style={styles.encabezado}>
      <Card.Title
        title={detalle.gasto.descripcion}
        subtitle={`${detalle.gasto.tipo === 'compartido' ? 'Compartido' : 'Personal'} · comprado el ${formatearFecha(detalle.gasto.fechaCompra)}`}
      />
      <Card.Content>
        <Text>Total: {formatearMonto(detalle.gasto.montoTotalCents)}</Text>
        {detalle.gasto.descuentoCents > 0 && (
          <Text>
            Descuento: {formatearMonto(detalle.gasto.descuentoCents)} ({detalle.gasto.tipoDescuento})
          </Text>
        )}
        <Text>Tarjeta: {detalle.tarjetaNombre ?? 'Sin tarjeta'}</Text>
        <Text>Cuotas: {detalle.cuotas.length}</Text>
      </Card.Content>
    </Card>
  )
}

export default function DetalleGastoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { datos: detalle, cargando } = useServicio(() => (id ? gastosService.obtenerDetalle(id) : undefined), [id])

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Detalle del gasto" />
      </Appbar.Header>

      {cargando && !detalle ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : !detalle ? (
        <View style={styles.centro}>
          <Text>No se encontró el gasto.</Text>
        </View>
      ) : (
        <FlatList
          data={detalle.cuotas}
          keyExtractor={claveCuota}
          renderItem={renderCuota}
          ListHeaderComponent={<Encabezado detalle={detalle} />}
          contentContainerStyle={styles.contenido}
        />
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
  encabezado: {
    marginBottom: 8,
  },
  contenido: {
    padding: 16,
  },
})
