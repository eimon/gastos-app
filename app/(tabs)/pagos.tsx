// app/(tabs)/pagos.tsx - Pantalla de pagos
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  IconButton,
  Searchbar,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase, pagosService, Pago, MedioPago } from '../../lib/supabase'
import { router } from 'expo-router'
import { showAlert, showConfirm } from '../../lib/alerts'

export default function PagosScreen() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroMedio, setFiltroMedio] = useState<MedioPago | 'todos'>('todos')

  useEffect(() => {
    cargarPagos()
  }, [])

  const cargarPagos = async () => {
    try {
      console.log('=== INICIO cargarPagos ===')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No hay usuario autenticado')
        return
      }

      console.log('Usuario ID:', user.id)
      console.log('Llamando a obtenerPagos...')
      console.log('Tipo de pagosService:', typeof pagosService)
      console.log('Tipo de obtenerPagos:', typeof pagosService.obtenerPagos)
      const pagosData = await pagosService.obtenerPagos(user.id)
      console.log('Datos recibidos:', typeof pagosData, Array.isArray(pagosData), pagosData)
      
      const pagosArray = Array.isArray(pagosData) ? pagosData : []
      console.log('Array final:', pagosArray.length, 'elementos')
      setPagos(pagosArray)
      console.log('=== FIN cargarPagos ===')
    } catch (error) {
      console.error('Error cargando pagos:', error)
      console.error('Error stack:', error.stack)
      setPagos([])
      showAlert('Error', 'No se pudieron cargar los pagos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarPagos()
  }

  const eliminarPago = async (pagoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await pagosService.eliminarPago(pagoId, user.id)
      await cargarPagos()
      showAlert('Éxito', 'Pago eliminado correctamente')
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo eliminar el pago')
    }
  }

  const confirmarEliminar = (pago: Pago) => {
    showConfirm(
      'Eliminar Pago',
      '¿Estás seguro de que deseas eliminar este pago?',
      () => eliminarPago(pago.id)
    )
  }

  // Asegurar que pagos es un array válido antes de cualquier operación
  const pagosArray = Array.isArray(pagos) ? pagos : []
  console.log('pagosArray para filtrar:', pagosArray.length, 'elementos')
  
  let pagosFiltrados = []
  try {
    pagosFiltrados = pagosArray.filter(pago => {
      const gastoDescripcion = pago.gasto_detalle?.gasto?.descripcion || ''
      const participanteNombre = pago.gasto_detalle?.usuario?.nickname || ''
      
      const coincideBusqueda = 
        gastoDescripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        participanteNombre.toLowerCase().includes(searchQuery.toLowerCase())
      
      const coincideMedio = filtroMedio === 'todos' || pago.medio_pago === filtroMedio
      
      return coincideBusqueda && coincideMedio
    })
    console.log('pagosFiltrados resultado:', pagosFiltrados.length, 'elementos')
  } catch (error) {
    console.error('Error en filter de pagosFiltrados:', error)
    pagosFiltrados = []
  }

  const getMedioColor = (medio: MedioPago) => {
    return medio === 'Efectivo' ? '#4CAF50' : '#2196F3'
  }

  const getMedioIcon = (medio: MedioPago) => {
    return medio === 'Efectivo' ? 'cash' : 'bank-transfer'
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const calcularTotalPorMedio = (medio: MedioPago) => {
    try {
      const pagosArray = Array.isArray(pagos) ? pagos : []
      console.log('calcularTotalPorMedio para:', medio, 'con', pagosArray.length, 'pagos')
      
      const pagosFiltradosPorMedio = pagosArray.filter(p => p.medio_pago === medio)
      console.log('Pagos filtrados por medio:', pagosFiltradosPorMedio.length)
      
      const total = pagosFiltradosPorMedio.reduce((sum, p) => sum + p.monto, 0)
      console.log('Total calculado:', total)
      
      return total
    } catch (error) {
      console.error('Error en calcularTotalPorMedio:', error)
      return 0
    }
  }

  const renderPago = ({ item: pago }: { item: Pago }) => {
    const gastoDetalle = pago.gasto_detalle
    const gasto = gastoDetalle?.gasto
    const participante = gastoDetalle?.usuario

    return (
      <Card style={styles.pagoCard}>
        <Card.Content>
          <View style={styles.pagoHeader}>
            <View style={styles.pagoInfo}>
              <Title style={styles.pagoTitulo}>
                {gasto?.descripcion || 'Sin descripción'}
              </Title>
              <Paragraph style={styles.participanteText}>
                Pagado por: {participante?.nickname || gastoDetalle?.nombre_participante || 'Desconocido'}
              </Paragraph>
              <View style={styles.pagoMeta}>
                <Chip
                  icon={getMedioIcon(pago.medio_pago)}
                  style={[
                    styles.medioChip,
                    { backgroundColor: getMedioColor(pago.medio_pago) }
                  ]}
                  textStyle={styles.medioChipText}
                >
                  {pago.medio_pago}
                </Chip>
                <Text style={styles.fechaText}>
                  {new Date(pago.created_at).toLocaleDateString('es-AR')}
                </Text>
              </View>
            </View>
            <IconButton
              icon="delete"
              size={20}
              iconColor="#dc2626"
              onPress={() => confirmarEliminar(pago)}
            />
          </View>

          <View style={styles.montoContainer}>
            <Text style={styles.montoText}>
              {formatearMonto(pago.monto)}
            </Text>
          </View>

          {pago.comprobante_url && (
            <View style={styles.comprobanteContainer}>
              <Ionicons name="attach" size={16} color="#666" />
              <Text style={styles.comprobanteText}>Comprobante adjunto</Text>
            </View>
          )}

          {gastoDetalle?.vencimiento && (
            <Text style={styles.vencimientoText}>
              Vencimiento: {new Date(gastoDetalle.vencimiento).toLocaleDateString('es-AR')}
            </Text>
          )}
        </Card.Content>

        <Card.Actions>
          <Button
            mode="outlined"
            onPress={() => router.push(`/gasto/${gasto?.id}`)}
            icon="eye"
          >
            Ver Gasto
          </Button>
          {pago.comprobante_url && (
            <Button
              mode="contained"
              onPress={() => router.push(`/comprobante/${pago.id}`)}
              icon="file-document"
            >
              Ver Comprobante
            </Button>
          )}
        </Card.Actions>
      </Card>
    )
  }

  const totalEfectivo = calcularTotalPorMedio('Efectivo')
  const totalTransferencia = calcularTotalPorMedio('Transferencia')
  const totalGeneral = totalEfectivo + totalTransferencia

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Buscar pagos..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
        <View style={styles.filtros}>
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtroMedio === 'todos' && styles.filtroButtonActive
            ]}
            onPress={() => setFiltroMedio('todos')}
          >
            <Text style={[
              styles.filtroButtonText,
              filtroMedio === 'todos' && styles.filtroButtonTextActive
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtroMedio === 'Efectivo' && styles.filtroButtonActive
            ]}
            onPress={() => setFiltroMedio('Efectivo')}
          >
            <Text style={[
              styles.filtroButtonText,
              filtroMedio === 'Efectivo' && styles.filtroButtonTextActive
            ]}>
              Efectivo
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtroMedio === 'Transferencia' && styles.filtroButtonActive
            ]}
            onPress={() => setFiltroMedio('Transferencia')}
          >
            <Text style={[
              styles.filtroButtonText,
              filtroMedio === 'Transferencia' && styles.filtroButtonTextActive
            ]}>
              Transferencia
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resumen}>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenLabel}>Total General</Text>
            <Text style={styles.resumenMonto}>{formatearMonto(totalGeneral)}</Text>
          </View>
          <View style={styles.resumenDetalle}>
            <View style={styles.resumenDetalleItem}>
              <Ionicons name="cash" size={16} color="#4CAF50" />
              <Text style={styles.resumenDetalleText}>{formatearMonto(totalEfectivo)}</Text>
            </View>
            <View style={styles.resumenDetalleItem}>
              <Ionicons name="card" size={16} color="#2196F3" />
              <Text style={styles.resumenDetalleText}>{formatearMonto(totalTransferencia)}</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={pagosFiltrados}
        renderItem={renderPago}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay pagos registrados</Text>
            <Text style={styles.emptySubtext}>
              Los pagos aparecerán aquí cuando se registren
            </Text>
          </View>
        }
      />
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
    marginBottom: 16,
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
  resumen: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  resumenItem: {
    alignItems: 'center',
    marginBottom: 8,
  },
  resumenLabel: {
    fontSize: 14,
    color: '#666',
  },
  resumenMonto: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  resumenDetalle: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resumenDetalleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resumenDetalleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  lista: {
    padding: 16,
  },
  pagoCard: {
    marginBottom: 12,
    elevation: 2,
  },
  pagoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pagoInfo: {
    flex: 1,
  },
  pagoTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  participanteText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pagoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medioChip: {
    height: 28,
  },
  medioChipText: {
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
  montoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  comprobanteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  comprobanteText: {
    fontSize: 12,
    color: '#666',
  },
  vencimientoText: {
    fontSize: 12,
    color: '#FF9800',
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
})