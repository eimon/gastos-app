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
  Modal,
  Portal,
  TextInput,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { supabase, gastosService, pagosService, Gasto, GastoDetalle, GastoCuotaUnificada } from '../../lib/supabase'
import { showAlert, showSuccessToast, showConfirm } from '../../lib/alerts'
import RecurringIcon from '../../components/RecurringIcon'

export default function GastoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [gastosCuota, setGastosCuota] = useState<Gasto[]>([])
  const [gastoBase, setGastoBase] = useState<Gasto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [gastoId, setGastoId] = useState<string>('')
  const [numeroCuota, setNumeroCuota] = useState<number>(1)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingDetalle, setEditingDetalle] = useState<GastoDetalle | null>(null)
  const [nuevoMonto, setNuevoMonto] = useState('')


  useEffect(() => {
    if (id) {
      // Parsear el ID que viene en formato: gasto_id-cuota-numero_cuota
      const parts = id.split('-cuota-')
      if (parts.length === 2) {
        setGastoId(parts[0])
        setNumeroCuota(parseInt(parts[1]))
        cargarGastoDetalle(parts[0], parseInt(parts[1]))
      }
    }
  }, [id])

  // Recargar datos cuando la pantalla se enfoque (útil al volver del registro de pago)
  useFocusEffect(
    useCallback(() => {
      if (gastoId && numeroCuota) {
        cargarGastoDetalle(gastoId, numeroCuota)
      }
    }, [gastoId, numeroCuota])
  )

  const cargarGastoDetalle = async (gastoIdParam: string, numeroCuotaParam: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !gastoIdParam) return

      // Obtener el gasto base
      const { data: gastoBaseData, error: gastoError } = await supabase
        .from('gastos')
        .select('*')
        .eq('id', gastoIdParam)
        .single()

      if (gastoError) throw gastoError
      setGastoBase(gastoBaseData)

      // Obtener todos los gastos de esta cuota específica
      const { data: detallesData, error: detallesError } = await supabase
        .from('gastos_detalle')
        .select(`
          *,
          gasto:gastos(*),
          usuario:usuarios(*),
          pagos(*)
        `)
        .eq('gasto_id', gastoIdParam)
        .eq('numero_cuota', numeroCuotaParam)
        .not('gasto', 'is', null)

      if (detallesError) throw detallesError

      // Convertir detalles a gastos individuales agrupados por mes
      const gastosIndividuales = detallesData.map(detalle => {
        const gastoBase = detalle.gasto!
        return {
          ...gastoBase,
          monto: detalle.monto,
          fecha: detalle.vencimiento,
          numero_cuota: detalle.numero_cuota,
          detalles: [{
            ...detalle,
            gasto: undefined // Evitar referencia circular
          }]
        }
      })

      setGastosCuota(gastosIndividuales)
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
    if (gastoId && numeroCuota) {
      cargarGastoDetalle(gastoId, numeroCuota)
    }
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    // Crear fecha local para evitar problemas de zona horaria
    const [año, mes, dia] = fecha.split('-').map(Number)
    const fechaLocal = new Date(año, mes - 1, dia)
    return fechaLocal.toLocaleDateString('es-AR', {
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

  const getMontoRestante = (detalle: GastoDetalle) => {
    if (detalle.pagado || detalle.monto === 0) return 0
    
    // Calcular el total pagado de este detalle
    const pagos = Array.isArray(detalle.pagos) ? detalle.pagos : []
    const totalPagado = pagos.reduce((sum, pago) => sum + (pago.monto || 0), 0)
    
    // El monto restante es el monto total menos lo ya pagado
    return Math.max(0, detalle.monto - totalPagado)
  }

  const confirmarPagoDirecto = (detalle: GastoDetalle) => {
    const montoRestante = getMontoRestante(detalle)
    const nombreParticipante = detalle.usuario?.nombre || detalle.usuario?.email || 'Participante'
    
    showConfirm(
      'Confirmar Pago',
      `¿Confirmar el pago de ${formatearMonto(montoRestante)} para ${nombreParticipante}?`,
      () => registrarPagoDirecto(detalle, montoRestante),
      () => {}
    )
  }

  const registrarPagoDirecto = async (detalle: GastoDetalle, monto: number) => {
    try {
      // Obtener el usuario actual para usar el servicio de pagos
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.id) {
        throw new Error('Usuario no autenticado')
      }

      // Usar el servicio de pagos que incluye la lógica de generación automática de gastos recurrentes
      await pagosService.crearPago({
        gasto_detalle_id: detalle.id,
        monto: monto,
        medio_pago: 'efectivo', // Por defecto efectivo
        fecha_pago: new Date().toISOString().split('T')[0],
        notas: 'Pago registrado directamente'
      }, user.id)

      // Si el pago cubre el monto total, marcar como pagado
      if (monto === detalle.monto) {
        const { error: updateError } = await supabase
          .from('gastos_detalle')
          .update({ pagado: true })
          .eq('id', detalle.id)
        
        if (updateError) throw updateError
      }

      showSuccessToast('Pago registrado correctamente')
      // Recargar los datos
      if (gastoId && numeroCuota) {
        cargarGastoDetalle(gastoId, numeroCuota)
      }
    } catch (error: any) {
      console.error('Error registrando pago:', error)
      showAlert('Error', error.message || 'No se pudo registrar el pago')
    }
  }

  // Función para obtener el saldo pagado de un detalle
  const getSaldoPagado = (detalle: GastoDetalle) => {
    return detalle.pagado ? detalle.monto : 0
  }

  const calcularProgresoPago = () => {
    if (gastosCuota.length === 0) return 0
    
    const todosLosDetalles = gastosCuota.flatMap(gasto => 
      Array.isArray(gasto.detalles) ? gasto.detalles : []
    )
    
    if (todosLosDetalles.length === 0) return 0
    
    const totalMonto = todosLosDetalles.reduce((sum, d) => sum + d.monto, 0)
    
    // Considerar gastos con monto 0 como pagados al 100%
    const montoPagado = todosLosDetalles.reduce((sum, d) => {
      if (d.monto === 0) {
        // Los gastos con monto 0 se consideran pagados completamente
        return sum + 0 // No contribuyen al monto pagado pero tampoco al total
      }
      return sum + (d.pagado ? d.monto : 0)
    }, 0)
    
    return totalMonto > 0 ? (montoPagado / totalMonto) * 100 : 100
  }

  const agruparPorMes = (gastos: Gasto[]) => {
    if (!Array.isArray(gastos)) return {}
    
    return gastos.reduce((grupos, gasto) => {
      const fecha = new Date(gasto.fecha)
      const mesAno = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      const nombreMes = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      
      if (!grupos[mesAno]) {
        grupos[mesAno] = {
          nombre: nombreMes,
          gastos: []
        }
      }
      grupos[mesAno].gastos.push(gasto)
      return grupos
    }, {} as Record<string, { nombre: string; gastos: Gasto[] }>)
  }

  const getEstadoPago = (detalle: GastoDetalle) => {
    // Los gastos con monto 0 se consideran pagados automáticamente
    if (detalle.pagado || detalle.monto === 0) {
      return { estado: 'Pagado', color: '#4CAF50', icon: 'check-circle' }
    } else {
      return { estado: 'Pendiente', color: '#f44336', icon: 'close-circle' }
    }
  }



  // Función para calcular balance neto de todos los participantes
  const calcularBalancesNetos = () => {
    if (gastosCuota.length === 0) return []
    
    const todosLosDetalles = gastosCuota.flatMap(gasto => 
      Array.isArray(gasto.detalles) ? gasto.detalles : []
    )
    
    return todosLosDetalles.map(detalle => {
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

  // Función para manejar la edición del monto
  const handleEditMonto = (detalle: GastoDetalle) => {
    setEditingDetalle(detalle)
    setNuevoMonto(detalle.monto.toString())
    setEditModalVisible(true)
  }

  // Función para guardar el nuevo monto
  const handleGuardarMonto = async () => {
    if (!editingDetalle || !nuevoMonto) return

    const montoNumerico = parseFloat(nuevoMonto)
    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      showAlert('Error', 'Por favor ingresa un monto válido')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Usar la función de supabase que maneja todo el recálculo
      await gastosService.actualizarMontoDetalle(editingDetalle.id, montoNumerico, user.id)

      showSuccessToast('Monto actualizado correctamente')
      setEditModalVisible(false)
      setEditingDetalle(null)
      setNuevoMonto('')
      
      // Recargar los datos
      cargarGastoDetalle(gastoId, numeroCuota)
    } catch (error: any) {
      console.error('Error actualizando monto:', error)
      showAlert('Error', error.message || 'No se pudo actualizar el monto')
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

  const progreso = calcularProgresoPago()
  const todosLosDetalles = gastosCuota.flatMap(gasto => 
    Array.isArray(gasto.detalles) ? gasto.detalles : []
  )
  
  // Calcular el "total pagado" como la diferencia entre el total y las diferencias absolutas
  const totalDiferenciasAbsolutas = todosLosDetalles.reduce((sum, d) => {
    const monto = d.monto || 0
    const saldo = getSaldoPagado(d)
    return sum + Math.abs(monto - saldo)
  }, 0)
  const totalMonto = todosLosDetalles.reduce((sum, d) => sum + d.monto, 0)
  const totalPagado = totalMonto - totalDiferenciasAbsolutas
  const gruposMeses = agruparPorMes(gastosCuota)
  
  // Calcular deudas globales para el resumen
  const calcularDeudasGlobales = () => {
    const balances = calcularBalancesNetos()
    const deudores = balances.filter(b => b.balance < -0.01)
    const acreedores = balances.filter(b => b.balance > 0.01)
    
    const deudas = []
    
    for (const deudor of deudores) {
      const montoAdeudado = Math.abs(deudor.balance)
      let montoRestante = montoAdeudado
      
      for (const acreedor of acreedores) {
        if (montoRestante <= 0.01) break
        
        const montoPago = Math.min(montoRestante, acreedor.balance)
        
        if (montoPago > 0.01) {
          deudas.push({
            deudor: deudor.nickname,
            acreedor: acreedor.nickname,
            monto: Math.round(montoPago * 100) / 100
          })
          montoRestante -= montoPago
          acreedor.balance -= montoPago
        }
      }
    }
    
    return deudas
  }
  
  const deudas = calcularDeudasGlobales()

  const eliminarPago = async (pagoId: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este pago?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await pagosService.eliminarPago(pagoId)
              showSuccessToast('Pago eliminado correctamente')
              // Recargar los datos
              if (gastoId && numeroCuota) {
                cargarGastoDetalle(gastoId, numeroCuota)
              }
            } catch (error: any) {
              console.error('Error eliminando pago:', error)
              showAlert('Error', 'No se pudo eliminar el pago')
            }
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* Header similar al de la pestaña de gastos */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.push('/(tabs)/gastos')}
          />
          <Text style={styles.headerTitle}>Detalle de gasto</Text>
          {gastoBase?.es_recurrente && (
            <View style={styles.recurringIconContainer}>
              <RecurringIcon 
                size={20} 
                color="#2196F3" 
                showTooltip={false}
                tooltipText="Este gasto se generará automáticamente cuando llegue al 100%"
              />
            </View>
          )}
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
            <Title style={styles.titulo}>
              {gastoBase.descripcion}{gastoBase.cuotas > 1 ? ` - Cuota ${numeroCuota}` : ''}
            </Title>
            <Chip
              icon={getTipoIcon(gastoBase.tipo)}
              style={[styles.tipoChip, { backgroundColor: getTipoColor(gastoBase.tipo) }]}
              textStyle={styles.tipoChipText}
            >
              {gastoBase.tipo === 'personal' ? 'Personal' : 'Compartido'}
            </Chip>
          </View>

          <View style={styles.montoContainer}>
            <Text style={styles.montoTotal}>{formatearMonto(totalMonto)}</Text>
            <Text style={styles.montoPagado}>
              Pagado: {formatearMonto(totalPagado)}
            </Text>
            {(gastoBase.descuento || 0) > 0 && (
              <Text style={styles.descuentoText}>
                Descuento aplicado: {formatearMonto(gastoBase.descuento || 0)}
              </Text>
            )}
            <Text style={styles.montoRestante}>
              Restante: {formatearMonto(todosLosDetalles.filter(d => !d.pagado).reduce((sum, d) => sum + d.monto, 0))}
            </Text>
          </View>

          <View style={styles.infoRow}>
            {(gastoBase.cuotas || 1) > 1 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Cuota</Text>
                <Text style={styles.infoValue}>{numeroCuota} de {gastoBase.cuotas || 1}</Text>
              </View>
            )}
            {gastoBase.tipo !== 'personal' && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Participantes</Text>
                <Text style={styles.infoValue}>{todosLosDetalles.length}</Text>
              </View>
            )}
            {(gastoBase.descuento || 0) > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Descuento</Text>
                <Text style={styles.infoValue}>{formatearMonto(gastoBase.descuento || 0)}</Text>
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

      {/* Detalles agrupados por mes */}
      {gastoBase.tipo !== 'personal' && (
        <Card style={styles.detallesCard}>
          <Card.Content>
            <Title style={styles.detallesTitle}>
              Participantes{gastoBase.cuotas > 1 ? ` de la Cuota ${numeroCuota}` : ''}
            </Title>
          
          {Object.keys(gruposMeses).sort().map(mesKey => {
            const grupoMes = gruposMeses[mesKey]
            const gastosDelMes = grupoMes.gastos
            const detallesDelMes = gastosDelMes.flatMap(gasto => 
              Array.isArray(gasto.detalles) ? gasto.detalles : []
            )
            const totalMes = detallesDelMes.reduce((sum, d) => sum + d.monto, 0)
            const pagadoMes = detallesDelMes.filter(d => d.pagado).reduce((sum, d) => sum + d.monto, 0)
            const progresoMes = totalMes > 0 ? (pagadoMes / totalMes) * 100 : 0
            
            return (
              <View key={mesKey} style={styles.cuotaContainer}>
                <View style={styles.cuotaHeader}>
                  <Text style={styles.cuotaTitle}>{grupoMes.nombre}</Text>
                  <Badge 
                    style={[
                      styles.cuotaBadge,
                      { backgroundColor: progresoMes === 100 ? '#4CAF50' : '#2196F3' }
                    ]}
                  >
                    {Math.round(progresoMes)}%
                  </Badge>
                </View>
                
                {detallesDelMes.map((detalle, index) => {
                  const estadoPago = getEstadoPago(detalle)
                  const deudas = calcularDeudasParticipante(detalle.usuario?.id || '')
                  const tienePagos = detalle.pagos && detalle.pagos.length > 0
                  
                  return (
                    <View key={detalle.id} style={styles.detalleItem}>
                      <List.Item
                        title={detalle.usuario?.nickname || detalle.nombre_participante || 'Participante'}
                        description={
                          <View style={styles.montoDescriptionContainer}>
                            <Text>{formatearMonto(detalle.monto)} - {formatearMonto(getSaldoPagado(detalle))} pagado</Text>
                            {!tienePagos && (
                              <IconButton
                                icon="pencil"
                                size={16}
                                iconColor="#666"
                                style={styles.editIcon}
                                onPress={() => handleEditMonto(detalle)}
                              />
                            )}
                          </View>
                        }
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
                        onPress={!detalle.pagado && detalle.monto > 0 ? () => confirmarPagoDirecto(detalle) : undefined}
                        style={[styles.participanteRow, !detalle.pagado && detalle.monto > 0 && styles.participanteRowClickable]}
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
                      
                      {index < detallesDelMes.length - 1 && <Divider />}
                    </View>
                  )
                })}
                
                {Object.keys(gruposMeses).indexOf(mesKey) < Object.keys(gruposMeses).length - 1 && (
                  <Divider style={styles.cuotaDivider} />
                )}
              </View>
            )
          })}
        </Card.Content>
      </Card>
      )}

      {/* Historial de Pagos */}
      {(() => {
        const todosLosDetalles = gastosCuota.flatMap(gasto => 
          Array.isArray(gasto.detalles) ? gasto.detalles : []
        )
        const todosLosPagos = todosLosDetalles.flatMap(detalle => 
          Array.isArray(detalle.pagos) ? detalle.pagos.map(pago => ({
            ...pago,
            detalle: detalle,
            participante: detalle.usuario?.nickname || detalle.nombre_participante || 'Participante'
          })) : []
        )
        
        if (todosLosPagos.length === 0) return null
        
        return (
          <Card style={styles.detallesCard}>
            <Card.Content>
              <Title style={styles.detallesTitle}>Historial de Pagos</Title>
              {todosLosPagos.map((pago, index) => (
                <View key={pago.id} style={styles.pagoItem}>
                  <List.Item
                    title={`${pago.participante} - ${formatearMonto(pago.monto)}`}
                    description={`${pago.medio_pago} - ${formatearFecha(pago.fecha_pago)}${pago.notas ? ` - ${pago.notas}` : ''}`}
                    left={() => (
                      <View style={styles.participanteIcon}>
                        <Ionicons 
                          name="cash-outline" 
                          size={20} 
                          color="#4CAF50" 
                        />
                      </View>
                    )}
                    right={() => (
                      <IconButton
                        icon="delete"
                        size={20}
                        iconColor="#f44336"
                        onPress={() => eliminarPago(pago.id)}
                      />
                    )}
                  />
                  {index < todosLosPagos.length - 1 && <Divider />}
                </View>
              ))}
            </Card.Content>
          </Card>
        )
      })()}

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        {progreso < 100 && gastoBase?.tipo === 'personal' && (
          <Button
            mode="contained"
            onPress={() => router.push(`/gasto/${gastoId}-cuota-${numeroCuota}/pagar-todo`)}
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            icon="cash-multiple"
          >
            Pagar Todo
          </Button>
        )}

        <Button
          mode="outlined"
          onPress={() => router.push(`/gastos/editar/${gastoId}`)}
          style={styles.actionButton}
          icon="pencil"
        >
          Editar Gasto
        </Button>
      </View>

      {/* Resumen de deudas */}
      {deudas.length > 0 && (
        <View style={styles.deudasContainer}>
          <Text style={styles.deudasTitle}>Resumen de Deudas:</Text>
          {deudas.map((deuda, index) => (
            <Text key={index} style={styles.deudaText}>
              • {deuda.deudor} debe {formatearMonto(deuda.monto)} a {deuda.acreedor}
            </Text>
          ))}
        </View>
      )}

      {/* Modal de edición de monto */}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            padding: 20,
            margin: 20,
            borderRadius: 8,
          }}
        >
          <Title>Editar Monto</Title>
          <Paragraph style={{ marginBottom: 16 }}>
            Participante: {editingDetalle?.usuario?.nickname || editingDetalle?.nombre_participante || 'Participante'}
          </Paragraph>
          <TextInput
            label="Nuevo Monto"
            value={nuevoMonto}
            onChangeText={setNuevoMonto}
            keyboardType="numeric"
            mode="outlined"
            style={{ marginBottom: 16 }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              mode="outlined"
              onPress={() => setEditModalVisible(false)}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleGuardarMonto}
            >
              Guardar
            </Button>
          </View>
        </Modal>
      </Portal>
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
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
    flex: 1,
  },
  recurringIconContainer: {
    marginLeft: 8,
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
  pagoItem: {
    marginBottom: 8,
  },
  participanteRow: {
    borderRadius: 8,
  },
  participanteRowClickable: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  montoDescriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editIcon: {
    margin: 0,
    padding: 0,
  },
})