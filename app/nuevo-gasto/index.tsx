// app/nuevo-gasto/index.tsx - Pantalla para crear un nuevo gasto
import React, { useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import {
  Text,
  TextInput,
  Button,
  Card,
  Chip,
  IconButton,
  SegmentedButtons,
  Switch,
  Portal,
  Modal,
  List,
} from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase, TipoGasto, TipoDescuento, ParticipanteCreate, GastoCreate, gastosService, calcularMontosConDescuento } from '../../lib/supabase'
import { showAlert, showSuccessToast } from '../../lib/alerts'
import DateTimePicker from '@react-native-community/datetimepicker'

interface ParticipanteForm {
  tempId: string
  nickname: string
  email?: string
  usuario_id?: string
}

export default function NuevoGastoScreen() {
  // Estados principales
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<TipoGasto>('personal')
  const [cuotas, setCuotas] = useState<number | undefined>(1)
  const [cuotasText, setCuotasText] = useState('1')
  const [montoTotal, setMontoTotal] = useState<number | undefined>(undefined)
  const [montoTotalText, setMontoTotalText] = useState('')
  const [descuento, setDescuento] = useState<number | undefined>(undefined)
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuento>('uniforme')
  const [primerVencimiento, setPrimerVencimiento] = useState(new Date())
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>([])
  const [pagado, setPagado] = useState(false)
  const [esRecurrente, setEsRecurrente] = useState(false)
  const [loading, setLoading] = useState(false)

  // Estados para UI
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showParticipanteModal, setShowParticipanteModal] = useState(false)
  const [tieneDescuento, setTieneDescuento] = useState(false)
  const [descuentoText, setDescuentoText] = useState('')
  
  // Estados para participante modal
  const [nuevoParticipante, setNuevoParticipante] = useState({
    nickname: '',
    email: ''
  })
  const [tabSeleccionada, setTabSeleccionada] = useState('no-usuario')
  const [emailBusqueda, setEmailBusqueda] = useState('')
  const [usuarioEncontrado, setUsuarioEncontrado] = useState<any>(null)
  const [buscandoUsuario, setBuscandoUsuario] = useState(false)


  useEffect(() => {
    // Agregar al usuario actual como participante tanto para gasto personal como compartido
    if (participantes.length === 0) {
      agregarUsuarioActual()
    }
  }, [tipo])

  useEffect(() => {
    // Resetear esRecurrente cuando hay más de una cuota
    if ((cuotas || 1) > 1 && esRecurrente) {
      setEsRecurrente(false)
    }
  }, [cuotas])

  const resetearFormulario = () => {
    setDescripcion('')
    setTipo('personal')
    setCuotas(1)
    setCuotasText('1')
    setMontoTotal(undefined)
    setMontoTotalText('')
    setDescuento(undefined)
    setTipoDescuento('uniforme')
    setDescuentoText('')
    setPrimerVencimiento(new Date())
    setParticipantes([])
    setPagado(false)
    setEsRecurrente(false)
    setShowDatePicker(false)
    setShowParticipanteModal(false)
    setTieneDescuento(false)
    setNuevoParticipante({
      nickname: '',
      email: ''
    })
    setTabSeleccionada('no-usuario')
    setEmailBusqueda('')
    setUsuarioEncontrado(null)
    setBuscandoUsuario(false)
    
    // Reagregar usuario actual para gasto personal después del reset
    setTimeout(() => {
      agregarUsuarioActual()
    }, 100)
  }

  
  const agregarUsuarioActual = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener datos del usuario
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('nickname, email')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const participanteUsuario: ParticipanteForm = {
        tempId: 'usuario-actual',
        nickname: usuario.nickname || 'Yo',
        email: usuario.email,
        usuario_id: user.id
      }

      setParticipantes([participanteUsuario])
    } catch (error) {
      console.error('Error obteniendo usuario:', error)
    }
  }

  const buscarUsuarioPorEmail = async () => {
    if (!emailBusqueda.trim()) {
      showAlert('Error', 'El email es requerido')
      return
    }

    setBuscandoUsuario(true)
    try {
      const { data: usuarios, error } = await supabase
        .rpc('buscar_usuario_por_email', { email_busqueda: emailBusqueda.trim() })

      const usuario = usuarios?.[0]

      if (error || !usuario) {
        showAlert('Usuario no encontrado', 'No se encontró un usuario registrado con ese email')
        setUsuarioEncontrado(null)
        return
      }

      // Verificar si ya está agregado
      if (participantes.find(p => p.usuario_id === usuario.id)) {
        showAlert('Error', 'Este usuario ya está agregado')
        return
      }

      setUsuarioEncontrado(usuario)
    } catch (error) {
      console.error('Error buscando usuario:', error)
      showAlert('Error', 'Error al buscar el usuario')
    } finally {
      setBuscandoUsuario(false)
    }
  }

  const agregarParticipanteNoUsuario = () => {
    if (!nuevoParticipante.nickname.trim()) {
      showAlert('Error', 'El nombre es requerido')
      return
    }

    const participante: ParticipanteForm = {
      tempId: Date.now().toString(),
      nickname: nuevoParticipante.nickname.trim(),
      email: undefined,
      usuario_id: undefined
    }

    setParticipantes([...participantes, participante])
    cerrarModalParticipante()
  }

  const agregarUsuarioEncontrado = () => {
    if (!usuarioEncontrado) return

    const participante: ParticipanteForm = {
      tempId: Date.now().toString(),
      nickname: usuarioEncontrado.nickname,
      email: usuarioEncontrado.email,
      usuario_id: usuarioEncontrado.id
    }

    setParticipantes([...participantes, participante])
    cerrarModalParticipante()
  }

  const cerrarModalParticipante = () => {
    setShowParticipanteModal(false)
    setNuevoParticipante({ nickname: '', email: '' })
    setTabSeleccionada('no-usuario')
    setEmailBusqueda('')
    setUsuarioEncontrado(null)
    setBuscandoUsuario(false)
  }

  const eliminarParticipante = (tempId: string) => {
    if (tipo === 'personal' && tempId === 'usuario-actual') {
      showAlert('Error', 'No puedes eliminar tu participación en un gasto personal')
      return
    }
    const participantesArray = Array.isArray(participantes) ? participantes : []
    setParticipantes(participantesArray.filter(p => p.tempId !== tempId))
  }



  const validarFormulario = (): string | null => {
    if (!descripcion.trim()) {
      return 'La descripción es requerida'
    }

    const participantesArray = Array.isArray(participantes) ? participantes : []
    if (participantesArray.length === 0) {
      return 'Se requiere al menos un participante'
    }

    if (tipo === 'personal' && participantesArray.length > 1) {
      return 'Los gastos personales solo pueden tener un participante'
    }

    if (tipo === 'compartido' && participantesArray.length < 2) {
      return 'Los gastos compartidos requieren al menos 2 participantes'
    }

    if (!cuotas || cuotas < 1) {
      return 'El número de cuotas debe ser mayor a 0'
    }

    if (!montoTotal || montoTotal <= 0) {
      return 'El monto total debe ser mayor a 0'
    }

    if (tieneDescuento && (descuento === undefined || descuento < 0)) {
      return 'El descuento debe ser mayor o igual a 0'
    }

    if (tieneDescuento && descuento && descuento >= montoTotal) {
      return 'El descuento no puede ser mayor o igual al monto total'
    }

    return null
  }

  
  const crearGasto = async () => {
    const errorValidacion = validarFormulario()
    if (errorValidacion) {
      showAlert('Error', errorValidacion)
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      // Convertir participantes a la estructura esperada por GastoCreate
      // Para gastos compartidos, cada participante tiene asignado el monto total
      // El descuento y la división se aplicarán en el procesamiento
      const participantesConMonto = participantes.map(p => ({
        nickname: p.nickname,
        email: p.email,
        usuario_id: p.usuario_id,
        monto_total: montoTotal || 0
      }))

      const gastoData: GastoCreate = {
        descripcion: descripcion.trim(),
        monto_total: montoTotal || 0,
        tipo,
        fecha: new Date().toISOString().split('T')[0],
        cuotas: cuotas || 1,
        descuento: descuento || 0,
        tipo_descuento: tipoDescuento,
        participantes: participantesConMonto,
        primer_vencimiento: primerVencimiento.toISOString().split('T')[0],
        pagado,
        es_recurrente: esRecurrente
      }

      await gastosService.crearGasto(gastoData, user.id)
      
      showSuccessToast('Gasto creado exitosamente')
      resetearFormulario()
      router.back()
    } catch (error: any) {
      console.error('Error creando gasto:', error)
      showAlert('Error', error.message || 'No se pudo crear el gasto')
    } finally {
      setLoading(false)
    }
  }

  const crearGastoCompleto = async (gastoData: GastoCreate, userId: string) => {
    console.log('=== INICIO crearGastoCompleto ===');
    console.log('Datos del gasto recibidos:', JSON.stringify(gastoData, null, 2));
    
    // El monto total se toma directamente del gastoData
    const montoTotal = gastoData.monto_total
    console.log('Monto total del gasto:', montoTotal);

    // Crear el gasto principal
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos')
      .insert({
        descripcion: gastoData.descripcion,
        monto_total: montoTotal,
        tipo: gastoData.tipo,
        cuotas: gastoData.cuotas,
        descuento: gastoData.descuento,
        tipo_descuento: gastoData.tipo_descuento || 'uniforme',
        fecha: gastoData.primer_vencimiento,
        usuario_id: userId // El usuario que crea el gasto es siempre el pagador
      })
      .select()
      .single()

    if (gastoError) throw gastoError

    // En la nueva estructura simplificada, los participantes son directamente usuarios
    // Obtenemos los usuarios existentes o creamos nuevos si es necesario
    const participantesCreados = []
    for (const p of gastoData.participantes) {
      let participante
      
      // Buscar usuario existente por email o crear nuevo
      let usuario_existente = null
      if (p.email) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', p.email)
          .single()
        usuario_existente = data
      }
      
      if (usuario_existente) {
        participante = usuario_existente
      } else {
        // Crear nuevo usuario
        const { data: nuevo, error } = await supabase
          .from('usuarios')
          .insert({
            nickname: p.nickname,
            email: p.email || `${p.nickname.toLowerCase().replace(/\s+/g, '')}@temp.com`
          })
          .select()
          .single()
        
        if (error) throw error
        participante = nuevo
      }
      
      participantesCreados.push({ participante, monto: p.monto_total })
    }
    
    // Añadir el usuario que crea el gasto a gastoData para usarlo en procesarGastoCompartido
    gastoData.usuario_id = userId

    // Crear detalles del gasto según el tipo
    if (gastoData.tipo === 'personal') {
      await procesarGastoPersonal(gasto.id, gastoData, participantesCreados)
    } else {
      await procesarGastoCompartido(gasto.id, gastoData, participantesCreados)
    }

    return gasto
  }

  const procesarGastoPersonal = async (gastoId: string, gastoData: GastoCreate, participantesCreados: any[]) => {
    const { participante, monto } = participantesCreados[0]
    
    if (gastoData.cuotas === 1) {
      // Caso 1: Gasto personal en un pago
      const montoFinal = monto - (gastoData.descuento || 0)
      
      const { error } = await supabase
        .from('gastos_detalle')
        .insert({
          gasto_id: gastoId,
          usuario_id: participante.id,
          monto: Math.round(montoFinal * 100) / 100,
          pagado: gastoData.pagado || false || montoFinal === 0,
          numero_cuota: 1
        })
      
      if (error) throw error
      
      // Si está marcado como pagado, crear el pago
      if (gastoData.pagado && montoFinal > 0) {
        const { data: detalle } = await supabase
          .from('gastos_detalle')
          .select('id')
          .eq('gasto_id', gastoId)
          .single()
        
        if (detalle) {
          await supabase
            .from('pagos')
            .insert({
              gasto_detalle_id: detalle.id,
              monto: montoFinal,
              medio_pago: 'efectivo',
              fecha_pago: new Date().toISOString().split('T')[0]
            })
        }
      }
    } else {
      // Casos 2 y 3: Gasto personal en cuotas
      const montosCalculados = calcularMontosConDescuento(
        monto,
        gastoData.cuotas,
        gastoData.descuento || 0,
        gastoData.tipo_descuento || 'uniforme'
      )
      
      for (let i = 0; i < gastoData.cuotas; i++) {
        const fechaVencimiento = new Date(gastoData.primer_vencimiento)
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i)
        
        const { error } = await supabase
          .from('gastos_detalle')
          .insert({
            gasto_id: gastoId,
            usuario_id: participante.id,
            monto: montosCalculados[i],
            pagado: montosCalculados[i] === 0,
            numero_cuota: i + 1,
            vencimiento: fechaVencimiento.toISOString().split('T')[0]
          })
        
        if (error) throw error
      }
    }
  }

  const procesarGastoCompartido = async (gastoId: string, gastoData: GastoCreate, participantesCreados: any[]) => {
    console.log('=== INICIO procesarGastoCompartido (nuevo-gasto/index.tsx) ===');
    console.log('Gasto ID:', gastoId);
    console.log('Participantes creados:', JSON.stringify(participantesCreados, null, 2));
    
    // Para gastos compartidos, el monto total ya está calculado correctamente en crearGastoCompleto
    // Necesitamos obtener el monto total del gasto creado
    const { data: gastoCreado } = await supabase
      .from('gastos')
      .select('monto_total')
      .eq('id', gastoId)
      .single()
    
    const montoTotal = gastoCreado?.monto_total || 0
    console.log('Monto total del gasto:', montoTotal);
    
    if (gastoData.cuotas === 1) {
      // Caso 4: Gasto compartido en un pago
      const montoNeto = montoTotal - (gastoData.descuento || 0)
      const montoEquitativo = montoNeto / participantesCreados.length
      console.log('Monto neto del gasto:', montoNeto);
      console.log('Monto equitativo por participante:', montoEquitativo);
      
      // Preparar todos los detalles para insertar en una sola operación
      const detallesParaInsertar = participantesCreados.map(({ participante, monto: aporte }) => {
        // En la nueva estructura simplificada, solo guardamos el monto y si está pagado
        // El pagado se determina si el usuario que crea el gasto es el mismo que el participante
        const pagado = participante.id === gastoData.usuario_id || montoEquitativo === 0
        
        const detalleInsert = {
          gasto_id: gastoId,
          usuario_id: participante.id,
          monto: Math.round(montoEquitativo * 100) / 100,
          pagado: pagado,
          numero_cuota: 1
        };
        
        console.log(`Preparando detalle para participante ${participante.nickname}:`, JSON.stringify(detalleInsert, null, 2));
        console.log(`Lógica: aporte=${aporte}, monto_equitativo=${montoEquitativo}, pagado=${pagado}`);
        
        return detalleInsert;
      });
      
      // Insertar todos los detalles en una sola operación para evitar problemas con el trigger de validación
      console.log('Insertando todos los detalles en una operación:', JSON.stringify(detallesParaInsertar, null, 2));
      
      const { data: detalles, error } = await supabase
        .from('gastos_detalle')
        .insert(detallesParaInsertar)
        .select()
      
      if (error) {
        console.error('Error al insertar gastos_detalle:', error);
        throw error;
      }
      
      console.log('Todos los detalles creados exitosamente:', detalles);
      
      // Si está marcado como pagado, crear pagos automáticos para todos los participantes
      if (gastoData.pagado && detalles && detalles.length > 0) {
        const pagosParaInsertar = detalles.map(detalle => ({
          gasto_detalle_id: detalle.id,
          monto: detalle.monto,
          medio_pago: 'efectivo',
          fecha_pago: new Date().toISOString().split('T')[0]
        }));
        
        const { error: pagosError } = await supabase
          .from('pagos')
          .insert(pagosParaInsertar)
        
        if (pagosError) {
          console.error('Error al crear pagos automáticos:', pagosError);
          throw pagosError;
        }
        
        console.log('Pagos automáticos creados exitosamente para gasto compartido');
      }
    } else {
      // Casos 5 y 6: Gasto compartido en cuotas
      // Primero calcular las cuotas con descuento del monto total
      const montosCalculadosTotal = calcularMontosConDescuento(
        montoTotal,
        gastoData.cuotas,
        gastoData.descuento || 0,
        gastoData.tipo_descuento || 'uniforme'
      )
      
      // Luego dividir cada cuota entre los participantes
      for (const { participante, monto: aporte } of participantesCreados) {
        await generarCuotasCompartidasConCalculoPrevio(
          gastoId,
          participante.id,
          montosCalculadosTotal,
          participantesCreados.length,
          gastoData.cuotas,
          gastoData.primer_vencimiento
        )
      }
    }
  }

  const generarCuotasCompartidas = async (
    gastoId: string,
    participanteId: string,
    montoPorParticipante: number,
    descuentoPorParticipante: number,
    aporte: number,
    cuotas: number,
    primerVencimiento: string,
    tipoDescuento: TipoDescuento = 'uniforme'
  ) => {
    const montosCalculados = calcularMontosConDescuento(
      montoPorParticipante,
      cuotas,
      descuentoPorParticipante,
      tipoDescuento
    )
    
    for (let i = 0; i < cuotas; i++) {
      const fechaVencimiento = new Date(primerVencimiento)
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i)
      
      const { error } = await supabase
        .from('gastos_detalle')
        .insert({
          gasto_id: gastoId,
          usuario_id: participanteId,
          monto: montosCalculados[i],
          pagado: montosCalculados[i] === 0,
          numero_cuota: i + 1,
          vencimiento: fechaVencimiento.toISOString().split('T')[0]
        })
      
      if (error) throw error
    }
  }

  const generarCuotasCompartidasConCalculoPrevio = async (
    gastoId: string,
    participanteId: string,
    montosCalculadosTotal: number[],
    numeroParticipantes: number,
    cuotas: number,
    primerVencimiento: string
  ) => {
    for (let i = 0; i < cuotas; i++) {
      const fechaVencimiento = new Date(primerVencimiento)
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i)
      
      // Dividir el monto de cada cuota entre los participantes
      const montoPorParticipante = montosCalculadosTotal[i] / numeroParticipantes
      
      const { error } = await supabase
        .from('gastos_detalle')
        .insert({
          gasto_id: gastoId,
          usuario_id: participanteId,
          monto: Math.round(montoPorParticipante * 100) / 100,
          pagado: montoPorParticipante === 0,
          numero_cuota: i + 1,
          vencimiento: fechaVencimiento.toISOString().split('T')[0]
        })
      
      if (error) throw error
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={styles.card}>
          <Card.Title title="Nuevo Gasto" />
          <Card.Content>
            {/* Descripción */}
            <TextInput
              label="Descripción *"
              value={descripcion}
              onChangeText={setDescripcion}
              style={styles.input}
              mode="outlined"
            />

            {/* Tipo de gasto */}
            <Text style={styles.sectionTitle}>Tipo de Gasto</Text>
            <SegmentedButtons
              value={tipo}
              onValueChange={(value) => {
                const nuevoTipo = value as TipoGasto
                setTipo(nuevoTipo)
                
                if (nuevoTipo === 'personal') {
                  // Para gasto personal, mantener solo el usuario actual
                  const usuarioActual = participantes.find(p => p.tempId === 'usuario-actual')
                  setParticipantes(usuarioActual ? [usuarioActual] : [])
                } else {
                  // Para gasto compartido, mantener el usuario actual si existe
                  const usuarioActual = participantes.find(p => p.tempId === 'usuario-actual')
                  if (!usuarioActual) {
                    // Si no hay usuario actual, agregarlo
                    setTimeout(() => agregarUsuarioActual(), 100)
                  }
                }
              }}
              buttons={[
                { value: 'personal', label: 'Personal' },
                { value: 'compartido', label: 'Compartido' }
              ]}
              style={styles.segmentedButtons}
            />

            {/* Monto total */}
            <TextInput
              label="Monto total *"
              value={montoTotalText}
              onChangeText={(text) => {
                setMontoTotalText(text)
                const numValue = parseFloat(text)
                setMontoTotal(isNaN(numValue) || text === '' ? undefined : numValue)
              }}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
            />

            {/* Número de cuotas */}
            <TextInput
              label="Número de cuotas"
              value={cuotasText}
              onChangeText={(text) => {
                setCuotasText(text)
                const numValue = parseInt(text)
                setCuotas(isNaN(numValue) || text === '' ? undefined : numValue)
              }}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
            />

            {/* Descuento */}
            <View style={styles.switchContainer}>
              <Text>¿Tiene descuento?</Text>
              <Switch
                value={tieneDescuento}
                onValueChange={setTieneDescuento}
              />
            </View>

            {tieneDescuento && (
              <>
                <TextInput
                  label="Monto del descuento"
                  value={descuentoText}
                  onChangeText={(text) => {
                    setDescuentoText(text)
                    const numValue = parseFloat(text)
                    setDescuento(isNaN(numValue) || text === '' ? undefined : numValue)
                  }}
                  keyboardType="numeric"
                  style={styles.input}
                  mode="outlined"
                />
                
                {/* Tipo de descuento */}
                <Text style={styles.sectionTitle}>Tipo de Descuento</Text>
                <SegmentedButtons
                  value={tipoDescuento}
                  onValueChange={(value) => setTipoDescuento(value as TipoDescuento)}
                  buttons={[
                    { 
                      value: 'uniforme', 
                      label: 'Uniforme',
                      style: { flex: 1 }
                    },
                    { 
                      value: 'prorrateo', 
                      label: 'Prorrateo',
                      style: { flex: 1 }
                    }
                  ]}
                  style={styles.segmentedButtons}
                />
                
                {/* Explicación del tipo de descuento */}
                <Text style={styles.descuentoExplicacion}>
                  {tipoDescuento === 'uniforme' 
                    ? 'El descuento se distribuye uniformemente entre todas las cuotas: (monto - descuento) ÷ cuotas'
                    : 'El descuento se aplica desde la primera cuota hasta agotarse, las siguientes cuotas mantienen el monto original'
                  }
                </Text>
              </>
            )}

            {/* Fecha primer vencimiento */}
            <Button
              mode="outlined"
              onPress={() => setShowDatePicker(true)}
              style={styles.dateButton}
            >
              Primer vencimiento: {primerVencimiento.toLocaleDateString('es-AR')}
            </Button>

            {/* Participantes */}
            <View style={styles.participantesSection}>
              <View style={styles.participantesHeader}>
                <Text style={styles.sectionTitle}>Participantes</Text>
                <IconButton
                  icon="plus"
                  size={24}
                  onPress={() => setShowParticipanteModal(true)}
                  disabled={tipo === 'personal' && Array.isArray(participantes) && participantes.length >= 1}
                />
              </View>

              {Array.isArray(participantes) && participantes.map((participante) => (
                <Card key={participante.tempId} style={styles.participanteCard}>
                  <Card.Content>
                    <View style={styles.participanteRow}>
                      <View style={styles.participanteInfo}>
                        <Text style={styles.participanteNombre}>
                          {participante.nickname}
                        </Text>
                        {participante.email && (
                          <Text style={styles.participanteEmail}>
                            {participante.email}
                          </Text>
                        )}

                      </View>
                      <View style={styles.participanteActions}>
                        <IconButton
                          icon="delete"
                          size={20}
                          onPress={() => eliminarParticipante(participante.tempId)}
                          disabled={tipo === 'personal' && participante.tempId === 'usuario-actual'}
                        />
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              ))}

              <Text style={styles.montoTotal}>
                Total: ${(montoTotal || 0).toFixed(2)}
              </Text>
            </View>

            {/* Gasto recurrente */}
            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <Text style={[styles.switchLabel, (cuotas || 1) > 1 && { color: '#999' }]}>¿Es un gasto recurrente?</Text>
                <Text style={[styles.switchDescription, (cuotas || 1) > 1 && { color: '#999' }]}>
                  {(cuotas || 1) > 1 
                    ? 'No disponible para gastos con cuotas'
                    : 'Se generará automáticamente el mes siguiente al pagarlo'
                  }
                </Text>
              </View>
              <Switch
                value={esRecurrente && (cuotas || 1) === 1}
                onValueChange={(value) => {
                  if ((cuotas || 1) === 1) {
                    setEsRecurrente(value)
                  }
                }}
                disabled={(cuotas || 1) > 1}
              />
            </View>

            {/* Pagado (solo para gastos personales de una cuota) */}
            {tipo === 'personal' && cuotas === 1 && (
              <View style={styles.switchContainer}>
                <Text>¿Ya está pagado?</Text>
                <Switch
                  value={pagado}
                  onValueChange={setPagado}
                />
              </View>
            )}


          </Card.Content>

          <Card.Actions>
            <Button
              mode="outlined"
              onPress={() => router.back()}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              mode="outlined"
              onPress={resetearFormulario}
              disabled={loading}
              style={{ marginLeft: 8 }}
            >
              Limpiar
            </Button>
            <Button
              mode="contained"
              onPress={crearGasto}
              loading={loading}
              disabled={loading}
              style={{ marginLeft: 8 }}
            >
              Crear Gasto
            </Button>
          </Card.Actions>
        </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={primerVencimiento}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false)
            if (selectedDate) {
              setPrimerVencimiento(selectedDate)
            }
          }}
        />
      )}

      {/* Modal para agregar participante */}
      <Portal>
        <Modal
          visible={showParticipanteModal}
          onDismiss={cerrarModalParticipante}
          contentContainerStyle={styles.modalContainer}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardAvoidingView}
          >
            <Card>
              <Card.Title title="Agregar Participante" />
              <Card.Content>
                {/* Pestañas */}
                <SegmentedButtons
                  value={tabSeleccionada}
                  onValueChange={setTabSeleccionada}
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
                    }
                  ]}
                  style={styles.tabButtons}
                />

                {/* Contenido de la pestaña "Sin Usuario" */}
                {tabSeleccionada === 'no-usuario' && (
                  <View style={styles.tabContent}>
                    <Text style={styles.tabDescription}>
                      Agregar un participante que no tiene cuenta en la app
                    </Text>
                    <TextInput
                      label="Nombre del participante *"
                      value={nuevoParticipante.nickname}
                      onChangeText={(text) => 
                        setNuevoParticipante({ ...nuevoParticipante, nickname: text })
                      }
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                )}

                {/* Contenido de la pestaña "Buscar Usuario" */}
                {tabSeleccionada === 'buscar-usuario' && (
                  <View style={styles.tabContent}>
                    <Text style={styles.tabDescription}>
                      Buscar un usuario registrado por su email. Podrá ver el gasto pero no modificarlo.
                    </Text>
                    <View style={styles.busquedaContainer}>
                      <TextInput
                        label="Email del usuario *"
                        value={emailBusqueda}
                        onChangeText={setEmailBusqueda}
                        keyboardType="email-address"
                        style={[styles.input, styles.emailInput]}
                        mode="outlined"
                      />
                      <Button
                        mode="contained"
                        onPress={buscarUsuarioPorEmail}
                        loading={buscandoUsuario}
                        disabled={buscandoUsuario || !emailBusqueda.trim()}
                        style={styles.buscarButton}
                      >
                        Buscar
                      </Button>
                    </View>
                    
                    {/* Usuario encontrado */}
                    {usuarioEncontrado && (
                      <Card style={styles.usuarioEncontradoCard}>
                        <Card.Content>
                          <Text style={styles.usuarioEncontradoNombre}>
                            {usuarioEncontrado.nickname}
                          </Text>
                          <Text style={styles.usuarioEncontradoEmail}>
                            {usuarioEncontrado.email}
                          </Text>
                        </Card.Content>
                      </Card>
                    )}
                  </View>
                )}
              </Card.Content>
              
              <Card.Actions>
                <Button
                  mode="outlined"
                  onPress={cerrarModalParticipante}
                >
                  Cancelar
                </Button>
                
                {tabSeleccionada === 'no-usuario' ? (
                  <Button
                    mode="contained"
                    onPress={agregarParticipanteNoUsuario}
                    disabled={!nuevoParticipante.nickname.trim()}
                  >
                    Agregar
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={agregarUsuarioEncontrado}
                    disabled={!usuarioEncontrado}
                  >
                    Agregar Usuario
                  </Button>
                )}
              </Card.Actions>
            </Card>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </SafeAreaView>
  )
}

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 100, // Espacio extra para el teclado
  },
  card: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  dateButton: {
    marginBottom: 16,
  },
  participantesSection: {
    marginTop: 16,
  },
  participantesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  participanteCard: {
    marginBottom: 8,
  },
  participanteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participanteInfo: {
    flex: 1,
  },
  participanteNombre: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  participanteEmail: {
    fontSize: 14,
    color: '#666',
  },
  participanteMonto: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  participanteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  montoInput: {
    width: 100,
    marginRight: 8,
  },
  montoTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    color: '#2196F3',
  },
  montoPorParticipante: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
    minHeight: 300,
    justifyContent: 'center',
  },
  modalKeyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
  },
  descuentoExplicacion: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
    lineHeight: 16,
  },
  tabButtons: {
    marginBottom: 16,
  },
  tabContent: {
    marginTop: 8,
  },
  tabDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  busquedaContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  emailInput: {
    flex: 1,
  },
  buscarButton: {
    marginBottom: 16,
  },
  usuarioEncontradoCard: {
    marginTop: 16,
    backgroundColor: '#e8f5e8',
  },
  usuarioEncontradoNombre: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  usuarioEncontradoEmail: {
    fontSize: 14,
    color: '#4caf50',
  },
})