import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase usando variables de entorno
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY son requeridas')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos para TypeScript basados en la lógica de api-expo

// Enums
export type TipoGasto = 'personal' | 'compartido'
export type MedioPago = 'Efectivo' | 'Transferencia'
export type TipoDescuento = 'uniforme' | 'prorrateo'


// Interfaces principales actualizadas para esquema simplificado
export interface Usuario {
  id: string
  email: string
  nickname: string
  first_name?: string
  last_name?: string
  saldo_total?: number
  created_at: string
  updated_at: string
}

export interface Gasto {
  id: string
  usuario_id: string
  descripcion: string
  monto: number
  tipo: TipoGasto
  fecha: string
  cuotas: number
  descuento?: number
  tipo_descuento?: TipoDescuento
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: Usuario
  detalles?: GastoDetalle[]
}

export interface GastoDetalle {
  id: string
  gasto_id: string
  usuario_id?: string  // Referencia directa a usuarios (opcional para no registrados)
  nombre_participante?: string  // Nombre para participantes no registrados
  monto: number
  pagado: boolean
  vencimiento?: string
  numero_cuota: number
  created_at: string
  updated_at: string
  // Relaciones
  gasto?: Gasto
  usuario?: Usuario
  pagos?: Pago[]
}

export interface Pago {
  id: string
  gasto_detalle_id: string
  monto: number
  fecha_pago: string
  medio_pago: 'efectivo' | 'transferencia' | 'descuento'
  notas?: string
  created_at: string
  updated_at: string
  // Relaciones
  gasto_detalle?: GastoDetalle
}

// Interfaces para crear entidades
export interface GastoCreate {
  descripcion: string
  monto_total: number
  tipo: TipoGasto
  fecha: string
  cuotas: number
  descuento?: number
  tipo_descuento?: TipoDescuento
  participantes: ParticipanteCreate[]
  primer_vencimiento: string
  pagado?: boolean
  usuario_id?: string
}

export interface ParticipanteCreate {
  nickname: string
  email?: string
  usuario_id?: string
  monto_total: number
}

export interface GastoDetalleCreate {
  gasto_id: string
  usuario_id?: string
  nombre_participante?: string
  monto: number
  pagado?: boolean
  vencimiento?: string
  numero_cuota: number
}

export interface PagoCreate {
  gasto_detalle_id: string
  monto: number
  medio_pago: MedioPago
  fecha_pago: string
  notas?: string
  comprobante_url?: string
}

// Interfaces para IOUs eliminadas - funcionalidad simplificada

// Funciones de utilidad para trabajar con Supabase

// Función para calcular montos de cuotas con descuento
export function calcularMontosConDescuento(
  montoTotal: number,
  cuotas: number,
  descuento: number,
  tipoDescuento: TipoDescuento
): number[] {
  const montoNeto = montoTotal - descuento
  const montoPorCuota = montoTotal / cuotas
  const montosResultado: number[] = []
  
  if (tipoDescuento === 'uniforme') {
    // Distribución uniforme: (monto - descuento) / cuotas
    const montoCuotaUniforme = montoNeto / cuotas
    for (let i = 0; i < cuotas; i++) {
      montosResultado.push(Math.round(montoCuotaUniforme * 100) / 100)
    }
  } else {
    // Prorrateo: descuento se aplica desde la primera cuota
    let descuentoRestante = descuento
    
    for (let i = 0; i < cuotas; i++) {
      let montoCuota = montoPorCuota
      
      if (descuentoRestante >= montoPorCuota) {
        // El descuento cubre toda la cuota
        montoCuota = 0
        descuentoRestante -= montoPorCuota
      } else if (descuentoRestante > 0) {
        // El descuento cubre parte de la cuota
        montoCuota = montoPorCuota - descuentoRestante
        descuentoRestante = 0
      }
      
      montosResultado.push(Math.round(montoCuota * 100) / 100)
    }
  }
  
  return montosResultado
}

