// app/gasto/[id]/pagar.tsx - Vista para registrar pagos
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
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
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, Gasto, GastoDetalle } from '../../../lib/supabase'
import { showAlert } from '../../../lib/alerts'

type MedioPago = 'efectivo' | 'transferencia'
export default function PagarGastoScreen() {
  const { id, participante } = useLocalSearchParams<{ id: string; participante?: string }>()
  const [gastoBase, setGastoBase] = useState<Gasto | null>(null)
  const [gastosCuota, setGastosCuota] = useState<Gasto[]>([])
  const [gastoId, setGastoId] = useState<string>('')
  const [numeroCuota, setNumeroCuota] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<GastoDetalle | null>(null)
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo')
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

      // Si hay un participante específico, seleccionarlo automáticamente
      if (participante && gastosCuotaData) {
        const todosLosDetalles = gastosCuotaData.flatMap(g => g.detalles || [])
        const detalleParticipante = todosLosDetalles.find(d => 
          d.usuario?.id === participante || d.nombre_participante === participante
        )
        if (detalleParticipante) {
          seleccionarDetalle(detalleParticipante)
        }
      }
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

  const registrarPago = async () => {
    if (!detalleSeleccionado || !monto) {
      showAlert('Error', 'Selecciona un detalle y especifica el monto')
      return
    }

    const montoNumerico = parseFloat(monto)
    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      showAlert('Error', 'El monto debe ser un número válido mayor a 0')
      return
    }

    const montoRestante = getMontoRestante(detalleSeleccionado)
    if (montoNumerico > montoRestante) {
      showAlert('Error', `El monto no puede ser mayor al restante: ${formatearMonto(montoRestante)}`)
      return
    }

    setGuardando(true)
    try {
      // Registrar el pago
      const { error: pagoError } = await supabase
        .from('pagos')
        .insert({
          gasto_detalle_id: detalleSeleccionado.id,
          monto: montoNumerico,
          medio_pago: medioPago,
          fecha_pago: new Date().toISOString().split('T')[0],
          notas: descripcion || null
        })

      if (pagoError) throw pagoError

      // Si el pago cubre el monto total, marcar como pagado
      if (montoNumerico === detalleSeleccionado.monto) {
        const { error: updateError } = await supabase
          .from('gastos_detalle')
          .update({ pagado: true })
          .eq('id', detalleSeleccionado.id)
        
        if (updateError) throw updateError
      }

      showAlert('Éxito', 'Pago registrado correctamente')
      // Navegar de vuelta y forzar recarga de la vista de detalle
      router.replace(`/gasto/${gastoId}-cuota-${numeroCuota}`)
    } catch (error: any) {
      console.error('Error registrando pago:', error)
      showAlert('Error', error.message || 'No se pudo registrar el pago')
    } finally {
      setGuardando(false)
    }
  }

  const seleccionarDetalle = (detalle: GastoDetalle) => {
    setDetalleSeleccionado(detalle)
    const montoRestante = getMontoRestante(detalle)
    setMonto(montoRestante.toString())
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
          <Text style={styles.headerTitle}>Registrar Pago</Text>
        </View>
      </View>
      
      <ScrollView style={styles.scrollContainer}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text style={styles.gastoInfo}>
              {gastoBase.descripcion} - Cuota {numeroCuota}
            </Text>
            <Text style={styles.gastoInfo}>
              Total cuota: {formatearMonto(todosLosDetalles.reduce((sum, d) => sum + d.monto, 0))}
            </Text>
          </Card.Content>
        </Card>

      {/* Selección de detalle */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Seleccionar Participante</Title>
          {detallesPendientes.length === 0 ? (
            <Text style={styles.noDataText}>No hay pagos pendientes</Text>
          ) : (
            (() => {
              // Agrupar detalles por mes
              const detallesPorMes = detallesPendientes.reduce((acc, detalle) => {
                const gastoDelDetalle = gastosCuota.find(g => g.detalles?.some(d => d.id === detalle.id))
                if (gastoDelDetalle) {
                  const fecha = new Date(gastoDelDetalle.fecha)
                  const mesAno = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
                  if (!acc[mesAno]) {
                    acc[mesAno] = []
                  }
                  acc[mesAno].push(detalle)
                }
                return acc
              }, {} as Record<string, typeof detallesPendientes>)

              // Ordenar los meses
              const mesesOrdenados = Object.keys(detallesPorMes).sort()

              return mesesOrdenados.map((mesAno, mesIndex) => {
                const detallesMes = detallesPorMes[mesAno]
                const [ano, mes] = mesAno.split('-')
                const nombreMes = new Date(parseInt(ano), parseInt(mes) - 1).toLocaleDateString('es-AR', { 
                  month: 'long', 
                  year: 'numeric' 
                })
                
                return (
                  <View key={`mes-${mesAno}`}>
                    {/* Header del mes */}
                    <View style={styles.cuotaHeader}>
                      <Text style={styles.cuotaTitle}>{nombreMes}</Text>
                    </View>
                    
                    {/* Participantes del mes */}
                    {detallesMes.map((detalle, detalleIndex) => {
                      const montoRestante = getMontoRestante(detalle)
                      const isSelected = detalleSeleccionado?.id === detalle.id
                      
                      return (
                        <View key={detalle.id}>
                          <List.Item
                            title={detalle.usuario?.nickname || detalle.nombre_participante || 'Participante'}
                            description={`Restante: ${formatearMonto(montoRestante)}`}
                            left={() => (
                              <RadioButton
                                value={detalle.id}
                                status={isSelected ? 'checked' : 'unchecked'}
                                onPress={() => seleccionarDetalle(detalle)}
                              />
                            )}
                            onPress={() => seleccionarDetalle(detalle)}
                            style={[
                              styles.detalleItem,
                              isSelected && styles.detalleItemSelected
                            ]}
                          />
                          {detalleIndex < detallesMes.length - 1 && <Divider style={styles.participanteDivider} />}
                        </View>
                      )
                    })}
                    
                    {/* Separador entre meses */}
                    {mesIndex < mesesOrdenados.length - 1 && (
                      <Divider style={styles.cuotaDivider} />
                    )}
                  </View>
                )
              })
            })()
          )}
        </Card.Content>
      </Card>

      {/* Formulario de pago */}
      {detalleSeleccionado && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Datos del Pago</Title>
            
            <TextInput
              label="Monto"
              value={monto}
              onChangeText={setMonto}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="currency-usd" />}
            />

            <Text style={styles.medioPagoLabel}>Medio de Pago</Text>
            <RadioButton.Group
              onValueChange={(value) => setMedioPago(value as MedioPago)}
              value={medioPago}
            >
              <View style={styles.radioContainer}>
                <RadioButton.Item
                  label="Efectivo"
                  value="efectivo"
                  style={styles.radioItem}
                />
                <RadioButton.Item
                  label="Transferencia"
                  value="transferencia"
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
          onPress={registrarPago}
          loading={guardando}
          disabled={guardando || !detalleSeleccionado || !monto}
          style={styles.actionButton}
          icon="check"
        >
          Registrar Pago
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
  detalleItem: {
    paddingVertical: 8,
  },
  detalleItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  cuotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginVertical: 8,
    borderRadius: 8,
  },
  cuotaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cuotaVencimiento: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  participanteDivider: {
    marginVertical: 4,
  },
  cuotaDivider: {
    marginVertical: 16,
    height: 2,
    backgroundColor: '#e0e0e0',
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