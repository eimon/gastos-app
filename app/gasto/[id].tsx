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
  SegmentedButtons,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { supabase, gastosService, pagosService, Gasto, GastoDetalle, GastoCuotaUnificada } from '../../lib/supabase'
import { showAlert, showConfirm } from '../../lib/alerts'
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
  const [editGastoModalVisible, setEditGastoModalVisible] = useState(false)
  const [nuevaDescripcion, setNuevaDescripcion] = useState('')
  const [nuevoMontoGasto, setNuevoMontoGasto] = useState('')
  const [tienePagosAsociados, setTienePagosAsociados] = useState(false)
  
  // Estados para cambio de participante
  const [cambiarParticipanteModalVisible, setCambiarParticipanteModalVisible] = useState(false)
  const [participanteACambiar, setParticipanteACambiar] = useState<GastoDetalle | null>(null)
  const [tabSeleccionada, setTabSeleccionada] = useState('no-usuario')
  const [nuevoParticipante, setNuevoParticipante] = useState({
    nickname: '',
    email: ''
  })
  const [emailBusqueda, setEmailBusqueda] = useState('')
  const [usuarioEncontrado, setUsuarioEncontrado] = useState<any>(null)
  const [buscandoUsuario, setBuscandoUsuario] = useState(false)
  
  // Estados para favoritos
  const [favoritos, setFavoritos] = useState<any[]>([])
  const [cargandoFavoritos, setCargandoFavoritos] = useState(false)
  const [favoritoSeleccionado, setFavoritoSeleccionado] = useState<any>(null)


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

      showAlert('Éxito', 'Pago registrado correctamente')
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

  // Función para manejar el cambio de participante
  const handleCambiarParticipante = (detalle: GastoDetalle) => {
    setParticipanteACambiar(detalle)
    setCambiarParticipanteModalVisible(true)
    // Cargar favoritos cuando se abre el modal
    cargarFavoritos()
  }

  const cargarFavoritos = async () => {
    setCargandoFavoritos(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: favoritosData, error } = await supabase
        .rpc('obtener_favoritos_usuario')

      if (error) {
        console.error('Error cargando favoritos:', error)
        return
      }

      // Filtrar favoritos que no sean el participante actual
      const favoritosFiltrados = favoritosData?.filter((favorito: any) => {
        // Para favoritos con usuario registrado
        if (favorito.usuario_favorito_id) {
          return favorito.usuario_favorito_id !== participanteACambiar?.usuario_id
        }
        // Para favoritos sin usuario registrado (solo nombre)
        return favorito.nombre_favorito !== participanteACambiar?.nombre_participante
      }) || []

      setFavoritos(favoritosFiltrados)
    } catch (error) {
      console.error('Error cargando favoritos:', error)
    } finally {
      setCargandoFavoritos(false)
    }
  }

  const cambiarAFavoritoSeleccionado = async () => {
    if (!favoritoSeleccionado || !participanteACambiar) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await gastosService.cambiarParticipanteGasto(
        gastoBase!.id,
        user.id,
        participanteACambiar.id,
        favoritoSeleccionado.usuario_favorito_id,
        favoritoSeleccionado.usuario_favorito_id ? undefined : favoritoSeleccionado.nombre_favorito
      )

      showAlert('Éxito', 'Participante cambiado correctamente')
      cerrarModalCambiarParticipante()
      cargarGastoDetalle(gastoId, numeroCuota)
    } catch (error: any) {
      console.error('Error cambiando participante:', error)
      showAlert('Error', error.message || 'No se pudo cambiar el participante')
    }
  }

  // Función para buscar usuario por email
  const buscarUsuarioPorEmail = async () => {
    if (!emailBusqueda.trim()) return
    
    setBuscandoUsuario(true)
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nickname, email')
        .eq('email', emailBusqueda.trim().toLowerCase())
        .single()
      
      if (error || !data) {
        showAlert('Usuario no encontrado', 'No se encontró un usuario con ese email')
        setUsuarioEncontrado(null)
      } else {
        setUsuarioEncontrado(data)
      }
    } catch (error) {
      console.error('Error buscando usuario:', error)
      showAlert('Error', 'Error al buscar el usuario')
    } finally {
      setBuscandoUsuario(false)
    }
  }

  // Función para cerrar modal de cambio de participante
  const cerrarModalCambiarParticipante = () => {
    setCambiarParticipanteModalVisible(false)
    setParticipanteACambiar(null)
    setTabSeleccionada('no-usuario')
    setNuevoParticipante({ nickname: '', email: '' })
    setEmailBusqueda('')
    setUsuarioEncontrado(null)
    setBuscandoUsuario(false)
    setFavoritos([])
    setFavoritoSeleccionado(null)
    setCargandoFavoritos(false)
  }

  // Función para cambiar participante sin usuario
  const cambiarParticipanteNoUsuario = async () => {
    if (!participanteACambiar || !nuevoParticipante.nickname.trim()) {
      showAlert('Error', 'El nombre es requerido')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await gastosService.cambiarParticipanteGasto(
        gastoBase!.id,
        user.id,
        participanteACambiar.id,
        undefined,
        nuevoParticipante.nickname.trim()
      )

      showAlert('Éxito', 'Participante cambiado correctamente')
      cerrarModalCambiarParticipante()
      cargarGastoDetalle(gastoId, numeroCuota)
    } catch (error: any) {
      console.error('Error cambiando participante:', error)
      showAlert('Error', error.message || 'No se pudo cambiar el participante')
    }
  }

  // Función para cambiar a usuario encontrado
  const cambiarAUsuarioEncontrado = async () => {
    if (!participanteACambiar || !usuarioEncontrado) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await gastosService.cambiarParticipanteGasto(
        gastoBase!.id,
        user.id,
        participanteACambiar.id,
        usuarioEncontrado.id,
        undefined
      )

      showAlert('Éxito', 'Participante cambiado correctamente')
      cerrarModalCambiarParticipante()
      cargarGastoDetalle(gastoId, numeroCuota)
    } catch (error: any) {
      console.error('Error cambiando participante:', error)
      showAlert('Error', error.message || 'No se pudo cambiar el participante')
    }
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

      showAlert('Éxito', 'Monto actualizado correctamente')
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

  // Función para verificar si el gasto tiene pagos asociados
  const verificarPagosAsociados = async (gastoIdParam: string) => {
    try {
      // Primero obtenemos los IDs de los detalles del gasto
      const { data: detalles, error: detallesError } = await supabase
        .from('gastos_detalle')
        .select('id')
        .eq('gasto_id', gastoIdParam)
      
      if (detallesError) throw detallesError
      if (!detalles || detalles.length === 0) return false
      
      const detalleIds = detalles.map(d => d.id)
      
      // Luego verificamos si hay pagos para esos detalles
      const { data: pagos, error: pagosError } = await supabase
        .from('pagos')
        .select('id')
        .in('gasto_detalle_id', detalleIds)
        .limit(1)
      
      if (pagosError) throw pagosError
      return pagos && pagos.length > 0
    } catch (error) {
      console.error('Error verificando pagos:', error)
      return false
    }
  }

  // Función para manejar la edición del gasto completo
  const handleEditGasto = async () => {
    if (!gastoBase) return
    
    const tienePagos = await verificarPagosAsociados(gastoBase.id)
    setTienePagosAsociados(tienePagos)
    setNuevaDescripcion(gastoBase.descripcion)
    setNuevoMontoGasto(gastoBase.monto.toString())
    setEditGastoModalVisible(true)
  }

  // Función para guardar los cambios del gasto
  const handleGuardarGasto = async () => {
    if (!gastoBase || (!nuevaDescripcion.trim() && !nuevoMontoGasto.trim())) {
      showAlert('Error', 'Por favor completa al menos un campo')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let montoNumerico: number | undefined
      
      // Validar el monto si se proporciona
      if (nuevoMontoGasto.trim() && nuevoMontoGasto !== gastoBase.monto.toString()) {
        montoNumerico = parseFloat(nuevoMontoGasto)
        if (isNaN(montoNumerico) || montoNumerico <= 0) {
          showAlert('Error', 'Por favor ingresa un monto válido')
          return
        }
      }

      // Usar la función RPC para editar el gasto
      await gastosService.editarGasto(
        gastoBase.id,
        user.id,
        nuevaDescripcion.trim() !== gastoBase.descripcion ? nuevaDescripcion.trim() : undefined,
        montoNumerico
      )

      showAlert('Éxito', 'Gasto actualizado correctamente')
      setEditGastoModalVisible(false)
      setNuevaDescripcion('')
      setNuevoMontoGasto('')
      
      // Recargar los datos
      cargarGastoDetalle(gastoId, numeroCuota)
    } catch (error: any) {
      console.error('Error actualizando gasto:', error)
      showAlert('Error', error.message || 'No se pudo actualizar el gasto')
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
              showAlert('Éxito', 'Pago eliminado correctamente')
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
            <View style={styles.tituloContainer}>
              <Title style={styles.titulo}>
                {gastoBase.descripcion}{gastoBase.cuotas > 1 ? ` - Cuota ${numeroCuota}` : ''}
              </Title>
              <IconButton
                icon="pencil"
                size={20}
                iconColor="#666"
                style={styles.editGastoIcon}
                onPress={handleEditGasto}
              />
            </View>
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
                            {(!tienePagos) && detalle.usuario_id !== gastoBase.usuario_id && (
                              <IconButton
                                icon="account-edit-outline" 
                                size={16}
                                iconColor="#666"
                                style={styles.editIcon}
                                onPress={() => handleCambiarParticipante(detalle)}
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

        {/* <Button
          mode="outlined"
          onPress={() => router.push(`/gastos/editar/${gastoId}`)}
          style={styles.actionButton}
          icon="pencil"
        >
          Editar Gasto
        </Button> */}
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

        {/* Modal de edición de gasto */}
        <Modal
          visible={editGastoModalVisible}
          onDismiss={() => setEditGastoModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            padding: 20,
            margin: 20,
            borderRadius: 8,
          }}
        >
          <Title>Editar Gasto</Title>
          <TextInput
            label="Descripción"
            value={nuevaDescripcion}
            onChangeText={setNuevaDescripcion}
            mode="outlined"
            style={{ marginBottom: 16 }}
          />
          {!tienePagosAsociados && (gastoBase?.cuotas || 1) === 1 && (
            <TextInput
              label="Monto Total"
              value={nuevoMontoGasto}
              onChangeText={setNuevoMontoGasto}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginBottom: 16 }}
            />
          )}
          {(tienePagosAsociados || (gastoBase?.cuotas || 1) > 1) && (
            <Paragraph style={{ marginBottom: 16, color: '#666' }}>
              {tienePagosAsociados 
                ? 'El monto no se puede modificar porque el gasto tiene pagos asociados.'
                : 'El monto no se puede modificar porque el gasto está dividido en cuotas.'
              }
            </Paragraph>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              mode="outlined"
              onPress={() => setEditGastoModalVisible(false)}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleGuardarGasto}
            >
              Guardar
            </Button>
          </View>
        </Modal>

        {/* Modal de cambio de participante */}
        <Modal
          visible={cambiarParticipanteModalVisible}
          onDismiss={cerrarModalCambiarParticipante}
          contentContainerStyle={{
            backgroundColor: 'white',
            padding: 20,
            margin: 20,
            borderRadius: 8,
            maxHeight: '80%',
          }}
        >
          <Title>Cambiar Participante</Title>
          <Paragraph style={{ marginBottom: 16 }}>
            Participante actual: {participanteACambiar?.usuario?.nickname || participanteACambiar?.nombre_participante || 'Participante'}
          </Paragraph>
          
          {/* Pestañas */}
          <SegmentedButtons
            value={tabSeleccionada}
            onValueChange={(value) => {
              setTabSeleccionada(value)
              if (value === 'favoritos' && favoritos.length === 0 && !cargandoFavoritos) {
                cargarFavoritos()
              }
            }}
            buttons={[
              { 
                value: 'no-usuario', 
                label: 'Sin Usuario',
                style: { flex: 1 }
              },
              { 
                value: 'buscar-usuario', 
                label: 'Buscar Usuario',
                style: { flex: 1 }
              },
              { 
                value: 'favoritos', 
                label: 'Favoritos',
                style: { flex: 1 }
              }
            ]}
            style={{ marginBottom: 16 }}
          />

          {/* Contenido de la pestaña "Sin Usuario" */}
          {tabSeleccionada === 'no-usuario' && (
            <View style={{ marginTop: 8 }}>
              <Paragraph style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                Cambiar a un participante que no tiene cuenta en la app
              </Paragraph>
              <TextInput
                label="Nombre del participante *"
                value={nuevoParticipante.nickname}
                onChangeText={(text) => 
                  setNuevoParticipante({ ...nuevoParticipante, nickname: text })
                }
                mode="outlined"
                style={{ marginBottom: 16 }}
              />
            </View>
          )}

          {/* Contenido de la pestaña "Buscar Usuario" */}
          {tabSeleccionada === 'buscar-usuario' && (
            <View style={{ marginTop: 8 }}>
              <Paragraph style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                Buscar un usuario registrado por su email
              </Paragraph>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
                <TextInput
                  label="Email del usuario *"
                  value={emailBusqueda}
                  onChangeText={setEmailBusqueda}
                  keyboardType="email-address"
                  mode="outlined"
                  style={{ flex: 1 }}
                />
                <Button
                  mode="contained"
                  onPress={buscarUsuarioPorEmail}
                  loading={buscandoUsuario}
                  disabled={buscandoUsuario || !emailBusqueda.trim()}
                >
                  Buscar
                </Button>
              </View>
              
              {/* Usuario encontrado */}
              {usuarioEncontrado && (
                <Card style={{ marginTop: 16, backgroundColor: '#e8f5e8' }}>
                  <Card.Content>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2e7d32' }}>
                      {usuarioEncontrado.nickname}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#4caf50' }}>
                      {usuarioEncontrado.email}
                    </Text>
                  </Card.Content>
                </Card>
              )}
            </View>
          )}

          {/* Contenido de la pestaña "Favoritos" */}
          {tabSeleccionada === 'favoritos' && (
            <View style={{ marginTop: 8 }}>
              <Paragraph style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                Seleccionar de tus usuarios favoritos
              </Paragraph>
              
              {cargandoFavoritos ? (
                <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 20 }}>Cargando favoritos...</Text>
              ) : favoritos.length === 0 ? (
                <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 20, lineHeight: 20 }}>
                  No tienes usuarios favoritos disponibles.
                </Text>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {favoritos.map((favorito) => (
                    <Card 
                      key={favorito.id} 
                      style={[
                        { marginBottom: 8, backgroundColor: '#f8f9fa' },
                        favoritoSeleccionado?.id === favorito.id && { backgroundColor: '#e3f2fd', borderColor: '#2196F3', borderWidth: 2 }
                      ]}
                      onPress={() => setFavoritoSeleccionado(favorito)}
                    >
                      <Card.Content>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                          {favorito.nickname || favorito.nombre_favorito}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                          {favorito.email_favorito}
                        </Text>
                        {/* <Text style={{ fontSize: 12, color: '#2196F3', marginTop: 4, fontStyle: 'italic' }}>
                          Usado {favorito.frecuencia_uso} {favorito.frecuencia_uso === 1 ? 'vez' : 'veces'}
                        </Text> */}
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}
          
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button
              mode="outlined"
              onPress={cerrarModalCambiarParticipante}
            >
              Cancelar
            </Button>
            
            {tabSeleccionada === 'no-usuario' ? (
              <Button
                mode="contained"
                onPress={cambiarParticipanteNoUsuario}
                disabled={!nuevoParticipante.nickname.trim()}
              >
                Cambiar
              </Button>
            ) : tabSeleccionada === 'buscar-usuario' ? (
              <Button
                mode="contained"
                onPress={cambiarAUsuarioEncontrado}
                disabled={!usuarioEncontrado}
              >
                Cambiar Usuario
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={cambiarAFavoritoSeleccionado}
                disabled={!favoritoSeleccionado}
              >
                Cambiar a Favorito
              </Button>
            )}
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
  tituloContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  editGastoIcon: {
    margin: 0,
    padding: 4,
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