export const gastosService = {
  // Obtener gastos del usuario (propios y compartidos)
  async obtenerGastos(userId: string) {
    // Obtener gastos propios (creados por el usuario)
    const { data: gastosPropio, error: errorPropio } = await supabase
      .from('gastos')
      .select(`
        *,
        detalles:gastos_detalle(
          *,
          usuario:usuarios(nickname, email),
          pagos(*)
        )
      `)
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
    
    if (errorPropio) throw errorPropio

    // Obtener gastos compartidos donde el usuario participa (pero no es el creador)
    const { data: gastosCompartidos, error: errorCompartidos } = await supabase
      .from('gastos')
      .select(`
        *,
        detalles:gastos_detalle(
          *,
          usuario:usuarios(nickname, email),
          pagos(*)
        )
      `)
      .neq('usuario_id', userId)
      .eq('detalles.usuario_id', userId)
      .order('created_at', { ascending: false })
    
    if (errorCompartidos) throw errorCompartidos

    // Combinar ambos arrays y eliminar duplicados
    const todosLosGastos = [...(gastosPropio || []), ...(gastosCompartidos || [])]
    const gastosUnicos = todosLosGastos.filter((gasto, index, self) => 
      index === self.findIndex(g => g.id === gasto.id)
    )

    // Ordenar por fecha de creación descendente
    gastosUnicos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    return gastosUnicos as Gasto[]
  },

  // Crear gasto
  async crearGasto(gasto: GastoCreate, userId: string) {
    // Crear el gasto principal
    const { data: nuevoGasto, error: gastoError } = await supabase
      .from('gastos')
      .insert({
        usuario_id: userId,
        descripcion: gasto.descripcion,
        monto: gasto.monto_total,
        tipo: gasto.tipo,
        fecha: gasto.fecha,
        cuotas: gasto.cuotas,
        descuento: gasto.descuento || 0,
        tipo_descuento: gasto.tipo_descuento || 'uniforme'
      })
      .select()
      .single()
    
    if (gastoError) throw gastoError
    
    // Crear detalles para cada participante y cuota
    const detalles: GastoDetalleCreate[] = []
    
    // Calcular montos de cuotas con descuento aplicado
    const montosCalculados = calcularMontosConDescuento(
      gasto.monto_total,
      gasto.cuotas,
      gasto.descuento || 0,
      gasto.tipo_descuento || 'uniforme'
    )
    
    // Iterar primero por cada cuota, luego por cada participante
    for (let cuota = 1; cuota <= gasto.cuotas; cuota++) {
      const fechaVencimiento = new Date(gasto.primer_vencimiento)
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + (cuota - 1))
      
      for (const participante of gasto.participantes) {
        const montoPorParticipante = Math.round((montosCalculados[cuota - 1] / gasto.participantes.length) * 100) / 100
        
        detalles.push({
          gasto_id: nuevoGasto.id,
          usuario_id: participante.usuario_id,
          nombre_participante: participante.usuario_id ? null : participante.nickname,
          monto: montoPorParticipante,
          pagado: gasto.pagado || false || montoPorParticipante === 0,
          vencimiento: fechaVencimiento.toISOString().split('T')[0],
          numero_cuota: cuota
        })
      }
    }
    
    const { error: detallesError } = await supabase
      .from('gastos_detalle')
      .insert(detalles)
    
    if (detallesError) throw detallesError
    
    return nuevoGasto
  },

  // Eliminar gasto
  async eliminarGasto(gastoId: string, userId: string) {
    // Verificar que el gasto pertenece al usuario
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos')
      .select('id, usuario_id')
      .eq('id', gastoId)
      .eq('usuario_id', userId)
      .single()
    
    if (gastoError || !gasto) throw new Error('Gasto no encontrado o sin permisos')
    
    // Eliminar gasto (cascade eliminará detalles)
    const { error } = await supabase
      .from('gastos')
      .delete()
      .eq('id', gastoId)
    
    if (error) throw error
  }
}
// Servicios de participantes (ya no se usan con el esquema simplificado)
// export const participantesService = { ... }


export const pagosService = {
  // Obtener pagos del usuario
  async obtenerPagos(userId: string) {
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        *,
        gasto_detalle:gastos_detalle(
          *,
          usuario:usuarios(nickname, email),
          gasto:gastos(
            id,
            descripcion,
            usuario_id
          )
        )
      `)
      .eq('gasto_detalle.usuario_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Pago[]
  },

  // Crear pago
  async crearPago(pago: PagoCreate, userId: string) {
    // Verificar que el gasto detalle pertenece al usuario
    const { data: detalle, error: detalleError } = await supabase
      .from('gastos_detalle')
      .select(`
        *,
        gasto:gastos!inner(usuario_id)
      `)
      .eq('id', pago.gasto_detalle_id)
      .eq('gasto.usuario_id', userId)
      .single()
    
    if (detalleError || !detalle) {
      throw new Error('Gasto detalle no encontrado o sin permisos')
    }
    
    // Crear pago
    const { data, error } = await supabase
      .from('pagos')
      .insert({
        gasto_detalle_id: pago.gasto_detalle_id,
        monto: pago.monto,
        medio_pago: pago.medio_pago,
        fecha_pago: pago.fecha_pago,
        notas: pago.notas
      })
      .select()
      .single()
    
    if (error) throw error
    return data as Pago
  },

  // Eliminar pago
  async eliminarPago(pagoId: string, userId: string) {
    // Verificar permisos
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .select(`
        *,
        gasto_detalle:gastos_detalle!inner(
          gasto:gastos!inner(usuario_id)
        )
      `)
      .eq('id', pagoId)
      .eq('gasto_detalle.gasto.usuario_id', userId)
      .single()
    
    if (pagoError || !pago) {
      throw new Error('Pago no encontrado o sin permisos')
    }
    
    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('id', pagoId)
    
    if (error) throw error
  }
}

// Servicios de IOU (ya no se usan con el esquema simplificado)
// export const iouService = { ... }