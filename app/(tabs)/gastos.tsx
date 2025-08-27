// app/(tabs)/gastos.tsx - Pantalla de gastos
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native'
import {
  Card,
  Title,
  Paragraph,
  Button,
  FAB,
  Chip,
  IconButton,
  Searchbar,
  Modal,
  Portal,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase, gastosService, solicitudesPagoService, Gasto, GastoCuotaUnificada, TipoGasto, SolicitudPagoCreate } from '../../lib/supabase'
import { router } from 'expo-router'
import { showAlert, showConfirm } from '../../lib/alerts'
import { useFocusEffect } from '@react-navigation/native'
import RecurringIcon from '../../components/RecurringIcon'
import { useMonth } from '../../contexts/MonthContext'

export default function GastosScreen() {
  const [gastosUnificados, setGastosUnificados] = useState<GastoCuotaUnificada[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoGasto | 'todos'>('todos')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [gastoAEliminar, setGastoAEliminar] = useState<GastoCuotaUnificada | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [showPaymentRequestModal, setShowPaymentRequestModal] = useState(false)
  const [gastoParaSolicitud, setGastoParaSolicitud] = useState<GastoCuotaUnificada | null>(null)
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { mesActual, añoActual, navegarMesAnterior, navegarMesSiguiente } = useMonth()

  // Recargar datos cada vez que se enfoque la pestaña o cambien mes/año
  useFocusEffect(
    React.useCallback(() => {
      cargarGastos()
    }, [mesActual, añoActual])
  )



  const cargarGastos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.id) {
        setLoading(false)
        setRefreshing(false)
        return
      }

      setCurrentUserId(user.id)
      
      // Cargar gastos unificados (incluye propios y compartidos)
      const gastosUnificadosData = await gastosService.obtenerGastosCuotasUnificadas(user.id, mesActual, añoActual)
      setGastosUnificados(gastosUnificadosData)
      
    } catch (error) {
      showAlert('Error', 'No se pudieron cargar los gastos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarGastos()
  }

  const eliminarGasto = async () => {
    if (!gastoAEliminar) return
    
    setEliminando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.id) {
        return
      }

      await gastosService.eliminarGasto(gastoAEliminar.gasto_id, user.id)
      await cargarGastos()
      setShowDeleteModal(false)
      setGastoAEliminar(null)
      showAlert('Éxito', 'Gasto eliminado correctamente')
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo eliminar el gasto')
    } finally {
      setEliminando(false)
    }
  }

  const confirmarEliminar = (gasto: GastoCuotaUnificada) => {
    setGastoAEliminar(gasto)
    setShowDeleteModal(true)
  }

  const cancelarEliminar = () => {
    setShowDeleteModal(false)
    setGastoAEliminar(null)
  }

  const confirmarSolicitudPago = (gasto: GastoCuotaUnificada) => {
    setGastoParaSolicitud(gasto)
    setShowPaymentRequestModal(true)
  }

  const cancelarSolicitudPago = () => {
    setShowPaymentRequestModal(false)
    setGastoParaSolicitud(null)
  }

  const crearSolicitudPago = async (gasto: GastoCuotaUnificada) => {
    setEnviandoSolicitud(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.id) {
        showAlert('Error', 'Usuario no autenticado')
        return
      }

      let gastoDetalleId: string
      
      // Si el gasto tiene participantes cargados, buscar ahí
      if (gasto.participantes && gasto.participantes.length > 0) {
        const participanteUsuario = gasto.participantes.find(p => p.usuario_id === user.id)
        if (!participanteUsuario) {
          showAlert('Error', 'No se encontró tu participación en este gasto')
          return
        }
        gastoDetalleId = participanteUsuario.id
      } else {
        // Si no hay participantes cargados (caso de obtenerGastosCompartidosComoParticipante),
        // buscar el gasto_detalle directamente en la base de datos
        const { data: gastoDetalle, error } = await supabase
          .from('gastos_detalle')
          .select('id')
          .eq('gasto_id', gasto.gasto_id)
          .eq('usuario_id', user.id)
          .eq('numero_cuota', gasto.numero_cuota)
          .single()
        
        if (error || !gastoDetalle) {
          showAlert('Error', 'No se encontró tu participación en este gasto')
          return
        }
        
        gastoDetalleId = gastoDetalle.id
      }

      // Verificar que el usuario no haya pagado completamente
      if (gasto.usuario_completamente_pagado) {
        showAlert('Información', 'Ya has pagado completamente tu parte de este gasto')
        return
      }

      const solicitudData: SolicitudPagoCreate = {
        gasto_detalle_id: gastoDetalleId,
        usuario_creador_id: gasto.usuario_id,
        monto: gasto.monto_usuario - gasto.monto_pagado_usuario,
        notas: `Solicitud de pago para: ${gasto.descripcion}`
      }

      await solicitudesPagoService.crearSolicitudPago(solicitudData, user.id)
      setShowPaymentRequestModal(false)
      setGastoParaSolicitud(null)
      showAlert('Éxito', 'Solicitud de pago enviada correctamente')
      await cargarGastos() // Recargar para actualizar el estado
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo crear la solicitud de pago')
    } finally {
      setEnviandoSolicitud(false)
    }
  }



  const obtenerNombreMes = (mes: number) => {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return meses[mes - 1]
  }

  const gastosUnificadosArray = Array.isArray(gastosUnificados) ? gastosUnificados : []
  
  // Filtrar gastos según el filtro seleccionado
  let gastosFiltrados = gastosUnificadosArray
  
  if (filtroTipo === 'personal') {
    gastosFiltrados = gastosUnificadosArray.filter(gasto => gasto.tipo === 'personal')
  } else if (filtroTipo === 'compartido') {
    gastosFiltrados = gastosUnificadosArray.filter(gasto => gasto.tipo === 'compartido')
  } else if (filtroTipo === 'todos') {
    gastosFiltrados = gastosUnificadosArray
  }
  
  // Aplicar filtro de búsqueda
  gastosFiltrados = gastosFiltrados.filter(gasto => {
    const coincideBusqueda = gasto.descripcion?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    return coincideBusqueda
  })

  const getTipoColor = (tipo: TipoGasto) => {
    return tipo === 'personal' ? '#4CAF50' : '#FF9800'
  }

  
  const getTipoIcon = (tipo: string) => {
    return tipo === 'personal' ? 'account' : 'account-group'
  }

  const formatearMonto = (monto: number) => {
    const formatted = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto).replace(/\s/g, '')
    
    // Separar la parte entera de los decimales
    const parts = formatted.split(',')
    if (parts.length === 2) {
      return { entero: parts[0], decimales: parts[1] }
    }
    return { entero: formatted, decimales: null }
  }

  const formatearFecha = (fecha: string) => {
    // Crear fecha local para evitar problemas de zona horaria
    const [año, mes, dia] = fecha.split('-').map(Number)
    const fechaLocal = new Date(año, mes - 1, dia)
    return fechaLocal.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit'
    })
  }



  const renderGasto = ({ item: gasto }: { item: GastoCuotaUnificada }) => {
    const esGastoPropio = gasto.usuario_id === currentUserId
    const esGastoCompartido = !esGastoPropio && gasto.tipo === 'compartido'
    const esGastoParticipo = false // Ya no se usa el filtro 'participo'
    const esCuotas = (gasto.cuotas || 1) > 1
    
    // Calcular porcentaje de pago - usar datos específicos del usuario para gastos compartidos
    const porcentajePago = esGastoCompartido 
      ? Math.round(gasto.porcentaje_pagado_usuario *100|| 0)
      : Math.round(gasto.porcentaje_pagado)
    const cuotaCompletamentePagada = esGastoCompartido 
      ? gasto.usuario_completamente_pagado
      : gasto.esta_completamente_pagada
    
    // Determinar si se puede navegar al detalle (solo si es gasto propio o compartido creado por el usuario)
    const puedeVerDetalle = esGastoPropio || (gasto.tipo === 'compartido' && gasto.usuario_id === currentUserId)
    
    const ComponenteContenedor = puedeVerDetalle ? TouchableOpacity : View
    const propsContenedor = puedeVerDetalle 
      ? { onPress: () => router.push(`/gasto/${gasto.gasto_id}-cuota-${gasto.numero_cuota}`) }
      : {}
    
    return (
      <ComponenteContenedor 
        style={[
          styles.gastoRowCard, 
          esGastoCompartido && styles.gastoCompartidoRowCard,
          esGastoParticipo && styles.gastoParticipoRowCard
        ]}
        {...propsContenedor}
      >
        <View style={styles.gastoRowContent}>
          {/* Columna izquierda: Descripción y tipo */}
          <View style={styles.gastoRowLeft}>
            <View style={styles.gastoRowTituloContainer}>
              <Chip
                icon={getTipoIcon(gasto.tipo)}
                style={[styles.gastoRowChipIconOnly, { backgroundColor: getTipoColor(gasto.tipo) }]}
                compact
              >
                {''}
              </Chip>
              <View style={styles.gastoRowTituloTexto}>
                <Text style={styles.gastoRowTitulo} numberOfLines={1}>
                  {gasto.descripcion || 'Sin descripción'}
                </Text>
                {esCuotas && (
                  <Text style={styles.gastoRowCuotaTexto}>
                    cuota {gasto.numero_cuota} de {gasto.cuotas}
                  </Text>
                )}
              </View>
            </View>

          </View>

          {/* Columna central: Información de cuotas y participantes */}
          <View style={styles.gastoRowCenter}>
            {gasto.tipo !== 'personal' && (
              <Text style={styles.gastoRowParticipantes}>
                {gasto.cantidad_participantes} participante{gasto.cantidad_participantes !== 1 ? 's' : ''}
              </Text>
            )}
            <Text style={[styles.gastoRowProgreso, { color: cuotaCompletamentePagada ? '#4CAF50' : '#FF9800' }]}>
              {porcentajePago}% pagado
            </Text>
            <View style={styles.gastoRowProgresoBar}>
              <View
                style={[
                  styles.gastoRowProgresoFill,
                  { 
                    width: `${porcentajePago}%`, 
                    backgroundColor: cuotaCompletamentePagada ? '#4CAF50' : '#2196F3' 
                  }
                ]}
              />
            </View>
          </View>

          {/* Columna derecha: Monto y fecha */}
          <View style={styles.gastoRowRight}>
            <View style={styles.gastoRowMontoContainer}>
              {(() => {
                // Mostrar monto específico del usuario para gastos compartidos
                const montoAMostrar = esGastoCompartido 
                  ? gasto.monto_usuario || 0
                  : gasto.monto_total_cuota || 0
                const monto = formatearMonto(montoAMostrar)
                return (
                  <>
                    <Text style={styles.gastoRowMonto}>{monto.entero}</Text>
                    {monto.decimales && (
                      <Text style={styles.gastoRowDecimales}>{monto.decimales}</Text>
                    )}
                  </>
                )
              })()}
            </View>
            <View style={styles.gastoRowFechaContainer}>
              <Text style={styles.gastoRowFecha}>
                {formatearFecha(gasto.fecha)}
              </Text>
              {gasto.es_recurrente && (
                <RecurringIcon size={12} color="#666" />
              )}
            </View>
          </View>

          {/* Botones de acción */}
          {esGastoPropio ? (
            <IconButton
              icon="delete"
              size={16}
              iconColor="#dc2626"
              onPress={(e) => {
                e.stopPropagation()
                confirmarEliminar(gasto)
              }}
              style={styles.gastoRowDeleteButton}
            />
          ) : esGastoCompartido && !gasto.usuario_completamente_pagado ? (
            <IconButton
              icon="cash-plus"
              size={16}
              iconColor="#4CAF50"
              onPress={(e) => {
                e.stopPropagation()
                confirmarSolicitudPago(gasto)
              }}
              style={styles.gastoRowDeleteButton}
            />
          ) : null}
        </View>
      </ComponenteContenedor>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Searchbar
            placeholder="Buscar gastos..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />
          <IconButton
            icon="email-outline"
            size={24}
            onPress={() => router.push('/solicitudes-pago')}
            style={styles.solicitudesButton}
          />
        </View>
        
        {/* Selector de mes */}
        <View style={styles.selectorMes}>
          <IconButton
            icon="chevron-left"
            size={24}
            onPress={navegarMesAnterior}
            style={styles.navegacionButton}
          />
          <View style={styles.mesContainer}>
            <Text style={styles.mesTexto}>
              {obtenerNombreMes(mesActual)} {añoActual}
            </Text>
          </View>
          <IconButton
            icon="chevron-right"
            size={24}
            onPress={navegarMesSiguiente}
            style={styles.navegacionButton}
          />
        </View>
        
        <View style={styles.filtros}>
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtroTipo === 'todos' && styles.filtroButtonActive
            ]}
            onPress={() => setFiltroTipo('todos')}
          >
            <Text style={[
              styles.filtroButtonText,
              filtroTipo === 'todos' && styles.filtroButtonTextActive
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtroTipo === 'personal' && styles.filtroButtonActive
            ]}
            onPress={() => setFiltroTipo('personal')}
          >
            <Text style={[
              styles.filtroButtonText,
              filtroTipo === 'personal' && styles.filtroButtonTextActive
            ]}>
              Personal
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtroTipo === 'compartido' && styles.filtroButtonActive
            ]}
            onPress={() => setFiltroTipo('compartido')}
          >
            <Text style={[
              styles.filtroButtonText,
              filtroTipo === 'compartido' && styles.filtroButtonTextActive
            ]}>
              Compartido
            </Text>
          </TouchableOpacity>
          

        </View>
      </View>

      <FlatList
        data={gastosFiltrados}
        renderItem={renderGasto}
        keyExtractor={(item) => {
          // Crear key única combinando gasto_id, numero_cuota y id del gasto_detalle
          // para evitar duplicados cuando se combinan gastos propios y compartidos
          return `${item.gasto_id}-${item.numero_cuota}-${item.id}`
        }}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay gastos registrados</Text>
            <Text style={styles.emptySubtext}>
              Toca el botón + para crear tu primer gasto
            </Text>
          </View>
        }
      />

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => router.push('/nuevo-gasto')}
      />

      {/* Modal de confirmación para eliminar */}
      <Portal>
        <Modal
          visible={showDeleteModal}
          onDismiss={cancelarEliminar}
          contentContainerStyle={styles.modalContainer}
        >
          <Card>
            <Card.Content>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={48} color="#FF5722" />
                <Title style={styles.modalTitle}>Eliminar Gasto</Title>
              </View>
              
              <Paragraph style={styles.modalText}>
                ¿Estás seguro de que deseas eliminar el gasto "{gastoAEliminar?.descripcion}"?
              </Paragraph>
              
              <Paragraph style={styles.modalWarning}>
                Esta acción no se puede deshacer.
              </Paragraph>
            </Card.Content>
            
            <Card.Actions style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={cancelarEliminar}
                disabled={eliminando}
                style={styles.cancelButton}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={eliminarGasto}
                loading={eliminando}
                disabled={eliminando}
                buttonColor="#FF5722"
                style={styles.deleteButton}
              >
                Eliminar
              </Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>

      {/* Modal de confirmación para solicitud de pago */}
      <Portal>
        <Modal
          visible={showPaymentRequestModal}
          onDismiss={cancelarSolicitudPago}
          contentContainerStyle={styles.modalContainer}
        >
          <Card>
            <Card.Content>
              <View style={styles.modalHeader}>
                <Ionicons name="cash" size={48} color="#4CAF50" />
                <Title style={styles.modalTitle}>Solicitar Pago</Title>
              </View>
              
              <Paragraph style={styles.modalText}>
                ¿Deseas enviar una solicitud de pago para "{gastoParaSolicitud?.descripcion}"?
              </Paragraph>
              
              <Paragraph style={styles.modalText}>
                Monto a solicitar: ${gastoParaSolicitud ? (gastoParaSolicitud.monto_usuario - gastoParaSolicitud.monto_pagado_usuario).toFixed(2) : '0.00'}
              </Paragraph>
              
              <Paragraph style={styles.modalWarning}>
                Se enviará una notificación al creador del gasto.
              </Paragraph>
            </Card.Content>
            
            <Card.Actions style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={cancelarSolicitudPago}
                disabled={enviandoSolicitud}
                style={styles.cancelButton}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={() => gastoParaSolicitud && crearSolicitudPago(gastoParaSolicitud)}
                loading={enviandoSolicitud}
                disabled={enviandoSolicitud}
                buttonColor="#4CAF50"
                style={styles.deleteButton}
              >
                Enviar Solicitud
              </Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  searchbar: {
    flex: 1,
  },
  solicitudesButton: {
    margin: 0,
  },
  selectorMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 4,
  },
  navegacionButton: {
    margin: 0,
  },
  mesContainer: {
    flex: 1,
    alignItems: 'center',
  },
  mesTexto: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  filtros: {
    flexDirection: 'row',
    gap: 8,
  },
  filtroButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filtroButtonActive: {
    backgroundColor: '#2196F3',
  },
  filtroButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  filtroButtonTextActive: {
    color: 'white',
  },
  lista: {
    padding: 16,
  },
  // Estilos para la vista simplificada de gastos
  gastoRowCard: {
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  gastoCompartidoRowCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    backgroundColor: '#FFF8E1',
  },

  gastoRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    minHeight: 60,
  },
  gastoRowLeft: {
    flex: 2,
    marginRight: 8,
  },
  gastoRowTituloContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  gastoRowTituloTexto: {
    flex: 1,
  },
  gastoRowTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  gastoRowCuotaTexto: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
    marginTop: 2,
  },
  gastoRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gastoRowChip: {
    height: 24,
  },
  gastoRowChipIconOnly: {
    height: 35,
    width: 35,
    borderRadius: 10,
    minWidth: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gastoRowChipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gastoRowCompartidoChip: {
    backgroundColor: '#E3F2FD',
    height: 24,
  },
  gastoRowCompartidoChipText: {
    color: '#1976D2',
    fontSize: 10,
    fontWeight: 'bold',
  },

  gastoRowCenter: {
    flex: 1.5,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  gastoRowCuotaInfo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  gastoRowParticipantes: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    marginBottom: 1,
  },
  gastoRowProgreso: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  gastoRowProgresoBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  gastoRowProgresoFill: {
    height: '100%',
    borderRadius: 2,
  },
  gastoRowRight: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  gastoRowMontoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gastoRowMonto: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  gastoRowDecimales: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2196F3',
    textDecorationLine: 'underline',
    marginTop: -2,
    marginLeft: 1,
  },
  gastoRowFechaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gastoRowFecha: {
    fontSize: 11,
    color: '#666',
  },
  gastoRowDeleteButton: {
    margin: 0,
    marginLeft: 4,
  },
  // Estilos legacy mantenidos para compatibilidad
  gastoCard: {
    marginBottom: 12,
    elevation: 2,
  },
  gastoCompartidoCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    backgroundColor: '#FFF8E1',
  },
  gastoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  gastoInfo: {
    flex: 1,
  },
  tituloContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gastoTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  compartidoChip: {
    backgroundColor: '#E3F2FD',
    marginLeft: 8,
  },
  compartidoChipText: {
    color: '#1976D2',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gastoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipoChip: {
    height: 28,
  },
  tipoChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fechaText: {
    color: '#666',
    fontSize: 12,
  },
  montoContainer: {
    marginBottom: 8,
  },
  montoTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  montoPagado: {
    fontSize: 14,
    color: '#4CAF50',
  },
  descuentoText: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  creadorText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  espaciadoParticipantes: {
    height: 16,
    marginTop: 4,
  },
  cuotasText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  progresoContainer: {
    marginBottom: 8,
  },
  progresoBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 4,
  },
  progresoFill: {
    height: '100%',
    borderRadius: 3,
  },
  progresoText: {
    fontSize: 12,
    color: '#666',
  },
  participantesText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  modalWarning: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  modalActions: {
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
  },
})