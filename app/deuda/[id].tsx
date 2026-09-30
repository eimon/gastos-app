// app/deuda/[id].tsx - Detalle de una deuda: cuotas, vencimientos y sus pagos
import { memo, useCallback, useState } from 'react'
import { View, StyleSheet, FlatList, type ListRenderItemInfo } from 'react-native'
import { ActivityIndicator, Appbar, Button, Card, Chip, IconButton, List, Text } from 'react-native-paper'
import { router, useLocalSearchParams } from 'expo-router'

import { AvisoErrorRecarga } from '../../components/AvisoErrorRecarga'
import { DialogoPago, type ModoPago } from '../../components/DialogoPago'
import { ErrorReintentar } from '../../components/ErrorReintentar'
import { useServicio } from '../../hooks/useServicio'
import { showAlert, showConfirm } from '../../lib/alerts'
import { ejecutar } from '../../lib/ejecutar'
import * as deudasService from '../../services/deudasService'
import * as pagosService from '../../services/pagosService'
import { MENSAJES_ERROR_DEUDA_GUARDADA } from '../../services/deudaEdicion'
import { ETIQUETA_ESTADO_PAGO, contarPagosDeuda, type CuotaDeudaDetalle, type DetalleDeuda } from '../../services/deudaVista'
import { formatearFecha, formatearMonto, type PagoDetalle } from '../../services/gastoVista'

const ETIQUETA_MEDIO: Record<PagoDetalle['medioPago'], string> = { efectivo: 'Efectivo', transferencia: 'Transferencia' }

interface AccionesPago {
  onPagar: (cuota: CuotaDeudaDetalle, modo: ModoPago) => void
  onAnular: (pago: PagoDetalle) => void
}

const FilaCuota = memo(function FilaCuota({ cuota, onPagar, onAnular }: { cuota: CuotaDeudaDetalle } & AccionesPago) {
  const { resumen } = cuota
  return (
    <>
      <List.Item
        title={`Cuota ${cuota.numero} · ${formatearMonto(cuota.montoCents)} · vence ${formatearFecha(cuota.fechaVencimiento)}`}
        description={`Pagado ${formatearMonto(resumen.pagado)} · falta ${formatearMonto(resumen.restante)}`}
        right={() => <Chip compact>{ETIQUETA_ESTADO_PAGO[resumen.estado]}</Chip>}
      />
      {cuota.pagos.map((pago) => (
        <List.Item
          key={pago.id}
          style={styles.pago}
          title={`Pago de ${formatearMonto(pago.montoCents)}`}
          description={`${ETIQUETA_MEDIO[pago.medioPago]} · ${formatearFecha(pago.fecha)}`}
          right={() => <IconButton icon="cancel" accessibilityLabel="Anular pago" onPress={() => onAnular(pago)} />}
        />
      ))}
      {resumen.restante > 0 && (
        <View style={styles.acciones}>
          <Button mode="contained-tonal" icon="cash-check" onPress={() => onPagar(cuota, 'total')}>
            Registrar pago
          </Button>
          <Button compact labelStyle={styles.enlace} onPress={() => onPagar(cuota, 'parcial')}>
            Pagar otro monto
          </Button>
        </View>
      )}
    </>
  )
})

const claveCuota = (cuota: CuotaDeudaDetalle) => cuota.id

function Encabezado({ detalle }: { detalle: DetalleDeuda }) {
  const { deuda, resumen } = detalle
  return (
    <Card style={styles.encabezado}>
      <Card.Title title={deuda.acreedor} subtitle={deuda.descripcion} />
      <Card.Content>
        <Text>Total: {formatearMonto(deuda.montoTotalCents)}</Text>
        <Text>
          Pagado: {formatearMonto(resumen.pagado)} · falta {formatearMonto(resumen.restante)}
        </Text>
        <Text>
          Cuotas: {deuda.cantidadCuotas} · primer pago el {formatearFecha(deuda.fechaPrimerPago)}
        </Text>
      </Card.Content>
    </Card>
  )
}

