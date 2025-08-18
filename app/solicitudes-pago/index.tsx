import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native'
import {
  Card,
  Button,
  IconButton,
  Chip,
  ActivityIndicator
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase, solicitudesPagoService, SolicitudPago } from '../../lib/supabase'
import { router } from 'expo-router'
import { showAlert, showConfirm } from '../../lib/alerts'
import { StyleSheet } from 'react-native'

export default function SolicitudesPagoScreen() {
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState<SolicitudPago[]>([])
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<SolicitudPago[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [vistaActual, setVistaActual] = useState<'recibidas' | 'enviadas'>('recibidas')

  useEffect(() => {
    cargarSolicitudes()
  }, [])

  const cargarSolicitudes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [recibidas, enviadas] = await Promise.all([
        solicitudesPagoService.obtenerSolicitudesRecibidas(user.id),
        solicitudesPagoService.obtenerSolicitudesEnviadas(user.id)
      ])

      setSolicitudesRecibidas(recibidas)
      setSolicitudesEnviadas(enviadas)
    } catch (error: any) {
      showAlert('Error', 'No se pudieron cargar las solicitudes')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarSolicitudes()
  }

  const aceptarSolicitud = async (solicitudId: string, usuarioCreadorId: string) => {
    showConfirm(
      'Confirmar pago',
      '¿Estás seguro de que quieres aceptar esta solicitud? Se generará automáticamente el pago correspondiente.',
      async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          
          await solicitudesPagoService.aceptarSolicitud(solicitudId, usuarioCreadorId)
          showAlert('Éxito', 'Solicitud aceptada y pago generado correctamente')
          await cargarSolicitudes()
        } catch (error: any) {
          showAlert('Error', error.message || 'No se pudo aceptar la solicitud')
        }
      }
    )
  }

  const rechazarSolicitud = async (solicitudId: string) => {
    showConfirm(
      'Rechazar solicitud',
      '¿Estás seguro de que quieres rechazar esta solicitud?',
      async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          
          await solicitudesPagoService.rechazarSolicitud(solicitudId, user.id)
          showAlert('Información', 'Solicitud rechazada')
          await cargarSolicitudes()
        } catch (error: any) {
          showAlert('Error', error.message || 'No se pudo rechazar la solicitud')
        }
      }
    )
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return '#FF9800'
      case 'aceptada': return '#4CAF50'
      case 'rechazada': return '#F44336'
      default: return '#757575'
    }
  }

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente'
      case 'aceptada': return 'Aceptada'
      case 'rechazada': return 'Rechazada'
      default: return estado
    }
  }

  const formatearFecha = (fecha: string) => {
    // Crear fecha local para evitar problemas de zona horaria
    const [año, mes, dia] = fecha.split('-').map(Number)
    const fechaLocal = new Date(año, mes - 1, dia)
    return fechaLocal.toLocaleDateString('es-AR')
  }

  const renderSolicitud = (solicitud: SolicitudPago, esRecibida: boolean) => {
    return (
      <Card style={styles.solicitudCard}>
        <Card.Content>
          <View style={styles.solicitudHeader}>
            <View style={styles.solicitudInfo}>
              <Text style={styles.solicitudDescripcion}>
                {solicitud.gasto_descripcion}
              </Text>
              <Text style={styles.solicitudUsuario}>
                {esRecibida ? 'De: ' : 'Para: '}
                {esRecibida 
                  ? (solicitud.solicitante_nickname || solicitud.solicitante_email)
                  : (solicitud.creador_nickname || solicitud.creador_email)
                }
              </Text>
              <Text style={styles.solicitudMonto}>
                ${solicitud.monto.toFixed(2)}
              </Text>
            </View>
            <Chip 
              style={[styles.estadoChip, { backgroundColor: getEstadoColor(solicitud.estado) }]}
              textStyle={styles.estadoTexto}
            >
              {getEstadoTexto(solicitud.estado)}
            </Chip>
          </View>
          
          {solicitud.notas && (
            <Text style={styles.solicitudNotas}>{solicitud.notas}</Text>
          )}
          
          <Text style={styles.solicitudFecha}>
            {formatearFecha(solicitud.fecha_solicitud)}
          </Text>
          
          {esRecibida && solicitud.estado === 'pendiente' && (
            <View style={styles.botonesAccion}>
              <Button
                key={`aceptar-${solicitud.solicitud_id}`}
                mode="contained"
                onPress={() => aceptarSolicitud(solicitud.solicitud_id, solicitud.usuario_creador_id)}
                style={[styles.botonAccion, styles.botonAceptar]}
                labelStyle={styles.botonTexto}
              >
                Aceptar
              </Button>
              <Button
                key={`rechazar-${solicitud.solicitud_id}`}
                mode="outlined"
                onPress={() => rechazarSolicitud(solicitud.solicitud_id, solicitud.usuario_creador_id)}
                style={[styles.botonAccion, styles.botonRechazar]}
                labelStyle={styles.botonTextoRechazar}
              >
                Rechazar
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
        <Text style={styles.loadingText}>Cargando solicitudes...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text style={styles.title}>Solicitudes de Pago</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            vistaActual === 'recibidas' && styles.tabActive
          ]}
          onPress={() => setVistaActual('recibidas')}
        >
          <Text style={[
            styles.tabText,
            vistaActual === 'recibidas' && styles.tabTextActive
          ]}>
            Recibidas ({solicitudesRecibidas.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            vistaActual === 'enviadas' && styles.tabActive
          ]}
          onPress={() => setVistaActual('enviadas')}
        >
          <Text style={[
            styles.tabText,
            vistaActual === 'enviadas' && styles.tabTextActive
          ]}>
            Enviadas ({solicitudesEnviadas.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {vistaActual === 'recibidas' ? (
          solicitudesRecibidas.length > 0 ? (
            solicitudesRecibidas.map(solicitud => (
              <View key={`recibida-${solicitud.id}`}>
                {renderSolicitud(solicitud, true)}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No tienes solicitudes recibidas</Text>
            </View>
          )
        ) : (
          solicitudesEnviadas.length > 0 ? (
            solicitudesEnviadas.map(solicitud => (
              <View key={`enviada-${solicitud.id}`}>
                {renderSolicitud(solicitud, false)}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="send-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No has enviado solicitudes</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  backButton: {
    marginRight: 8
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabActive: {
    borderBottomColor: '#6200EE'
  },
  tabText: {
    fontSize: 16,
    color: '#666'
  },
  tabTextActive: {
    color: '#6200EE',
    fontWeight: 'bold'
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  solicitudCard: {
    marginBottom: 12,
    elevation: 2
  },
  solicitudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  solicitudInfo: {
    flex: 1,
    marginRight: 12
  },
  solicitudDescripcion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  solicitudUsuario: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  solicitudMonto: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  estadoChip: {
    alignSelf: 'flex-start'
  },
  estadoTexto: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  solicitudNotas: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8
  },
  solicitudFecha: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12
  },
  botonesAccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  botonAccion: {
    flex: 1
  },
  botonAceptar: {
    backgroundColor: '#4CAF50'
  },
  botonRechazar: {
    borderColor: '#F44336'
  },
  botonTexto: {
    color: '#fff'
  },
  botonTextoRechazar: {
    color: '#F44336'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center'
  }
})