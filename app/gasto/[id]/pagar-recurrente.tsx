// app/gasto/[id]/pagar-recurrente.tsx - Vista para pagar gastos recurrentes con opción de modificar monto
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native'
import {
  Card,
  Title,
  Button,
  TextInput,
  RadioButton,
  IconButton,
  Switch,
  Divider,
} from 'react-native-paper'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, Gasto, GastoDetalle, gastosService, pagosService } from '../../../lib/supabase'
import { showAlert } from '../../../lib/alerts'

type MedioPago = 'efectivo' | 'transferencia'

export default function PagarRecurrenteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [gastoBase, setGastoBase] = useState<Gasto | null>(null)
  const [gastosCuota, setGastosCuota] = useState<Gasto[]>([])
  const [gastoId, setGastoId] = useState<string>('')
  const [numeroCuota, setNumeroCuota] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo')
  const [descripcion, setDescripcion] = useState('')
  const [modificarMonto, setModificarMonto] = useState(false)
  const [nuevoMonto, setNuevoMonto] = useState('')

  useEffect(() => {
    if (id) {
      // Parsear el ID: gasto_id-cuota-numero_cuota
      const partes = id.split('-cuota-')
      if (partes.length === 2) {
        const gastoIdParsed = partes[0]
        const numeroCuotaParsed = parseInt(partes[1])
        setGastoId(gastoIdParsed)
        setNumeroCuota(numeroCuotaParsed)
        cargarGastoDetalle(gastoIdParsed, numeroCuotaParsed)
      }
    }
  }, [id])

  const cargarGastoDetalle = async (gastoId: string, numeroCuota: number) => {
    try {
      // Obtener el gasto base
      const { data: gasto, error: gastoError } = await supabase
        .from('gastos')
        .select('*')
        .eq('id', gastoId)
        .single()
      
      if (gastoError) throw gastoError
      setGastoBase(gasto)
      setNuevoMonto(gasto.monto.toString())

      // Obtener todos los gastos de la misma cuota
      const { data: detalles, error: detallesError } = await supabase
        .from('gastos_detalle')
        .select(`
          *,
          gasto:gastos(*),
          usuario:usuarios(nickname, email),
          pagos(*)
        `)
        .eq('gasto_id', gastoId)
        .eq('numero_cuota', numeroCuota)
        .order('created_at')
      
      if (detallesError) throw detallesError

      // Agrupar detalles por gasto
      const gastosMap = new Map<string, Gasto>()
      
      detalles?.forEach(detalle => {
        if (detalle.gasto) {
          const gastoKey = detalle.gasto.id
          if (!gastosMap.has(gastoKey)) {
            gastosMap.set(gastoKey, {
              ...detalle.gasto,
              detalles: []
            })
          }
          gastosMap.get(gastoKey)!.detalles!.push(detalle)
        }
      })
      
      setGastosCuota(Array.from(gastosMap.values()))
    } catch (error: any) {
      console.error('Error cargando detalle del gasto:', error)
      showAlert('Error', 'No se pudo cargar el detalle del gasto')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const getMontoRestante = (detalle: GastoDetalle): number => {
    const totalPagado = detalle.pagos?.reduce((sum, pago) => sum + pago.monto, 0) || 0
    return Math.max(0, detalle.monto - totalPagado)
  }

  const formatearMonto = (monto: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(monto)
  }

  const pagarTodoRecurrente = async () => {
    if (!gastosCuota.length) {
      showAlert('Error', 'No hay gastos para pagar')
      return
    }

    // Validar nuevo monto si se va a modificar
    let montoFinal = gastoBase?.monto || 0
    if (modificarMonto) {
      const montoNumerico = parseFloat(nuevoMonto)
      if (isNaN(montoNumerico) || montoNumerico <= 0) {
        showAlert('Error', 'El nuevo monto debe ser un número válido mayor a 0')
        return
      }
      montoFinal = montoNumerico
    }

    // Obtener todos los detalles pendientes
    const todosLosDetalles = gastosCuota.flatMap(g => g.detalles || [])
    const detallesPendientes = todosLosDetalles.filter(d => getMontoRestante(d) > 0)

    if (detallesPendientes.length === 0) {
      showAlert('Información', 'No hay pagos pendientes en esta cuota')
      return
    }

    setGuardando(true)
    try {
      // Registrar pagos para todos los detalles pendientes
      const pagosPromises = detallesPendientes.map(async (detalle) => {
        const montoRestante = getMontoRestante(detalle)
        
        // Crear el pago usando el servicio
        await pagosService.crearPago({
          gasto_detalle_id: detalle.id,
          monto: montoRestante,
          medio_pago: medioPago,
          fecha_pago: new Date().toISOString().split('T')[0],
          notas: descripcion || `Pago completo cuota ${numeroCuota} - Recurrente`
        }, detalle.gasto?.usuario_id || '')

        // Marcar como pagado
        const { error: updateError } = await supabase
          .from('gastos_detalle')
          .update({ pagado: true })
          .eq('id', detalle.id)
        
        if (updateError) throw updateError
      })

      await Promise.all(pagosPromises)

      // Si se modificó el monto y es la última cuota, generar el gasto recurrente con el nuevo monto
      if (gastoBase?.es_recurrente && numeroCuota === gastoBase.cuotas && modificarMonto) {
        try {
          const gastoRecurrente = await gastosService.generarGastoRecurrente(gastoId, gastoBase.usuario_id, montoFinal)
          if (gastoRecurrente.ya_existia) {
            showAlert('Información', `El gasto recurrente para el próximo mes ya existía. Los pagos se registraron correctamente.`)
          } else {
            showAlert('Éxito', `Gasto recurrente generado para el próximo mes con monto ${formatearMonto(montoFinal)}`)
          }
        } catch (recurrenteError) {
          console.error('Error generando gasto recurrente:', recurrenteError)
          showAlert('Advertencia', 'Los pagos se registraron correctamente, pero hubo un error generando el gasto recurrente')
        }
      }

      showAlert('Éxito', `Se registraron ${detallesPendientes.length} pagos correctamente`)
      // Navegar de vuelta y forzar recarga de la vista de detalle
      router.replace(`/gasto/${gastoId}-cuota-${numeroCuota}`)
    } catch (error: any) {
      console.error('Error registrando pagos:', error)
      showAlert('Error', error.message || 'No se pudieron registrar los pagos')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando...</Text>
      </View>
    )
  }

  if (!gastoBase || gastosCuota.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text>No se encontró el gasto</Text>
      </View>
    )
  }

  const todosLosDetalles = gastosCuota.flatMap(g => g.detalles || [])
  const detallesPendientes = todosLosDetalles.filter(d => getMontoRestante(d) > 0)
  const montoTotalPendiente = detallesPendientes.reduce((sum, d) => sum + getMontoRestante(d), 0)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>Pagar Gasto Recurrente</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer}>
        {/* Información del gasto */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title>{gastoBase.descripcion}</Title>
            <Text style={styles.gastoInfo}>Cuota {numeroCuota} de {gastoBase.cuotas}</Text>
            <Text style={styles.gastoInfo}>Monto original: {formatearMonto(gastoBase.monto)}</Text>
            <Text style={styles.gastoInfo}>Pendiente de pago: {formatearMonto(montoTotalPendiente)}</Text>
            {gastoBase.es_recurrente && (
              <Text style={[styles.gastoInfo, { color: '#2196F3', fontWeight: 'bold' }]}>🔄 Gasto Recurrente</Text>
            )}
          </Card.Content>
        </Card>

        {/* Opción para modificar monto (solo si es recurrente y última cuota) */}
        {gastoBase.es_recurrente && numeroCuota === gastoBase.cuotas && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Configuración Recurrente</Title>
              
              <View style={styles.switchContainer}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Modificar monto para próximo mes</Text>
                  <Text style={styles.switchDescription}>
                    El gasto del próximo mes se generará con el monto que especifiques
                  </Text>
                </View>
                <Switch
                  value={modificarMonto}
                  onValueChange={setModificarMonto}
                />
              </View>

              {modificarMonto && (
                <TextInput
                  label="Nuevo monto para próximo mes"
                  value={nuevoMonto}
                  onChangeText={setNuevoMonto}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  right={<TextInput.Affix text="$" />}
                />
              )}
            </Card.Content>
          </Card>
        )}

        {/* Formulario de pago */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Datos del Pago</Title>
            
            <Text style={styles.medioPagoLabel}>Medio de Pago</Text>
            <View style={styles.radioContainer}>
              <RadioButton.Group
                onValueChange={(value) => setMedioPago(value as MedioPago)}
                value={medioPago}
              >
                <View style={styles.radioItem}>
                  <RadioButton.Item label="Efectivo" value="efectivo" />
                </View>
                <View style={styles.radioItem}>
                  <RadioButton.Item label="Transferencia" value="transferencia" />
                </View>
              </RadioButton.Group>
            </View>

            <TextInput
              label="Descripción (opcional)"
              value={descripcion}
              onChangeText={setDescripcion}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* Resumen de pagos */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Resumen de Pagos</Title>
            <Text style={styles.gastoInfo}>
              Se pagarán {detallesPendientes.length} participante(s) por un total de {formatearMonto(montoTotalPendiente)}
            </Text>
            
            <Divider style={{ marginVertical: 16 }} />
            
            {detallesPendientes.map((detalle, index) => (
              <View key={detalle.id} style={styles.participanteItem}>
                <Text style={styles.participanteNombre}>
                  {detalle.usuario?.nickname || detalle.nombre_participante}
                </Text>
                <Text style={styles.participanteMonto}>
                  {formatearMonto(getMontoRestante(detalle))}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        <Button
          mode="contained"
          onPress={pagarTodoRecurrente}
          loading={guardando}
          disabled={guardando || detallesPendientes.length === 0}
          style={styles.actionButton}
        >
          {guardando ? 'Procesando...' : `Pagar Todo (${formatearMonto(montoTotalPendiente)})`}
        </Button>
        
        <Button
          mode="outlined"
          onPress={() => router.back()}
          disabled={guardando}
        >
          Cancelar
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 50,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
  },
  gastoInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  input: {
    marginBottom: 16,
  },
  medioPagoLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  radioContainer: {
    marginBottom: 16,
  },
  radioItem: {
    paddingVertical: 4,
  },
  participanteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  participanteNombre: {
    fontSize: 16,
    flex: 1,
  },
  participanteMonto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  actionsContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  actionButton: {
    marginBottom: 12,
  },
})