export default function DetalleDeudaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { datos: detalle, cargando, error, recargar } = useServicio(() => (id ? deudasService.obtenerDetalle(id) : undefined), [id])

  // While leaving after a delete, the reload finds nothing: show a spinner instead of "not found".
  const [saliendo, setSaliendo] = useState(false)
  const [pagoEnCurso, setPagoEnCurso] = useState<{ cuotaId: string; modo: ModoPago } | null>(null)
  const pagar = useCallback((cuota: CuotaDeudaDetalle, modo: ModoPago) => setPagoEnCurso({ cuotaId: cuota.id, modo }), [])
  const cerrarPago = useCallback(() => setPagoEnCurso(null), [])

  const anularPago = useCallback((pago: PagoDetalle) => {
    showConfirm(
      'Anular pago',
      `Se anula el pago de ${formatearMonto(pago.montoCents)}. La cuota vuelve a figurar con ese saldo pendiente.`,
      () => void ejecutar(() => pagosService.anular(pago.id), 'No se pudo anular el pago.'),
    )
  }, [])

  const renderCuota = useCallback(
    ({ item }: ListRenderItemInfo<CuotaDeudaDetalle>) => <FilaCuota cuota={item} onPagar={pagar} onAnular={anularPago} />,
    [pagar, anularPago],
  )

  function eliminarDeuda() {
    if (!detalle) return
    if (contarPagosDeuda(detalle) > 0) {
      showAlert('No se puede eliminar', MENSAJES_ERROR_DEUDA_GUARDADA.ELIMINAR_CON_PAGOS)
      return
    }
    showConfirm('Eliminar deuda', `Se elimina la deuda con ${detalle.deuda.acreedor}.`, () =>
      void ejecutar(async () => {
        setSaliendo(true)
        try {
          await deudasService.eliminar(detalle.deuda.id)
        } catch (err) {
          setSaliendo(false)
          throw err
        }
        // Never leave the spinner stuck when there is nothing to go back to (deep link, restored route).
        if (router.canGoBack()) router.back()
        else router.replace('/(tabs)/deudas')
      }, 'No se pudo eliminar la deuda.'),
    )
  }

  const irAEditar = () => router.push(`/deuda/${id}/editar`)
  const cuotaEnCurso = pagoEnCurso ? detalle?.cuotas.find((cuota) => cuota.id === pagoEnCurso.cuotaId) : undefined

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Detalle de la deuda" />
        {detalle && !saliendo && <Appbar.Action icon="pencil-outline" accessibilityLabel="Editar deuda" onPress={irAEditar} />}
        {detalle && !saliendo && <Appbar.Action icon="delete-outline" accessibilityLabel="Eliminar deuda" onPress={eliminarDeuda} />}
      </Appbar.Header>

      <AvisoErrorRecarga visible={!!error && !!detalle} mensaje="No se pudo actualizar la deuda." onReintentar={recargar} />

      {(cargando && !detalle) || saliendo ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : error && !detalle ? (
        <ErrorReintentar mensaje="No se pudo cargar la deuda." onReintentar={recargar} />
      ) : !detalle ? (
        <View style={styles.centro}>
          <Text>No se encontró la deuda.</Text>
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

      {cuotaEnCurso && pagoEnCurso && (
        <DialogoPago
          objetivo={{ tipo: 'deuda', deudaCuotaId: cuotaEnCurso.id }}
          encabezado={`Cuota ${cuotaEnCurso.numero}: faltan ${formatearMonto(cuotaEnCurso.resumen.restante)}.`}
          restanteCents={cuotaEnCurso.resumen.restante}
          sujeto="cuota"
          modo={pagoEnCurso.modo}
          onCerrar={cerrarPago}
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
  pago: {
    paddingLeft: 32,
  },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    gap: 8,
  },
  enlace: {
    fontSize: 12,
  },
})
