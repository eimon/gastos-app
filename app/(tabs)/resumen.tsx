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
import { supabase, gastosService, pagosService, resumenService, Gasto, Pago, TipoGasto, DatosResumenMensual } from '../../lib/supabase'
import { showAlert } from '../../lib/alerts'
import { useFocusEffect } from '@react-navigation/native'
import { PieChart } from 'react-native-chart-kit'
import { useMonth } from '../../contexts/MonthContext'

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
  vencimiento?: string
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
  const [estadisticas, setEstadisticas] = useState<EstadisticasMes>({
    gastosFijos: 0,
    gastosVariables: 0,
    gastosPorPagar: 0,
    gastosAdeudados: 0,
    totalGastos: 0
  })
  const [datosResumen, setDatosResumen] = useState<DatosResumenMensual | null>(null)
  const [pagosMes, setPagosMes] = useState<PagoMes[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { mesActual, añoActual, navegarMesAnterior, navegarMesSiguiente, irMesActual } = useMonth()

  useEffect(() => {
    cargarDatos()
  }, [mesActual, añoActual])

  useFocusEffect(
    React.useCallback(() => {
      cargarDatos()
    }, [mesActual, añoActual])
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
      
      // Obtener datos unificados del resumen mensual
      const datosResumenMensual = await resumenService.obtenerDatosResumenMensual(
        user.id, 
        mesActual, 
        añoActual
      )
      setDatosResumen(datosResumenMensual)
      
      // Actualizar estadísticas con los nuevos datos
      setEstadisticas({
        gastosFijos: datosResumenMensual.gastos_fijos,
        gastosVariables: datosResumenMensual.gastos_variables,
        gastosPorPagar: datosResumenMensual.por_pagar,
        gastosAdeudados: datosResumenMensual.me_adeudan,
        totalGastos: datosResumenMensual.total_gastos
      })
      
      // Obtener pagos del mes para mostrar en la lista
      const pagosData = await pagosService.obtenerPagos(user.id, mesActual, añoActual)
      
      // Formatear pagos para mostrar
      const pagosFormateados = pagosData
        .map(pago => ({
          id: pago.id,
          descripcion: pago.gasto_detalle?.gasto?.descripcion || 'Gasto eliminado',
          monto: pago.monto,
          fecha: pago.fecha_pago,
          vencimiento: pago.gasto_detalle?.vencimiento,
          medio_pago: pago.medio_pago,
          participante: pago.gasto_detalle?.usuario?.nickname || pago.gasto_detalle?.usuario?.email || 'Usuario'
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

  // Función eliminada - ahora usamos resumenService.obtenerDatosResumenMensual

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos()
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
    // Crear fecha local para evitar problemas de zona horaria
    const [año, mes, dia] = fecha.split('-').map(Number)
    const fechaLocal = new Date(año, mes - 1, dia)
    return fechaLocal.toLocaleDateString('es-AR', {
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

  // Datos para el gráfico circular - solo mostrar categorías con valores > 0
  const datosGrafico = [
    ...(estadisticas.gastosFijos > 0 ? [{
      name: `Fijo`,
      population: estadisticas.gastosFijos,
      color: '#FF6B6B',
      legendFontColor: '#333',
      legendFontSize: 12,
    }] : []),
    ...(estadisticas.gastosVariables > 0 ? [{
      name: `Variable`, 
      population: estadisticas.gastosVariables,
      color: '#4ECDC4',
      legendFontColor: '#333',
      legendFontSize: 12,
    }] : [])
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
            onPress={navegarMesAnterior}
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
            onPress={navegarMesSiguiente}
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
        {datosGrafico.length > 0 && (
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
                    {pago.vencimiento && (
                      <Text style={styles.pagoVencimiento}>
                        Vencimiento: {formatearFecha(pago.vencimiento)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.pagoMeta}>
                    <Text style={styles.pagoMonto}>
                      {formatearMonto(pago.monto)}
                    </Text>
                    <View style={styles.pagoDetalles}>
                      <View style={[styles.medioChip, { backgroundColor: obtenerColorMedioPago(pago.medio_pago) }]}>
                        <Ionicons 
                          name={pago.medio_pago === 'efectivo' ? 'cash' : 'card'} 
                          size={14} 
                          color="white" 
                        />
                      </View>
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
  pagoVencimiento: {
    fontSize: 11,
    color: '#FF9800',
    fontStyle: 'italic',
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
    height: 28,
    width: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
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