// app/(tabs)/resumen.tsx - Pantalla de resumen y estadísticas
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native'
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase, gastosService, pagosService, Gasto, Pago } from '../../lib/supabase'
import { showAlert } from '../../lib/alerts'

const { width } = Dimensions.get('window')

interface EstadisticasResumen {
  totalGastos: number
  totalPagado: number
  totalPendiente: number
  gastosPersonales: number
  gastosCompartidos: number
  pagosPorMedio: {
    efectivo: number
    transferencia: number
  }
  gastosPorMes: { [key: string]: number }
}

export default function ResumenScreen() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [estadisticas, setEstadisticas] = useState<EstadisticasResumen>({
    totalGastos: 0,
    totalPagado: 0,
    totalPendiente: 0,
    gastosPersonales: 0,
    gastosCompartidos: 0,
    pagosPorMedio: {
      efectivo: 0,
      transferencia: 0
    },
    gastosPorMes: {}
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [gastosData, pagosData] = await Promise.all([
        gastosService.obtenerGastos(user.id),
        pagosService.obtenerPagos(user.id)
      ])

      setGastos(gastosData)
      setPagos(pagosData)
      calcularEstadisticas(gastosData, pagosData)
    } catch (error) {
      console.error('Error cargando datos:', error)
      showAlert('Error', 'No se pudieron cargar los datos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos()
  }

  // Función para calcular el saldo actual de un detalle basado en los pagos
  const calcularSaldoDetalle = (detalle: GastoDetalle) => {
    if (!detalle.pagos || !Array.isArray(detalle.pagos)) return 0
    return detalle.pagos.reduce((sum, pago) => sum + (pago.monto || 0), 0)
  }

  const calcularEstadisticas = (gastosData: Gasto[], pagosData: Pago[]) => {
    // Asegurar que los datos sean arrays
    const gastosArray = Array.isArray(gastosData) ? gastosData : []
    const pagosArray = Array.isArray(pagosData) ? pagosData : []
    
    const totalGastos = gastosArray.reduce((sum, gasto) => sum + (gasto.monto || 0), 0)
    
    // Calcular total pagado basado en la columna 'pagado'
    const totalPagado = gastosArray.reduce((sum, gasto) => {
      const detallesArray = Array.isArray(gasto.detalles) ? gasto.detalles : []
      return sum + detallesArray.filter(d => d.pagado).reduce((detSum, d) => detSum + d.monto, 0)
    }, 0)
    
    // Calcular total pendiente basado en gastos_detalle no pagados
    const totalPendiente = gastosArray.reduce((sum, gasto) => {
      const detallesArray = Array.isArray(gasto.detalles) ? gasto.detalles : []
      return sum + detallesArray.filter(d => !d.pagado).reduce((detSum, d) => detSum + d.monto, 0)
    }, 0)

    const gastosPersonales = gastosArray.filter(g => g.tipo === 'personal').length
    const gastosCompartidos = gastosArray.filter(g => g.tipo === 'compartido').length

    const pagosPorMedio = {
      efectivo: pagosArray
          .filter(p => p.medio_pago === 'Efectivo')
          .reduce((sum, p) => sum + p.monto, 0),
        transferencia: pagosArray
          .filter(p => p.medio_pago === 'Transferencia')
          .reduce((sum, p) => sum + p.monto, 0)
    }

    // Gastos por mes (últimos 6 meses)
    const gastosPorMes: { [key: string]: number } = {}
    const ahora = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      const mesKey = fecha.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
      gastosPorMes[mesKey] = 0
    }

    gastosArray.forEach(gasto => {
      const fechaGasto = new Date(gasto.created_at)
      const mesKey = fechaGasto.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
      if (gastosPorMes.hasOwnProperty(mesKey)) {
        gastosPorMes[mesKey] += (gasto.monto || 0)
      }
    })

    setEstadisticas({
      totalGastos,
      totalPagado,
      totalPendiente,
      gastosPersonales,
      gastosCompartidos,
      pagosPorMedio,
      gastosPorMes
    })
  }

  const formatearMonto = (monto: number) => {
    // Verificar si el monto es válido
    if (isNaN(monto) || monto === null || monto === undefined) {
      return '$0,00'
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const calcularPorcentajePagado = () => {
    if (estadisticas.totalGastos === 0) return 0
    return (estadisticas.totalPagado / estadisticas.totalGastos) * 100
  }

  const obtenerGastosRecientes = () => {
    const gastosArray = Array.isArray(gastos) ? gastos : []
    return gastosArray
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }

  const obtenerPagosRecientes = () => {
    const pagosArray = Array.isArray(pagos) ? pagos : []
    return pagosArray
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }

  const porcentajePagado = calcularPorcentajePagado()
  const gastosRecientes = obtenerGastosRecientes()
  const pagosRecientes = obtenerPagosRecientes()

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Resumen Principal */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Resumen General</Title>
          <View style={styles.resumenGrid}>
            <View style={styles.resumenItem}>
              <Text style={styles.resumenNumero}>{formatearMonto(estadisticas.totalGastos)}</Text>
              <Text style={styles.resumenLabel}>Total Gastos</Text>
            </View>
            <View style={styles.resumenItem}>
              <Text style={[styles.resumenNumero, { color: '#4CAF50' }]}>
                {formatearMonto(estadisticas.totalPagado)}
              </Text>
              <Text style={styles.resumenLabel}>Total Pagado</Text>
            </View>
            <View style={styles.resumenItem}>
              <Text style={[styles.resumenNumero, { color: '#FF9800' }]}>
                {formatearMonto(estadisticas.totalPendiente)}
              </Text>
              <Text style={styles.resumenLabel}>Pendiente</Text>
            </View>
            <View style={styles.resumenItem}>
              <Text style={[styles.resumenNumero, { color: '#2196F3' }]}>
                {Math.round(porcentajePagado)}%
              </Text>
              <Text style={styles.resumenLabel}>Completado</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Progreso de Pagos */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Progreso de Pagos</Title>
          <View style={styles.progresoContainer}>
            <View style={styles.progresoBar}>
              <View
                style={[
                  styles.progresoFill,
                  {
                    width: `${porcentajePagado}%`,
                    backgroundColor: porcentajePagado === 100 ? '#4CAF50' : '#2196F3'
                  }
                ]}
              />
            </View>
            <Text style={styles.progresoText}>
              {Math.round(porcentajePagado)}% de los gastos están pagados
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Distribución por Tipo */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Distribución por Tipo</Title>
          <View style={styles.distribucionContainer}>
            <View style={styles.distribucionItem}>
              <View style={styles.distribucionIcono}>
                <Ionicons name="person-outline" size={24} color="#4CAF50" />
              </View>
              <View style={styles.distribucionInfo}>
                <Text style={styles.distribucionNumero}>{estadisticas.gastosPersonales}</Text>
                <Text style={styles.distribucionLabel}>Gastos Personales</Text>
              </View>
            </View>
            <View style={styles.distribucionItem}>
              <View style={styles.distribucionIcono}>
                <Ionicons name="people" size={24} color="#FF9800" />
              </View>
              <View style={styles.distribucionInfo}>
                <Text style={styles.distribucionNumero}>{estadisticas.gastosCompartidos}</Text>
                <Text style={styles.distribucionLabel}>Gastos Compartidos</Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Pagos por Medio */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Pagos por Medio</Title>
          <View style={styles.distribucionContainer}>
            <View style={styles.distribucionItem}>
              <View style={styles.distribucionIcono}>
                <Ionicons name="cash" size={24} color="#4CAF50" />
              </View>
              <View style={styles.distribucionInfo}>
                <Text style={styles.distribucionNumero}>
                  {formatearMonto(estadisticas.pagosPorMedio.efectivo)}
                </Text>
                <Text style={styles.distribucionLabel}>Efectivo</Text>
              </View>
            </View>
            <View style={styles.distribucionItem}>
              <View style={styles.distribucionIcono}>
                <Ionicons name="card" size={24} color="#2196F3" />
              </View>
              <View style={styles.distribucionInfo}>
                <Text style={styles.distribucionNumero}>
                  {formatearMonto(estadisticas.pagosPorMedio.transferencia)}
                </Text>
                <Text style={styles.distribucionLabel}>Transferencia</Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Gastos Recientes */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Gastos Recientes</Title>
          {gastosRecientes.length > 0 ? (
            gastosRecientes.map((gasto, index) => (
              <View key={gasto.id} style={styles.itemReciente}>
                <View style={styles.itemRecenteInfo}>
                  <Text style={styles.itemRecenteTitulo}>
                    {gasto.descripcion || 'Sin descripción'}
                  </Text>
                  <Text style={styles.itemRecenteFecha}>
                    {new Date(gasto.created_at).toLocaleDateString('es-AR')}
                  </Text>
                </View>
                <View style={styles.itemRecenteMonto}>
                  <Text style={styles.itemRecenteMontoText}>
                    {formatearMonto(gasto.monto)}
                  </Text>
                  <Chip
                    style={[
                      styles.itemRecenteChip,
                      { backgroundColor: gasto.tipo === 'personal' ? '#E8F5E8' : '#FFF3E0' }
                    ]}
                    textStyle={[
                      styles.itemRecenteChipText,
                      { color: gasto.tipo === 'personal' ? '#4CAF50' : '#FF9800' }
                    ]}
                  >
                    {gasto.tipo === 'personal' ? 'Personal' : 'Compartido'}
                  </Chip>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No hay gastos recientes</Text>
          )}
        </Card.Content>
      </Card>

      {/* Pagos Recientes */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Pagos Recientes</Title>
          {pagosRecientes.length > 0 ? (
            pagosRecientes.map((pago, index) => (
              <View key={pago.id} style={styles.itemReciente}>
                <View style={styles.itemRecenteInfo}>
                  <Text style={styles.itemRecenteTitulo}>
                    {pago.gasto_detalle?.gasto?.descripcion || 'Sin descripción'}
                  </Text>
                  <Text style={styles.itemRecenteFecha}>
                    {new Date(pago.created_at).toLocaleDateString('es-AR')}
                  </Text>
                </View>
                <View style={styles.itemRecenteMonto}>
                  <Text style={styles.itemRecenteMontoText}>
                    {formatearMonto(pago.monto)}
                  </Text>
                  <Chip
                    style={[
                      styles.itemRecenteChip,
                      { backgroundColor: pago.medio_pago === 'Efectivo' ? '#E8F5E8' : '#E3F2FD' }
                    ]}
                    textStyle={[
                      styles.itemRecenteChipText,
                      { color: pago.medio_pago === 'Efectivo' ? '#4CAF50' : '#2196F3' }
                    ]}
                  >
                    {pago.medio_pago === 'Efectivo' ? 'Efectivo' : pago.medio_pago === 'Transferencia' ? 'Transferencia' : pago.medio_pago}
                  </Chip>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No hay pagos recientes</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  resumenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  resumenItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  resumenNumero: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  resumenLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  progresoContainer: {
    marginBottom: 8,
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
  distribucionContainer: {
    gap: 16,
  },
  distribucionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  distribucionIcono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  distribucionInfo: {
    flex: 1,
  },
  distribucionNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  distribucionLabel: {
    fontSize: 14,
    color: '#666',
  },
  itemReciente: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemRecenteInfo: {
    flex: 1,
  },
  itemRecenteTitulo: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  itemRecenteFecha: {
    fontSize: 12,
    color: '#666',
  },
  itemRecenteMonto: {
    alignItems: 'flex-end',
  },
  itemRecenteMontoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemRecenteChip: {
    height: 24,
  },
  itemRecenteChipText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
})