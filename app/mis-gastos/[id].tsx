// app/mis-gastos/[id].tsx - Detalle: cuotas, vencimientos, parte de cada participante y sus pagos
import { memo, useCallback, useState } from 'react'
import { View, StyleSheet, FlatList, type ListRenderItemInfo } from 'react-native'
import { ActivityIndicator, Appbar, Button, Card, Chip, IconButton, List, Text } from 'react-native-paper'
import { router, useLocalSearchParams } from 'expo-router'

import { DialogoPago, type ModoPago } from '../../components/DialogoPago'
import { ErrorReintentar } from '../../components/ErrorReintentar'
import { useServicio } from '../../hooks/useServicio'
import { showAlert, showConfirm } from '../../lib/alerts'
import * as gastosService from '../../services/gastosService'
import * as pagosService from '../../services/pagosService'
import { GastoRechazadoError, MENSAJES_ERROR_GASTO_GUARDADO } from '../../services/gastoEdicion'
import {
  contarPagos,
  etiquetaTipoDescuento,
  formatearFecha,
  formatearMonto,
  type CuotaDetalle,
  type DetalleGasto,
  type PagoDetalle,
  type ParteDetalle,
} from '../../services/gastoVista'
import type { EstadoPago } from '../../domain/pagos'

const ETIQUETA_ESTADO: Record<EstadoPago, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
}

const ETIQUETA_MEDIO: Record<PagoDetalle['medioPago'], string> = { efectivo: 'Efectivo', transferencia: 'Transferencia' }

interface AccionesPago {
  onPagar: (parte: ParteDetalle, modo: ModoPago) => void
  onAnular: (pago: PagoDetalle) => void
}

// Module-level guard: a second tap before the first action settles is ignored.
let ocupado = false

async function ejecutar(accion: () => Promise<void>, mensajeError: string) {
  if (ocupado) return
  ocupado = true
  try {
    await accion()
  } catch (err) {
    showAlert('Error', err instanceof GastoRechazadoError ? err.message : mensajeError)
  } finally {
    ocupado = false
  }
}

function Parte({ parte, onPagar, onAnular }: { parte: ParteDetalle } & AccionesPago) {
  const resumen = parte.resumen
  return (
    <>
      <List.Item
        title={parte.esUsuario ? `${parte.nombre} (parte propia, informativa)` : parte.nombre}
        description={
          resumen
            ? `${formatearMonto(parte.montoCents)} · pagado ${formatearMonto(resumen.pagado)} · falta ${formatearMonto(resumen.restante)}`
            : formatearMonto(parte.montoCents)
        }
        right={() => (resumen ? <Chip compact>{ETIQUETA_ESTADO[resumen.estado]}</Chip> : null)}
      />
      {parte.pagos.map((pago) => (
        <List.Item
          key={pago.id}
          style={styles.pago}
          title={`Pago de ${formatearMonto(pago.montoCents)}`}
          description={`${ETIQUETA_MEDIO[pago.medioPago]} · ${formatearFecha(pago.fecha)}`}
          right={() => <IconButton icon="cancel" accessibilityLabel="Anular pago" onPress={() => onAnular(pago)} />}
        />
      ))}
      {resumen && resumen.restante > 0 && (
        <View style={styles.acciones}>
          <Button mode="contained-tonal" icon="cash-check" onPress={() => onPagar(parte, 'total')}>
            Registrar pago
          </Button>
          <Button compact labelStyle={styles.enlace} onPress={() => onPagar(parte, 'parcial')}>
            Pagar otro monto
          </Button>
        </View>
      )}
    </>
  )
}

const FilaCuota = memo(function FilaCuota({ cuota, onPagar, onAnular }: { cuota: CuotaDetalle } & AccionesPago) {
  return (
    <List.Section title={`Cuota ${cuota.numero} · ${formatearMonto(cuota.montoCents)} · vence ${formatearFecha(cuota.fechaVencimiento)}`}>
      {cuota.partes.map((parte) => (
        <Parte key={parte.id} parte={parte} onPagar={onPagar} onAnular={onAnular} />
      ))}
    </List.Section>
  )
})

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
            Descuento: {formatearMonto(detalle.gasto.descuentoCents)} ({etiquetaTipoDescuento(detalle.gasto.tipoDescuento)})
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
  const { datos: detalle, cargando, error, recargar } = useServicio(() => (id ? gastosService.obtenerDetalle(id) : undefined), [id])

  const [pagoEnCurso, setPagoEnCurso] = useState<{ parteId: string; modo: ModoPago } | null>(null)
  const pagar = useCallback((parte: ParteDetalle, modo: ModoPago) => setPagoEnCurso({ parteId: parte.id, modo }), [])
  const cerrarPago = useCallback(() => setPagoEnCurso(null), [])

  const anularPago = useCallback((pago: PagoDetalle) => {
    showConfirm(
      'Anular pago',
      `Se anula el pago de ${formatearMonto(pago.montoCents)}. La parte vuelve a figurar con ese saldo pendiente.`,
      () => void ejecutar(() => pagosService.anular(pago.id), 'No se pudo anular el pago.'),
    )
  }, [])

  const renderCuota = useCallback(
    ({ item }: ListRenderItemInfo<CuotaDetalle>) => <FilaCuota cuota={item} onPagar={pagar} onAnular={anularPago} />,
    [pagar, anularPago],
  )

  function eliminarGasto() {
    if (!detalle) return
    if (contarPagos(detalle) > 0) {
      showAlert('No se puede eliminar', MENSAJES_ERROR_GASTO_GUARDADO.ELIMINAR_CON_PAGOS)
      return
    }
    showConfirm('Eliminar gasto', `Se elimina «${detalle.gasto.descripcion}».`, () =>
      void ejecutar(async () => {
        await gastosService.eliminar(detalle.gasto.id)
        router.back()
      }, 'No se pudo eliminar el gasto.'),
    )
  }

  const irAEditar = () => router.push(`/mis-gastos/${id}/editar`)
  const parteEnCurso = pagoEnCurso
    ? detalle?.cuotas.flatMap((cuota) => cuota.partes).find((parte) => parte.id === pagoEnCurso.parteId)
    : undefined

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Detalle del gasto" />
        {detalle && <Appbar.Action icon="pencil-outline" accessibilityLabel="Editar gasto" onPress={irAEditar} />}
        {detalle && <Appbar.Action icon="delete-outline" accessibilityLabel="Eliminar gasto" onPress={eliminarGasto} />}
      </Appbar.Header>

      {cargando && !detalle ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : error && !detalle ? (
        <ErrorReintentar mensaje="No se pudo cargar el gasto." onReintentar={recargar} />
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

      {parteEnCurso && pagoEnCurso && <DialogoPago parte={parteEnCurso} modo={pagoEnCurso.modo} onCerrar={cerrarPago} />}
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
