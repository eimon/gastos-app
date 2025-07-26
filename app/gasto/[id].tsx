// app/gasto/[id].tsx - Vista de detalle de gasto
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from 'react-native'
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  IconButton,
  Divider,
  List,
  Badge,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { supabase, gastosService, Gasto, GastoDetalle } from '../../lib/supabase'
import { showAlert } from '../../lib/alerts'

export default function GastoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [gasto, setGasto] = useState<Gasto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)


  useEffect(() => {
    if (id) {
      cargarGastoDetalle()
    }
  }, [id])

  // Recargar datos cuando la pantalla se enfoque (útil al volver del registro de pago)
  useFocusEffect(
    useCallback(() => {
      if (id) {
        cargarGastoDetalle()
      }
    }, [id])
  )

  const cargarGastoDetalle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !id) return

      // Obtener el gasto con sus detalles
      const { data: gastoData, error } = await supabase
        .from('gastos')
        .select(`
          *,
          detalles:gastos_detalle(
            *,
            usuario:usuarios(*),
            pagos(*)
          )
        `)
        .eq('id', id)
        .eq('usuario_id', user.id)
        .single()

      if (error) throw error
      setGasto(gastoData)
    } catch (error: any) {
      console.error('Error cargando detalle del gasto:', error)
      showAlert('Error', 'No se pudo cargar el detalle del gasto')
      router.back()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarGastoDetalle()
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getTipoColor = (tipo: string) => {
    return tipo === 'personal' ? '#4CAF50' : '#FF9800'
  }

  const getTipoIcon = (tipo: string) => {
    return tipo === 'personal' ? 'account' : 'account-group'
  }

  // Función para obtener el saldo pagado de un detalle
  const getSaldoPagado = (detalle: GastoDetalle) => {
    return detalle.pagado ? detalle.monto : 0
  }

  const calcularProgresoPago = () => {
    if (!gasto?.detalles) return 0
    const detallesArray = Array.isArray(gasto.detalles) ? gasto.detalles : []
    if (detallesArray.length === 0) return 0
    
    const totalMonto = detallesArray.reduce((sum, d) => sum + d.monto, 0)
    const montoPagado = detallesArray.filter(d => d.pagado).reduce((sum, d) => sum + d.monto, 0)
    
    return totalMonto > 0 ? (montoPagado / totalMonto) * 100 : 0
  }

  const agruparPorCuotas = (detalles: GastoDetalle[]) => {
    if (!Array.isArray(detalles)) return {}
    
    return detalles.reduce((grupos, detalle) => {
      const cuota = detalle.numero_cuota || 1
      if (!grupos[cuota]) {
        grupos[cuota] = []
      }
      grupos[cuota].push(detalle)
      return grupos
    }, {} as Record<number, GastoDetalle[]>)
  }

  const getEstadoPago = (detalle: GastoDetalle) => {
    if (detalle.pagado) {
      return { estado: 'Pagado', color: '#4CAF50', icon: 'check-circle' }
    } else {
      return { estado: 'Pendiente', color: '#f44336', icon: 'close-circle' }
    }
  }



  // Función para calcular balance neto de todos los participantes
  const calcularBalancesNetos = () => {
    if (!gasto?.detalles) return []
    
    const detallesArray = Array.isArray(gasto.detalles) ? gasto.detalles : []
    
    return detallesArray.map(detalle => {
      const saldoPagado = getSaldoPagado(detalle)
      const montoTotal = detalle.monto
      const balance = saldoPagado - montoTotal // Positivo = acreedor, Negativo = deudor
      
      return {
        participanteId: detalle.usuario?.id || '',
        nickname: detalle.usuario?.nickname || detalle.nombre_participante || 'Participante',
        balance: Math.round(balance * 100) / 100
      }
    }).filter(b => Math.abs(b.balance) > 0.01) // Solo incluir balances significativos
  }



  // Función para calcular las deudas entre participantes
  const calcularDeudasParticipante = (participanteId: string) => {
    const balances = calcularBalancesNetos()
    const participante = balances.find(b => b.participanteId === participanteId)
    
    if (!participante || participante.balance >= 0) return [] // No debe nada o es acreedor
    
    const montoAdeudado = Math.abs(participante.balance)
    const acreedores = balances
      .filter(b => b.balance > 0)
      .sort((a, b) => b.balance - a.balance) // Ordenar por mayor crédito primero
    
    if (acreedores.length === 0) return []
    
    const deudas = []
    let montoRestante = montoAdeudado
    
    for (const acreedor of acreedores) {
      if (montoRestante <= 0.01) break
      
      const montoPago = Math.min(montoRestante, acreedor.balance)
      
      if (montoPago > 0.01) {
        deudas.push({
          acreedor: acreedor.nickname,
          monto: Math.round(montoPago * 100) / 100
        })
        montoRestante -= montoPago
      }
    }
    
    return deudas
  }
  

  


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando...</Text>
      </View>
    )
  }

  if (!gasto) {
    return (
      <View style={styles.errorContainer}>
        <Text>No se encontró el gasto</Text>
      </View>
    )
  }

  const progreso = calcularProgresoPago()
  const detallesArray = Array.isArray(gasto.detalles) ? gasto.detalles : []
  // Calcular el "total pagado" como la diferencia entre el total y las diferencias absolutas
  const totalDiferenciasAbsolutas = detallesArray.reduce((sum, d) => {
    const monto = d.monto || 0
    const saldo = getSaldoPagado(d)
    return sum + Math.abs(monto - saldo)
  }, 0)
  const totalMonto = detallesArray.reduce((sum, d) => sum + d.monto, 0)
  const totalPagado = totalMonto - totalDiferenciasAbsolutas
  const gruposCuotas = agruparPorCuotas(detallesArray)

  return (
    <View style={styles.container}>
      {/* Header similar al de la pestaña de gastos */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>Detalle de gasto</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header con información principal */}
        <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.gastoInfo}>
            <Title style={styles.titulo}>{gasto.descripcion}</Title>
            <Chip
              icon={getTipoIcon(gasto.tipo)}
              style={[styles.tipoChip, { backgroundColor: getTipoColor(gasto.tipo) }]}
              textStyle={styles.tipoChipText}
            >
              {gasto.tipo === 'personal' ? 'Personal' : 'Compartido'}
            </Chip>
          </View>

          <View style={styles.montoContainer}>
            <Text style={styles.montoTotal}>{formatearMonto(gasto.monto || 0)}</Text>
            <Text style={styles.montoPagado}>
              Pagado: {formatearMonto(totalPagado)}
            </Text>
            {(gasto.descuento || 0) > 0 && (
              <Text style={styles.descuentoText}>
                Descuento aplicado: {formatearMonto(gasto.descuento || 0)}
              </Text>
            )}
            <Text style={styles.montoRestante}>
              Restante: {formatearMonto(detallesArray.filter(d => !d.pagado).reduce((sum, d) => sum + d.monto, 0))}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha</Text>
              <Text style={styles.infoValue}>{formatearFecha(gasto.fecha)}</Text>
            </View>
            {(gasto.cuotas || 1) > 1 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Cuotas</Text>
                <Text style={styles.infoValue}>{gasto.cuotas || 1}</Text>
              </View>
            )}
            {(gasto.descuento || 0) > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Descuento</Text>
                <Text style={styles.infoValue}>{formatearMonto(gasto.descuento || 0)}</Text>
              </View>
            )}
          </View>

          <View style={styles.progresoContainer}>
            <View style={styles.progresoBar}>
              <View
                style={[
                  styles.progresoFill,
                  { 
                    width: `${progreso}%`, 
                    backgroundColor: progreso === 100 ? '#4CAF50' : '#2196F3' 
                  }
                ]}
              />
            </View>
            <Text style={styles.progresoText}>
              {Math.round(progreso)}% completado
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Detalles agrupados por cuotas */}
      <Card style={styles.detallesCard}>
        <Card.Content>
          <Title style={styles.detallesTitle}>Detalles del Gasto</Title>
          
          {Object.keys(gruposCuotas).sort((a, b) => Number(a) - Number(b)).map(cuotaNum => {
            const detallesCuota = gruposCuotas[Number(cuotaNum)]
            const totalCuota = detallesCuota.reduce((sum, d) => sum + d.monto, 0)
            // Calcular progreso de cuota usando diferencias absolutas
            const diferenciasAbsolutasCuota = detallesCuota.reduce((sum, d) => {
              const monto = d.monto || 0
              const saldo = getSaldoPagado(d)
              return sum + Math.abs(monto - saldo)
            }, 0)
            const progresoCuota = totalCuota > 0 ? Math.max(0, ((totalCuota - diferenciasAbsolutasCuota) / totalCuota) * 100) : 0
            
            return (
              <View key={cuotaNum} style={styles.cuotaContainer}>
                {gasto.cuotas > 1 && (
                  <View style={styles.cuotaHeader}>
                    <Text style={styles.cuotaTitle}>Cuota {cuotaNum}</Text>
                    <Badge 
                      style={[
                        styles.cuotaBadge,
                        { backgroundColor: progresoCuota === 100 ? '#4CAF50' : '#2196F3' }
                      ]}
                    >
                      {Math.round(progresoCuota)}%
                    </Badge>
                  </View>
                )}
                
                {detallesCuota.map((detalle, index) => {
                  const estadoPago = getEstadoPago(detalle)
                  const deudas = calcularDeudasParticipante(detalle.usuario?.id || '')
                  const saldoActual = getSaldoPagado(detalle)
                  const montoTotal = detalle.monto
                  const montoPendiente = montoTotal - saldoActual
                  const esCreador = gasto.usuario_id === detalle.usuario?.id
                  
                  return (
                    <View key={detalle.id} style={styles.detalleItem}>
                      <List.Item
                        title={detalle.usuario?.nickname || detalle.nombre_participante || 'Participante'}
                        description={`${formatearMonto(detalle.monto)} - ${formatearMonto(getSaldoPagado(detalle))} pagado`}
                        left={() => (
                          <View style={styles.participanteIcon}>
                            <Ionicons 
                              name="people-outline" 
                              size={20} 
                              color="#666" 
                            />
                          </View>
                        )}
                        right={() => (
                          <View style={styles.estadoContainer}>
                            <Chip
                              icon={estadoPago.icon}
                              style={[styles.estadoChip, { backgroundColor: estadoPago.color }]}
                              textStyle={styles.estadoChipText}
                              compact
                            >
                              {estadoPago.estado}
                            </Chip>
                          </View>
                        )}
                      />
                      
                      {/* Mostrar deudas específicas */}
                      {deudas.length > 0 && (
                        <View style={styles.deudasContainer}>
                          <Text style={styles.deudasTitle}>Debe pagar:</Text>
                          {deudas.map((deuda, deudaIndex) => (
                            <Text key={deudaIndex} style={styles.deudaText}>
                              • {formatearMonto(deuda.monto)} a {deuda.acreedor}
                            </Text>
                          ))}
                        </View>
                      )}
                      

                      
                      {detalle.vencimiento && (
                        <Text style={styles.vencimientoText}>
                          Vence: {formatearFecha(detalle.vencimiento)}
                        </Text>
                      )}
                      
                      {index < detallesCuota.length - 1 && <Divider />}
                    </View>
                  )
                })}
                
                {Number(cuotaNum) < Math.max(...Object.keys(gruposCuotas).map(Number)) && (
                  <Divider style={styles.cuotaDivider} />
                )}
              </View>
            )
          })}
        </Card.Content>
      </Card>

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        <Button
          mode="contained"
          onPress={() => router.push(`/gasto/${gasto.id}/pagar`)}
          icon="credit-card"
          disabled={progreso === 100}
          style={styles.actionButton}
        >
          {progreso === 100 ? 'Completamente Pagado' : 'Registrar Pago'}
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
    padding: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 16,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tipoChip: {
    alignSelf: 'flex-start',
  },
  tipoChipText: {
    color: 'white',
    fontWeight: 'bold',
  },
  montoContainer: {
    marginBottom: 16,
  },
  montoTotal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  montoPagado: {
    fontSize: 16,
    color: '#4CAF50',
    marginBottom: 2,
  },
  descuentoText: {
    fontSize: 14,
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  montoRestante: {
    fontSize: 16,
    color: '#f44336',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  progresoContainer: {
    marginTop: 8,
  },
  progresoBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progresoFill: {
    height: '100%',
    borderRadius: 4,
  },
  progresoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  detallesCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  detallesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cuotaContainer: {
    marginBottom: 16,
  },
  cuotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  cuotaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cuotaBadge: {
    color: 'white',
  },
  cuotaDivider: {
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#ddd',
    height: 2,
  },
  detalleItem: {
    marginBottom: 8,
  },
  participanteIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  estadoContainer: {
    justifyContent: 'center',
  },
  estadoChip: {
    height: 28,
  },
  estadoChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  vencimientoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 56,
    marginTop: 4,
  },
  actionsContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  actionButton: {
    marginBottom: 8,
  },

  deudasContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  deudasTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  deudaText: {
    fontSize: 11,
    color: '#BF360C',
    marginLeft: 8,
  },
})