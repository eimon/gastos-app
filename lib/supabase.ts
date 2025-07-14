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

// Interfaces principales
export interface Usuario {
  id: string
  username: string
  email: string
  first_name?: string
  last_name?: string
  is_active: boolean
  is_verified: boolean
  rol: string
  provider?: string
  provider_id?: string
  foto_url?: string
  created_at: string
  updated_at: string
}

export interface Participante {
  id: string
  email?: string
  nickname: string
  usuario_id?: string
  es_registrado: boolean
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: Usuario
}

export interface Gasto {
  id: string
  descripcion?: string
  monto_total: number
  tipo: TipoGasto
  cuotas: number
  descuento?: number
  creado_por: string
  created_at: string
  // Relaciones
  usuario?: Usuario
  detalles?: GastoDetalle[]
}

export interface GastoDetalle {
  id: string
  gasto_id: string
  participante_id: string
  monto: number
  pagado: boolean
  saldo?: number
  vencimiento?: string
  // Relaciones
  gasto?: Gasto
  participante?: Participante
  pagos?: Pago[]
}

export interface Pago {
  id: string
  gasto_detalle_id: string
  medio_pago: MedioPago
  comprobante_url?: string
  created_at: string
  // Relaciones
  gasto_detalle?: GastoDetalle
}

// Tipos para crear/actualizar
export interface ParticipanteCreate {
  nickname: string
  email?: string
  usuario_id?: string
  monto_total: number
}

export interface GastoCreate {
  descripcion?: string
  tipo: TipoGasto
  cuotas?: number
  descuento?: number
  primer_vencimiento: string
  participantes: ParticipanteCreate[]
  pagado?: boolean
}

export interface PagoCreate {
  medio_pago: MedioPago
  comprobante_url?: string
}

// Funciones de utilidad para trabajar con Supabase
export const gastosService = {
  // Obtener gastos del usuario
  async obtenerGastos(userId: string) {
    const { data, error } = await supabase
      .from('gastos')
      .select(`
        *,
        usuario:usuarios(*),
        detalles:gasto_detalle(
          *,
          participante:participantes(*),
          pagos:pagos(*)
        )
      `)
      .eq('creado_por', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Gasto[]
  },

  // Crear gasto
  async crearGasto(gasto: GastoCreate, userId: string) {
    const { data, error } = await supabase
      .from('gastos')
      .insert({
        descripcion: gasto.descripcion,
        monto_total: gasto.participantes.reduce((sum, p) => sum + p.monto_total, 0),
        tipo: gasto.tipo,
        cuotas: gasto.cuotas || 1,
        descuento: gasto.descuento,
        creado_por: userId
      })
      .select()
      .single()
    
    if (error) throw error
    return data as Gasto
  },

  // Eliminar gasto
  async eliminarGasto(gastoId: string, userId: string) {
    // Verificar que el gasto pertenece al usuario
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos')
      .select('id, creado_por')
      .eq('id', gastoId)
      .eq('creado_por', userId)
      .single()
    
    if (gastoError || !gasto) throw new Error('Gasto no encontrado o sin permisos')
    
    // Verificar que no hay pagos asociados
    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('id')
      .in('gasto_detalle_id', 
        supabase
          .from('gasto_detalle')
          .select('id')
          .eq('gasto_id', gastoId)
      )
    
    if (pagosError) throw pagosError
    if (pagos && pagos.length > 0) {
      throw new Error('No se puede eliminar un gasto con pagos asociados')
    }
    
    // Eliminar gasto (cascade eliminará detalles)
    const { error } = await supabase
      .from('gastos')
      .delete()
      .eq('id', gastoId)
    
    if (error) throw error
  }
}

export const pagosService = {
  // Obtener pagos del usuario
  async obtenerPagos(userId: string) {
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        *,
        gasto_detalle:gasto_detalle(
          *,
          gasto:gastos(*),
          participante:participantes(*)
        )
      `)
      .in('gasto_detalle_id',
        supabase
          .from('gasto_detalle')
          .select('id')
          .in('gasto_id',
            supabase
              .from('gastos')
              .select('id')
              .eq('creado_por', userId)
          )
      )
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Pago[]
  },

  // Crear pago
  async crearPago(gastoDetalleId: string, pago: PagoCreate, userId: string) {
    // Verificar que el gasto detalle pertenece al usuario
    const { data: detalle, error: detalleError } = await supabase
      .from('gasto_detalle')
      .select(`
        *,
        gasto:gastos!inner(creado_por)
      `)
      .eq('id', gastoDetalleId)
      .eq('gasto.creado_por', userId)
      .single()
    
    if (detalleError || !detalle) {
      throw new Error('Gasto detalle no encontrado o sin permisos')
    }
    
    // Crear pago
    const { data, error } = await supabase
      .from('pagos')
      .insert({
        gasto_detalle_id: gastoDetalleId,
        medio_pago: pago.medio_pago,
        comprobante_url: pago.comprobante_url
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Actualizar estado de pagado en gasto_detalle
    await supabase
      .from('gasto_detalle')
      .update({ pagado: true })
      .eq('id', gastoDetalleId)
    
    return data as Pago
  },

  // Eliminar pago
  async eliminarPago(pagoId: string, userId: string) {
    // Verificar que el pago pertenece al usuario
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .select(`
        *,
        gasto_detalle:gasto_detalle!inner(
          id,
          gasto:gastos!inner(creado_por)
        )
      `)
      .eq('id', pagoId)
      .eq('gasto_detalle.gasto.creado_por', userId)
      .single()
    
    if (pagoError || !pago) {
      throw new Error('Pago no encontrado o sin permisos')
    }
    
    // Eliminar pago
    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('id', pagoId)
    
    if (error) throw error
    
    // Actualizar estado de pagado en gasto_detalle
    await supabase
      .from('gasto_detalle')
      .update({ pagado: false })
      .eq('id', pago.gasto_detalle_id)
  }
}

export const participantesService = {
  // Obtener participantes del usuario
  async obtenerParticipantes(userId: string) {
    const { data, error } = await supabase
      .from('participantes')
      .select('*')
      .or(`usuario_id.eq.${userId},es_registrado.eq.false`)
      .order('nickname')
    
    if (error) throw error
    return data as Participante[]
  },

  // Crear participante
  async crearParticipante(participante: Omit<Participante, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('participantes')
      .insert(participante)
      .select()
      .single()
    
    if (error) throw error
    return data as Participante
  }
}