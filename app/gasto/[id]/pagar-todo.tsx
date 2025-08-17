// app/gasto/[id]/pagar-todo.tsx - Vista para pagar toda una cuota
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
  List,
  Divider,
} from 'react-native-paper'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, Gasto, GastoDetalle } from '../../../lib/supabase'
import { showAlert, showSuccessToast } from '../../../lib/alerts'

type MedioPago = 'Efectivo' | 'Transferencia'

export default function PagarTodoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [gastoBase, setGastoBase] = useState<Gasto | null>(null)
  const [gastosCuota, setGastosCuota] = useState<Gasto[]>([])
  const [gastoId, setGastoId] = useState<string>('')
  const [numeroCuota, setNumeroCuota] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [medioPago, setMedioPago] = useState<MedioPago>('Efectivo')
  const [descripcion, setDescripcion] = useState('')

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

  const cargarGastoDetalle = async (gastoIdParam: string, numeroCuotaParam: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !gastoIdParam) return

      // Cargar el gasto base
      const { data: gastoBaseData, error: gastoBaseError } = await supabase
        .from('gastos')
        .select('*')
        .eq('id', gastoIdParam)
        .eq('usuario_id', user.id)
        .single()

      if (gastoBaseError) throw gastoBaseError
      setGastoBase(gastoBaseData)

      // Cargar todos los detalles de la cuota específica
      const { data: detallesData, error: gastosCuotaError } = await supabase
        .from('gastos_detalle')
        .select(`
          *,
          gasto:gastos(*),
          usuario:usuarios(*),
          pagos(*)
        `)
        .eq('gasto_id', gastoIdParam)
        .eq('numero_cuota', numeroCuotaParam)

      // Convertir detalles a formato de gastos para compatibilidad
      const gastosCuotaData = detallesData ? [{
        ...gastoBaseData,
        detalles: detallesData
      }] : []

      if (gastosCuotaError) throw gastosCuotaError
      setGastosCuota(gastosCuotaData || [])
    } catch (error: any) {
      console.error('Error cargando detalle del gasto:', error)
      showAlert('Error', 'No se pudo cargar el detalle del gasto')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const getMontoRestante = (detalle: GastoDetalle) => {
    // Si ya está marcado como pagado o el monto es 0, no hay monto restante
    if (detalle.pagado || detalle.monto === 0) return 0
    
    // Calcular el total pagado de este detalle
    const pagos = Array.isArray(detalle.pagos) ? detalle.pagos : []
    const totalPagado = pagos.reduce((sum, pago) => sum + (pago.monto || 0), 0)
    
    // El monto restante es el monto total menos lo ya pagado
    return Math.max(0, detalle.monto - totalPagado)
  }

  const pagarTodo = async () => {
    if (!gastosCuota.length) {
      showAlert('Error', 'No hay gastos para pagar')
      return
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
        
        // Registrar el pago
        const { error: pagoError } = await supabase
          .from('pagos')
          .insert({
            gasto_detalle_id: detalle.id,
            monto: montoRestante,
            medio_pago: medioPago,
            fecha_pago: new Date().toISOString().split('T')[0],
            notas: descripcion || `Pago completo cuota ${numeroCuota}`
          })

        if (pagoError) throw pagoError

        // Marcar como pagado
        const { error: updateError } = await supabase
          .from('gastos_detalle')
          .update({ pagado: true })
          .eq('id', detalle.id)
        
        if (updateError) throw updateError
      })

      await Promise.all(pagosPromises)

      showSuccessToast(`Se registraron ${detallesPendientes.length} pagos correctamente`)
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

  // Obtener todos los detalles de todos los gastos de la cuota
  const todosLosDetalles = gastosCuota.flatMap(g => g.detalles || [])
  const detallesPendientes = todosLosDetalles.filter(d => getMontoRestante(d) > 0)
  const totalPendiente = detallesPendientes.reduce((sum, d) => sum + getMontoRestante(d), 0)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>Pagar Todo</Text>
        </View>
      </View>
      
      <ScrollView style={styles.scrollContainer}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text style={styles.gastoInfo}>
              {gastoBase.descripcion} - Cuota {numeroCuota}
            </Text>
            <Text style={styles.gastoInfo}>
              Total a pagar: {formatearMonto(totalPendiente)}
            </Text>
            <Text style={styles.gastoInfo}>
              {detallesPendientes.length} participante{detallesPendientes.length !== 1 ? 's' : ''} pendiente{detallesPendientes.length !== 1 ? 's' : ''}
            </Text>
          </Card.Content>
        </Card>

        {/* Resumen de pagos */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Resumen de Pagos</Title>
            {detallesPendientes.length === 0 ? (
              <Text style={styles.noDataText}>No hay pagos pendientes</Text>
            ) : (
              detallesPendientes.map((detalle, index) => {
                const montoRestante = getMontoRestante(detalle)
                return (
                  <View key={detalle.id}>
                    <List.Item
                      title={detalle.usuario?.nickname || detalle.nombre_participante || 'Participante'}
                      description={`Monto: ${formatearMonto(montoRestante)}`}
                      left={() => <List.Icon icon="account" />}
                    />
                    {index < detallesPendientes.length - 1 && <Divider />}
                  </View>
                )
              })
            )}
          </Card.Content>
        </Card>

        {/* Configuración del pago */}
        {detallesPendientes.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Configuración del Pago</Title>
              
              <Text style={styles.medioPagoLabel}>Medio de Pago</Text>
              <RadioButton.Group
                onValueChange={(value) => setMedioPago(value as MedioPago)}
                value={medioPago}
              >
                <View style={styles.radioContainer}>
                  <RadioButton.Item
                    label="Efectivo"
                    value="Efectivo"
                    style={styles.radioItem}
                  />
                  <RadioButton.Item
                    label="Transferencia"
                    value="Transferencia"
                    style={styles.radioItem}
                  />
                </View>
              </RadioButton.Group>

              <TextInput
                label="Descripción (opcional)"
                value={descripcion}
                onChangeText={setDescripcion}
                mode="outlined"
                style={styles.input}
                multiline
                numberOfLines={3}
              />
            </Card.Content>
          </Card>
        )}

        {/* Botones de acción */}
        <View style={styles.actionsContainer}>
          <Button
            mode="contained"
            onPress={pagarTodo}
            loading={guardando}
            disabled={guardando || detallesPendientes.length === 0}
            style={styles.actionButton}
            icon="check-all"
          >
            Pagar Todo ({formatearMonto(totalPendiente)})
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => router.back()}
            disabled={guardando}
            style={styles.actionButton}
          >
            Cancelar
          </Button>
        </View>
      </ScrollView>
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
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
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
  actionsContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  actionButton: {
    marginBottom: 12,
  },
})