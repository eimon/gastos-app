// app/(tabs)/resumen.tsx - Vista unificada de resumen mensual y pagos
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  IconButton,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase, gastosService, pagosService, Gasto, Pago, TipoGasto } from '../../lib/supabase'
import { showAlert } from '../../lib/alerts'
import { useFocusEffect } from '@react-navigation/native'
import { PieChart } from 'react-native-chart-kit'

const { width } = Dimensions.get('window')

interface EstadisticasMes {
  gastosFijos: number
  gastosVariables: number
  gastosPorPagar: number
  gastosAdeudados: number
  totalGastos: number
}

interface PagoMes {
  id: string
  descripcion: string
  monto: number
  fecha: string
  medio_pago: string
  participante: string
}

const meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function ResumenScreen() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mesActual, setMesActual] = useState(new Date().getMonth() + 1)
  const [añoActual, setAñoActual] = useState(new Date().getFullYear())
  const [estadisticas, setEstadisticas] = useState<EstadisticasMes>({
    gastosFijos: 0,
    gastosVariables: 0,
    gastosPorPagar: 0,
    gastosAdeudados: 0,
    totalGastos: 0
  })
  const [pagosMes, setPagosMes] = useState<PagoMes[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    cargarDatos()
  }, [mesActual, añoActual])

  useFocusEffect(
    React.useCallback(() => {
      cargarDatos()
    }, [])
  )

  const cargarDatos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.id) {
        console.log('Usuario no autenticado')
        setLoading(false)
        setRefreshing(false)
        return
      }

      setCurrentUserId(user.id)
      
      // Cargar gastos del mes para estadísticas
      const gastosData = await gastosService.obtenerGastosCuotasUnificadas(user.id, mesActual, añoActual)
      
      // Cargar pagos del mes
      const pagosData = await pagosService.obtenerPagos(user.id)
      const pagosFiltrados = pagosData.filter(pago => {
        const fechaPago = new Date(pago.fecha_pago)
        return fechaPago.getMonth() + 1 === mesActual && fechaPago.getFullYear() === añoActual
      })

      // Calcular estadísticas
      const stats = calcularEstadisticas(gastosData, user.id)
      setEstadisticas(stats)
      
      // Formatear pagos para mostrar
      const pagosFormateados = pagosFiltrados.map(pago => ({
        id: pago.id,
        descripcion: pago.gasto?.descripcion || 'Gasto eliminado',
        monto: pago.monto,
        fecha: pago.fecha_pago,
        medio_pago: pago.medio_pago,
        participante: pago.participante?.nickname || pago.participante?.email || 'Usuario'
      }))
      
      setPagosMes(pagosFormateados)
    } catch (error) {
      console.error('Error cargando datos:', error)
      showAlert('Error', 'No se pudieron cargar los datos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const calcularEstadisticas = (gastos: any[], userId: string): EstadisticasMes => {
    let gastosFijos = 0
    let gastosVariables = 0
    let gastosPorPagar = 0
    let gastosAdeudados = 0

    gastos.forEach(gasto => {
      // Solo considerar gastos propios del usuario
      const esGastoPropio = gasto.creador_id === userId
      
      if (esGastoPropio) {
        const montoTotal = gasto.monto_total || 0
        
        if (gasto.tipo === 'fijo') {
          gastosFijos += montoTotal
        } else {
          gastosVariables += montoTotal
        }
        
        // Calcular gastos por pagar (cuotas no pagadas completamente)
        const progreso = gasto.progreso_pago || 0
        if (progreso < 100) {
          gastosPorPagar += montoTotal * (1 - progreso / 100)
        }
      } else {
        // Para gastos de otros, calcular lo que nos adeudan
        const montoUsuario = gasto.participantes?.find((p: any) => p.usuario_id === userId)?.monto || 0
        const pagadoUsuario = gasto.participantes?.find((p: any) => p.usuario_id === userId)?.monto_pagado || 0
        
        if (montoUsuario > pagadoUsuario) {
          gastosAdeudados += (montoUsuario - pagadoUsuario)
        }
      }
    })

    return {
      gastosFijos,
      gastosVariables,
      gastosPorPagar,
      gastosAdeudados,
      totalGastos: gastosFijos + gastosVariables
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos()
  }

  const navegarMes = (direccion: 'anterior' | 'siguiente') => {
    if (direccion === 'anterior') {
      if (mesActual === 1) {
        setMesActual(12)
        setAñoActual(añoActual - 1)
      } else {
        setMesActual(mesActual - 1)
      }
    } else {
      if (mesActual === 12) {
        setMesActual(1)
        setAñoActual(añoActual + 1)
      } else {
        setMesActual(mesActual + 1)
      }
    }
  }

  const irMesActual = () => {
    const hoy = new Date()
    setMesActual(hoy.getMonth() + 1)
    setAñoActual(hoy.getFullYear())
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  const obtenerColorMedioPago = (medio: string) => {
    switch (medio) {
      case 'efectivo': return '#4CAF50'
      case 'transferencia': return '#2196F3'
      default: return '#666'
    }
  }

  // Datos para el gráfico circular
  const datosGrafico = [
    {
      name: 'Gastos Fijos',
      population: estadisticas.gastosFijos,
      color: '#FF6B6B',
      legendFontColor: '#333',
      legendFontSize: 14,
    },
    {
      name: 'Gastos Variables',
      population: estadisticas.gastosVariables,
      color: '#4ECDC4',
      legendFontColor: '#333',
      legendFontSize: 14,
    },
  ]

  const chartConfig = {
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  }

  return (
    <View style={styles.container}>
      {/* Header con navegación mensual */}
      <View style={styles.header}>
        <View style={styles.selectorMes}>
          <IconButton
            icon="chevron-left"
            size={24}
            onPress={() => navegarMes('anterior')}
            style={styles.navegacionButton}
          />
          <TouchableOpacity style={styles.mesContainer} onPress={irMesActual}>
            <Text style={styles.mesTexto}>
              {meses[mesActual - 1]} {añoActual}
            </Text>
          </TouchableOpacity>
          <IconButton
            icon="chevron-right"
            size={24}
            onPress={() => navegarMes('siguiente')}
            style={styles.navegacionButton}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Gráfico circular */}
        {estadisticas.totalGastos > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Distribución de Gastos</Title>
              <View style={styles.chartContainer}>
                <PieChart
                  data={datosGrafico}
                  width={width - 64}
                  height={200}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Estadísticas */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Resumen del Mes</Title>
            <View style={styles.estadisticasGrid}>
              <View style={styles.estadisticaItem}>
                <Text style={styles.estadisticaNumero}>
                  {formatearMonto(estadisticas.gastosPorPagar)}
                </Text>
                <Text style={styles.estadisticaLabel}>Por Pagar</Text>
              </View>
              <View style={styles.estadisticaItem}>
                <Text style={styles.estadisticaNumero}>
                  {formatearMonto(estadisticas.gastosAdeudados)}
                </Text>
                <Text style={styles.estadisticaLabel}>Me Adeudan</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Listado de pagos */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Pagos del Mes ({pagosMes.length})</Title>
            {pagosMes.length > 0 ? (
              pagosMes.map((pago) => (
                <View key={pago.id} style={styles.pagoItem}>
                  <View style={styles.pagoInfo}>
                    <Text style={styles.pagoDescripcion} numberOfLines={1}>
                      {pago.descripcion}
                    </Text>
                    <Text style={styles.pagoParticipante}>
                      {pago.participante}
                    </Text>
                  </View>
                  <View style={styles.pagoMeta}>
                    <Text style={styles.pagoMonto}>
                      {formatearMonto(pago.monto)}
                    </Text>
                    <View style={styles.pagoDetalles}>
                      <Chip
                        style={[styles.medioChip, { backgroundColor: obtenerColorMedioPago(pago.medio_pago) }]}
                        textStyle={styles.medioChipText}
                      >
                        {pago.medio_pago === 'efectivo' ? 'EF' : 'TR'}
                      </Chip>
                      <Text style={styles.pagoFecha}>
                        {formatearFecha(pago.fecha)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No hay pagos registrados este mes</Text>
            )}
          </Card.Content>
        </Card>
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  scrollView: {
    flex: 1,
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
  chartContainer: {
    alignItems: 'center',
  },
  estadisticasGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  estadisticaItem: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  estadisticaNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  estadisticaLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  pagoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pagoInfo: {
    flex: 1,
    marginRight: 12,
  },
  pagoDescripcion: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  pagoParticipante: {
    fontSize: 12,
    color: '#666',
  },
  pagoMeta: {
    alignItems: 'flex-end',
  },
  pagoMonto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  pagoDetalles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medioChip: {
    height: 24,
    minWidth: 32,
  },
  medioChipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pagoFecha: {
    fontSize: 11,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
})