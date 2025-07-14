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
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase, gastosService, Gasto, TipoGasto } from '../../lib/supabase'
import { router } from 'expo-router'
import { showAlert, showConfirm } from '../../lib/alerts'

export default function GastosScreen() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoGasto | 'todos'>('todos')

  useEffect(() => {
    cargarGastos()
  }, [])

  const cargarGastos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const gastosData = await gastosService.obtenerGastos(user.id)
      setGastos(gastosData)
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

  const eliminarGasto = async (gastoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await gastosService.eliminarGasto(gastoId, user.id)
      await cargarGastos()
      showAlert('Éxito', 'Gasto eliminado correctamente')
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo eliminar el gasto')
    }
  }

  const confirmarEliminar = (gasto: Gasto) => {
    showConfirm(
      'Eliminar Gasto',
      `¿Estás seguro de que deseas eliminar "${gasto.descripcion}"?`,
      () => eliminarGasto(gasto.id)
    )
  }

  const gastosFiltrados = gastos.filter(gasto => {
    const coincideBusqueda = gasto.descripcion?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const coincideTipo = filtroTipo === 'todos' || gasto.tipo === filtroTipo
    return coincideBusqueda && coincideTipo
  })

  const getTipoColor = (tipo: TipoGasto) => {
    return tipo === 'personal' ? '#4CAF50' : '#FF9800'
  }

  const getTipoIcon = (tipo: TipoGasto) => {
    return tipo === 'personal' ? 'person' : 'people'
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const calcularProgresoPago = (gasto: Gasto) => {
    if (!gasto.detalles || gasto.detalles.length === 0) return 0
    const pagados = gasto.detalles.filter(d => d.pagado).length
    return (pagados / gasto.detalles.length) * 100
  }

  const renderGasto = ({ item: gasto }: { item: Gasto }) => {
    const progreso = calcularProgresoPago(gasto)
    const totalPagado = gasto.detalles?.filter(d => d.pagado).reduce((sum, d) => sum + d.monto, 0) || 0

    return (
      <Card style={styles.gastoCard}>
        <Card.Content>
          <View style={styles.gastoHeader}>
            <View style={styles.gastoInfo}>
              <Title style={styles.gastoTitulo}>{gasto.descripcion || 'Sin descripción'}</Title>
              <View style={styles.gastoMeta}>
                <Chip
                  icon={getTipoIcon(gasto.tipo)}
                  style={[styles.tipoChip, { backgroundColor: getTipoColor(gasto.tipo) }]}
                  textStyle={styles.tipoChipText}
                >
                  {gasto.tipo === 'personal' ? 'Personal' : 'Compartido'}
                </Chip>
                <Text style={styles.fechaText}>
                  {new Date(gasto.created_at).toLocaleDateString('es-AR')}
                </Text>
              </View>
            </View>
            <IconButton
              icon="delete"
              size={20}
              iconColor="#dc2626"
              onPress={() => confirmarEliminar(gasto)}
            />
          </View>

          <View style={styles.montoContainer}>
            <Text style={styles.montoTotal}>{formatearMonto(gasto.monto_total)}</Text>
            <Text style={styles.montoPagado}>
              Pagado: {formatearMonto(totalPagado)}
            </Text>
          </View>

          {gasto.cuotas > 1 && (
            <Text style={styles.cuotasText}>
              {gasto.cuotas} cuotas
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

          {gasto.detalles && gasto.detalles.length > 0 && (
            <Text style={styles.participantesText}>
              {gasto.detalles.length} participante{gasto.detalles.length > 1 ? 's' : ''}
            </Text>
          )}
        </Card.Content>

        <Card.Actions>
          <Button
            mode="outlined"
            onPress={() => router.push(`/gasto/${gasto.id}`)}
            icon="eye"
          >
            Ver Detalles
          </Button>
          <Button
            mode="contained"
            onPress={() => router.push(`/gasto/${gasto.id}/pagar`)}
            icon="credit-card"
            disabled={progreso === 100}
          >
            {progreso === 100 ? 'Pagado' : 'Pagar'}
          </Button>
        </Card.Actions>
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
            <Ionicons name="wallet-outline" size={64} color="#ccc" />
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
        onPress={() => router.push('/crear-gasto')}
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
  gastoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  gastoInfo: {
    flex: 1,
  },
  gastoTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
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
})