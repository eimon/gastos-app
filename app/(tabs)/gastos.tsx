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
import { supabase, gastosService, Gasto, TipoGasto } from '../../lib/supabase'
import { router } from 'expo-router'
import { showAlert, showConfirm } from '../../lib/alerts'
import { useFocusEffect } from '@react-navigation/native'

export default function GastosScreen() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [gastosRecibidos, setGastosRecibidos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoGasto | 'todos' | 'recibidos'>('todos')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    cargarGastos()
  }, [])

  // Recargar datos cada vez que se enfoque la pestaña
  useFocusEffect(
    React.useCallback(() => {
      cargarGastos()
    }, [])
  )

  const obtenerGastosRecibidos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // Usar la función RPC para obtener gastos compartidos
      const { data: gastosData, error } = await supabase
        .rpc('obtener_gastos_compartidos', {
          usuario_actual_id: user.id
        })

      if (error) {
        console.error('Error al obtener gastos recibidos:', error)
        return []
      }

      // Transformar los datos para que coincidan con la estructura esperada
      const gastosTransformados = (gastosData || []).map((gasto: any) => ({
        id: `${gasto.gasto_id}-${gasto.mi_numero_cuota}`, // Clave única combinando gasto_id y numero_cuota
        gasto_id: gasto.gasto_id, // ID original del gasto
        descripcion: gasto.descripcion,
        monto: gasto.monto_total,
        fecha: gasto.mi_vencimiento, // Usar fecha de vencimiento
        cuotas: gasto.cuotas,
        descuento: gasto.descuento,
        tipo_descuento: gasto.tipo_descuento,
        created_at: gasto.created_at,
        usuario_id: gasto.creador_id,
        numero_cuota: gasto.mi_numero_cuota,
        tipo: 'compartido' as TipoGasto,
        usuarios: {
          id: gasto.creador_id,
          nickname: gasto.creador_nickname,
          email: gasto.creador_email
        },
        detalles: [{
          id: gasto.gasto_id,
          usuario_id: user.id,
          monto: gasto.mi_monto,
          pagado: gasto.mi_pagado,
          vencimiento: gasto.mi_vencimiento
        }]
      }))

      return gastosTransformados
    } catch (error) {
      console.error('Error:', error)
      return []
    }
  }

  const cargarGastos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)
      const gastosData = await gastosService.obtenerGastos(user.id)
      const gastosRecibidosData = await obtenerGastosRecibidos()
      
      setGastos(gastosData)
      setGastosRecibidos(gastosRecibidosData)
    } catch (error) {
      console.error('Error cargando gastos:', error)
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
      if (!user) return

      await gastosService.eliminarGasto(gastoAEliminar.id, user.id)
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

  const confirmarEliminar = (gasto: Gasto) => {
    setGastoAEliminar(gasto)
    setShowDeleteModal(true)
  }

  const cancelarEliminar = () => {
    setShowDeleteModal(false)
    setGastoAEliminar(null)
  }

  const gastosArray = Array.isArray(gastos) ? gastos : []
  const gastosRecibidosArray = Array.isArray(gastosRecibidos) ? gastosRecibidos : []
  
  // Combinar gastos según el filtro seleccionado
  let gastosCombinados = []
  if (filtroTipo === 'recibidos') {
    gastosCombinados = gastosRecibidosArray
  } else if (filtroTipo === 'todos') {
    gastosCombinados = [...gastosArray, ...gastosRecibidosArray]
  } else {
    gastosCombinados = gastosArray.filter(gasto => gasto.tipo === filtroTipo)
  }
  
  const gastosFiltrados = gastosCombinados.filter(gasto => {
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
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const calcularProgresoPago = (gasto: Gasto) => {
    const detallesArray = Array.isArray(gasto.detalles) ? gasto.detalles : []
    if (detallesArray.length === 0) return 0
    
    const totalMonto = gasto.monto - gasto.descuento || 0
    const montoPagado = detallesArray.filter(d => d.pagado).reduce((sum, d) => sum + d.monto, 0)
    
    return totalMonto > 0 ? (montoPagado / totalMonto) * 100 : 0
  }

  const renderGasto = ({ item: gasto }: { item: Gasto }) => {
    const progreso = calcularProgresoPago(gasto)
    const detallesArray = Array.isArray(gasto.detalles) ? gasto.detalles : []
    const totalPagado = detallesArray.filter(d => d.pagado).reduce((sum, d) => sum + d.monto, 0)
    const esGastoPropio = gasto.usuario_id === currentUserId
    const esGastoRecibido = filtroTipo === 'recibidos' || (!esGastoPropio && gasto.tipo === 'compartido')
    const esGastoCompartido = !esGastoPropio && gasto.tipo === 'compartido'

    return (
      <Card style={[styles.gastoCard, (esGastoCompartido || esGastoRecibido) && styles.gastoCompartidoCard]}>
        <Card.Content>
          <View style={styles.gastoHeader}>
            <View style={styles.gastoInfo}>
              <View style={styles.tituloContainer}>
                <Title style={styles.gastoTitulo}>{gasto.descripcion || 'Sin descripción'}</Title>
                {(esGastoCompartido || esGastoRecibido) && (
                  <Chip
                    icon="account-group"
                    style={styles.compartidoChip}
                    textStyle={styles.compartidoChipText}
                    compact
                  >
                    {esGastoRecibido ? 'Recibido' : 'Solo lectura'}
                  </Chip>
                )}
              </View>
              <View style={styles.gastoMeta}>
                <Chip
                  icon={getTipoIcon(gasto.tipo)}
                  style={[styles.tipoChip, { backgroundColor: getTipoColor(gasto.tipo) }]}
                  textStyle={styles.tipoChipText}
                >
                  {gasto.tipo === 'personal' ? 'Personal' : 'Compartido'}
                </Chip>
                <Text style={styles.fechaText}>
                  {esGastoRecibido ? 
                    `Vence: ${new Date(gasto.fecha).toLocaleDateString('es-AR')}` :
                    new Date(gasto.created_at).toLocaleDateString('es-AR')
                  }
                </Text>
              </View>
              {esGastoRecibido && gasto.usuarios && (
                <Text style={styles.creadorText}>
                  Creado por: {gasto.usuarios.nickname}
                </Text>
              )}
            </View>
            {esGastoPropio && (
              <IconButton
                icon="delete"
                size={20}
                iconColor="#dc2626"
                onPress={() => confirmarEliminar(gasto)}
              />
            )}
          </View>

          <View style={styles.montoContainer}>
            {esGastoRecibido ? (
              <>
                <Text style={styles.montoLabel}>Mi Parte</Text>
                <Text style={styles.montoTotal}>
                  {formatearMonto(gasto.detalles?.[0]?.monto || 0)}
                </Text>
                {gasto.numero_cuota && gasto.cuotas && gasto.cuotas > 1 && (
                  <Text style={styles.cuotasInfo}>
                    Cuota {gasto.numero_cuota}/{gasto.cuotas}
                  </Text>
                )}
                <Text style={styles.montoPagado}>
                  Estado: {gasto.detalles?.[0]?.pagado ? 'Pagado' : 'Pendiente'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.montoTotal}>{formatearMonto(gasto.monto || 0)}</Text>
                <Text style={styles.montoPagado}>
                  Pagado: {formatearMonto(totalPagado)}
                </Text>
                {(gasto.descuento || 0) > 0 && (
                  <Text style={styles.descuentoText}>
                    Descuento aplicado: {formatearMonto(gasto.descuento || 0)}
                  </Text>
                )}
              </>
            )}
          </View>

          {(gasto.cuotas || 1) > 1 && (
            <Text style={styles.cuotasText}>
              {gasto.cuotas || 1} cuotas
            </Text>
          )}

          <View style={styles.progresoContainer}>
            <View style={styles.progresoBar}>
              <View
                style={[
                  styles.progresoFill,
                  { width: `${progreso}%`, backgroundColor: progreso === 100 ? '#4CAF50' : '#2196F3' }
                ]}
              />
            </View>
            <Text style={styles.progresoText}>
              {Math.round(progreso)}% completado
            </Text>
          </View>

          {!esGastoRecibido && detallesArray.length > 0 && (() => {
            const participantesUnicos = new Set(
      detallesArray.map(d => d.usuario_id || d.nombre_participante)
    ).size;
            return (
              <Text style={styles.participantesText}>
                {participantesUnicos} participante{participantesUnicos > 1 ? 's' : ''}
              </Text>
            );
          })()}
          {esGastoRecibido && (
            <View style={styles.espaciadoParticipantes} />
          )}
        </Card.Content>

        {!esGastoRecibido && (
          <Card.Actions>
            <Button
              mode="outlined"
              onPress={() => router.push(`/gasto/${gasto.id}`)}
              icon="eye"
            >
              Ver Detalles
            </Button>
            {esGastoPropio && (
              <Button
                mode="contained"
                onPress={() => router.push(`/gasto/${gasto.id}/pagar`)}
                icon="credit-card"
                disabled={progreso === 100}
              >
                {progreso === 100 ? 'Pagado' : 'Pagar'}
              </Button>
            )}
            {esGastoCompartido && (
              <Button
                mode="contained-tonal"
                icon="account-group"
                disabled
              >
                Gasto compartido
              </Button>
            )}
          </Card.Actions>
        )}
      </Card>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Buscar gastos..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
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
          
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtroTipo === 'recibidos' && styles.filtroButtonActive
            ]}
            onPress={() => setFiltroTipo('recibidos')}
          >
            <Text style={[
              styles.filtroButtonText,
              filtroTipo === 'recibidos' && styles.filtroButtonTextActive
            ]}>
              Recibidos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={gastosFiltrados}
        renderItem={renderGasto}
        keyExtractor={(item) => item.id}
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
  searchbar: {
    marginBottom: 12,
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