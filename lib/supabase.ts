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
export type MedioPago = 'efectivo' | 'transferencia' | 'descuento'
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
  es_recurrente?: boolean
  gasto_padre_id?: string  // ID del gasto original que generó este gasto recurrente
  created_at: string
  updated_at: string
  // Relaciones
  usuario?: Usuario
  detalles?: GastoDetalle[]
}

// Nueva interfaz para gastos agrupados por cuota
export interface GastoCuotaUnificada {
  id: string // ID único de la cuota: gasto_id-cuota-numero_cuota
  gasto_id: string // ID original del gasto
  usuario_id: string
  descripcion: string
  monto_total_cuota: number // Monto total de la cuota (suma de todos los participantes)
  monto_usuario: number // Monto específico que le corresponde al usuario actual
  tipo: TipoGasto
  fecha: string // Fecha de vencimiento de la cuota
  cuotas: number
  numero_cuota: number
  descuento?: number
  tipo_descuento?: TipoDescuento
  es_recurrente?: boolean
  gasto_padre_id?: string  // ID del gasto original que generó este gasto recurrente
  created_at: string
  updated_at: string
  // Información específica de la cuota unificada
  cantidad_participantes: number
  monto_pagado: number // Suma de montos pagados por todos los participantes
  monto_pagado_usuario: number // Monto pagado específicamente por el usuario actual
  porcentaje_pagado: number // Porcentaje de la cuota que está pagado
  porcentaje_pagado_usuario: number // Porcentaje pagado por el usuario actual
  esta_completamente_pagada: boolean
  usuario_completamente_pagado: boolean // Si el usuario actual completó su parte
  // Relaciones
  usuario?: Usuario
  participantes: GastoDetalle[] // Todos los participantes de esta cuota
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
  es_recurrente?: boolean
  gasto_padre_id?: string
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

export interface SolicitudPago {
  id: string
  gasto_detalle_id: string
  usuario_solicitante_id: string
  usuario_creador_id: string
  monto: number
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  fecha_solicitud: string
  fecha_respuesta?: string
  notas?: string
  created_at: string
  updated_at: string
  // Campos adicionales devueltos por las funciones RPC
  gasto_id?: string
  gasto_descripcion?: string
  solicitante_email?: string
  solicitante_nickname?: string
  creador_email?: string
  creador_nickname?: string
  numero_cuota?: number
  vencimiento?: string
  // Relaciones
  gasto_detalle?: GastoDetalle
  usuario_solicitante?: Usuario
  usuario_creador?: Usuario
}

export interface SolicitudPagoCreate {
  gasto_detalle_id: string
  usuario_creador_id: string
  monto: number
  notas?: string
}

// Interfaces para IOUs eliminadas - funcionalidad simplificada

// Funciones de utilidad para trabajar con Supabase

// Función para calcular el porcentaje de pago de una cuota completa
export function calcularPorcentajePagoCuota(
  participantes: GastoDetalle[]
): number {
  if (!participantes || participantes.length === 0) return 0
  
  const totalMonto = participantes.reduce((sum, p) => sum + p.monto, 0)
  
  // Considerar gastos con monto 0 como pagados al 100%
  const montoPagado = participantes.reduce((sum, p) => {
    if (p.monto === 0) {
      // Los gastos con monto 0 se consideran pagados completamente
      return sum + 0 // No contribuyen al monto pagado pero tampoco al total
    }
    return sum + (p.pagado ? p.monto : 0)
  }, 0)
  
  return totalMonto > 0 ? Math.round((montoPagado / totalMonto) * 100 * 100) / 100 : 100
}

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
  // Obtener gastos agrupados por cuota unificada
  async obtenerGastosCuotasUnificadas(userId: string, mes?: number, año?: number): Promise<GastoCuotaUnificada[]> {
    console.log(`[DEBUG] Ejecutando obtenerGastosCuotasUnificadas para userId: ${userId}`);
    console.log(`[DEBUG] Buscando gastos para mes: ${mes}, año: ${año}`);
    
    // Usar la función RPC para obtener gastos compartidos correctamente
    const { data: gastosCompartidosTodos, error: errorCompartidos } = await supabase
      .rpc('obtener_gastos_compartidos', { usuario_actual_id: userId })
    
    if (errorCompartidos) {
      console.error('Error al obtener gastos compartidos:', errorCompartidos);
      throw errorCompartidos;
    }

    console.log(`[DEBUG] Gastos compartidos encontrados (sin filtrar): ${gastosCompartidosTodos?.length || 0}`);
    
    // Filtrar gastos compartidos por mes y año si se especifica
    let gastosCompartidos = gastosCompartidosTodos || [];
    if (mes !== undefined && año !== undefined) {
      gastosCompartidos = gastosCompartidosTodos?.filter((gasto: any) => {
        if (!gasto.mi_vencimiento) {
          console.log(`[DEBUG] Gasto compartido sin vencimiento excluido:`, gasto.gasto_id);
          return false;
        }
        // Usar componentes de fecha para evitar problemas de zona horaria
        const [añoStr, mesStr, diaStr] = gasto.mi_vencimiento.split('-');
        const añoVencimiento = parseInt(añoStr);
        const mesVencimiento = parseInt(mesStr);
        const incluir = mesVencimiento === mes && añoVencimiento === año;
        console.log(`[DEBUG] Filtro RPC compartidos - Gasto ${gasto.gasto_id}: vencimiento=${gasto.mi_vencimiento}, mes=${mesVencimiento}, año=${añoVencimiento}, incluir=${incluir}`);
        return incluir;
      }) || [];
    }

    console.log(`[DEBUG] Gastos compartidos después del filtro: ${gastosCompartidos?.length || 0}`);
    if (gastosCompartidos && gastosCompartidos.length > 0) {
      console.log('[DEBUG] Detalles de gastos compartidos filtrados:');
      gastosCompartidos.forEach((gasto: any, index: number) => {
        console.log(`[DEBUG] Gasto ${index + 1}:`, {
          gasto_id: gasto.gasto_id,
          descripcion: gasto.descripcion,
          mi_monto: gasto.mi_monto,
          mi_vencimiento: gasto.mi_vencimiento,
          creador_email: gasto.creador_email
        });
      });
    } else {
      console.log('[DEBUG] No se encontraron gastos compartidos para este usuario después del filtro');
    }

    // Consulta para gastos propios - obtener detalles directamente
    let queryPropio = supabase
      .from('gastos_detalle')
      .select(`
        *,
        gasto:gastos(
          *,
          usuario:usuarios(nickname, email)
        ),
        usuario:usuarios(nickname, email),
        pagos(*)
      `)
      .eq('gasto.usuario_id', userId)
    
    // Filtrar por mes y año de vencimiento si se proporcionan
    if (mes !== undefined && año !== undefined) {
      const inicioMes = new Date(año, mes - 1, 1).toISOString().split('T')[0]
      const finMes = new Date(año, mes, 0).toISOString().split('T')[0] // Último día del mes actual
      
      console.log(`[DEBUG] Filtros de fecha - Mes: ${mes}, Año: ${año}`);
      console.log(`[DEBUG] inicioMes: ${inicioMes}, finMes: ${finMes}`);
      
      queryPropio = queryPropio
        .gte('vencimiento', inicioMes)
        .lte('vencimiento', finMes)
    }
    
    // Ejecutar consulta para gastos propios
    const { data: detallesPropio, error: errorPropio } = await queryPropio.order('vencimiento', { ascending: false })
    
    if (errorPropio) throw errorPropio

    // Convertir gastos compartidos de RPC a formato de detalles
    const detallesCompartidos = (gastosCompartidos || []).map(gc => ({
      id: `${gc.gasto_id}-${gc.mi_numero_cuota}-${userId}`,
      gasto_id: gc.gasto_id,
      usuario_id: userId,
      monto: parseFloat(gc.mi_monto),
      pagado: gc.mi_pagado,
      vencimiento: gc.mi_vencimiento,
      numero_cuota: gc.mi_numero_cuota,
      created_at: gc.created_at,
      updated_at: gc.created_at,
      gasto: {
        id: gc.gasto_id,
        usuario_id: gc.creador_id,
        descripcion: gc.descripcion,
        monto: parseFloat(gc.monto_total),
        tipo: 'compartido' as TipoGasto,
        fecha: gc.fecha,
        cuotas: gc.cuotas,
        descuento: parseFloat(gc.descuento || '0'),
        tipo_descuento: gc.tipo_descuento as TipoDescuento,
        created_at: gc.created_at,
        updated_at: gc.created_at,
        usuario: {
          id: gc.creador_id,
          email: gc.creador_email,
          nickname: gc.creador_nickname,
          created_at: gc.created_at,
          updated_at: gc.created_at
        }
      },
      usuario: {
        id: userId,
        email: '', // Se completará después si es necesario
        nickname: '',
        created_at: '',
        updated_at: ''
      },
      pagos: [] // Se completará después si es necesario
    }))

    // Filtrar gastos compartidos por mes si se especifica
    const detallesCompartidosFiltrados = mes !== undefined && año !== undefined 
      ? detallesCompartidos.filter(detalle => {
          if (!detalle.vencimiento) {
            console.log(`[DEBUG] Detalle sin vencimiento excluido:`, detalle.id);
            return false;
          }
          // Usar componentes de fecha para evitar problemas de zona horaria
          const [añoStr, mesStr, diaStr] = detalle.vencimiento.split('-');
          const añoVencimiento = parseInt(añoStr);
          const mesVencimiento = parseInt(mesStr);
          const incluir = mesVencimiento === mes && añoVencimiento === año;
          console.log(`[DEBUG] Filtro compartidos - Detalle ${detalle.id}: vencimiento=${detalle.vencimiento}, mes=${mesVencimiento}, año=${añoVencimiento}, incluir=${incluir}`);
          return incluir;
        })
      : detallesCompartidos

    // Combinar ambos arrays
    const todosLosDetalles = [...(detallesPropio || []), ...detallesCompartidosFiltrados]
      .filter(detalle => detalle.gasto !== null)
    
    // Obtener todos los detalles de los gastos para agrupar por cuota
    const gastosIds = [...new Set(todosLosDetalles.map(d => d.gasto_id))]
    
    // Consultar todos los detalles de estos gastos para tener la información completa de cada cuota
    const { data: todosLosDetallesCompletos, error: errorCompletos } = await supabase
      .from('gastos_detalle')
      .select(`
        *,
        gasto:gastos(
          *,
          usuario:usuarios(nickname, email)
        ),
        usuario:usuarios(nickname, email),
        pagos(*)
      `)
      .in('gasto_id', gastosIds)
      .order('vencimiento', { ascending: false })
    
    if (errorCompletos) throw errorCompletos
    
    // Agrupar por gasto_id y numero_cuota
    const cuotasAgrupadas = new Map<string, GastoDetalle[]>()
    
    todosLosDetallesCompletos?.forEach(detalle => {
      if (detalle.gasto) {
        const claveGrupo = `${detalle.gasto_id}-cuota-${detalle.numero_cuota}`
        if (!cuotasAgrupadas.has(claveGrupo)) {
          cuotasAgrupadas.set(claveGrupo, [])
        }
        cuotasAgrupadas.get(claveGrupo)!.push(detalle)
      }
    })
    
    // Filtrar solo las cuotas donde el usuario participa
    const cuotasDelUsuario = new Map<string, GastoDetalle[]>()
    
    cuotasAgrupadas.forEach((participantes, claveGrupo) => {
      const usuarioParticipa = participantes.some(p => 
        p.usuario_id === userId || 
        (p.gasto && p.gasto.usuario_id === userId)
      )
      
      if (usuarioParticipa) {
        cuotasDelUsuario.set(claveGrupo, participantes)
      }
    })
    
    // Transformar a GastoCuotaUnificada
    const gastosUnificados: GastoCuotaUnificada[] = []
    
    cuotasDelUsuario.forEach((participantes, claveGrupo) => {
      const primerParticipante = participantes[0]
      const gastoBase = primerParticipante.gasto!
      
      // Calcular estadísticas de la cuota
      const montoTotalCuota = participantes.reduce((sum, p) => sum + p.monto, 0)
      const montoPagado = participantes.reduce((sum, p) => {
        const totalPagos = p.pagos?.reduce((sumPagos, pago) => sumPagos + pago.monto, 0) || 0
        return sum + Math.min(totalPagos, p.monto)
      }, 0)
      const porcentajePagado = calcularPorcentajePagoCuota(participantes)
      const estaCompletamentePagada = montoPagado >= montoTotalCuota
      
      // Calcular estadísticas específicas del usuario actual
      const participanteUsuario = participantes.find(p => p.usuario_id === userId)
      const montoUsuario = participanteUsuario?.monto || 0
      const montoPagadoUsuario = participanteUsuario ? (
        participanteUsuario.pagos?.reduce((sum, pago) => sum + pago.monto, 0) || 0
      ) : 0
      const porcentajePagadoUsuario = montoUsuario > 0 ? (montoPagadoUsuario / montoUsuario) : 0
      const usuarioCompletamentePagado = montoPagadoUsuario >= montoUsuario
      
      // Filtrar por mes si se especifica
        let incluirCuota = true
        if (mes !== undefined && año !== undefined && primerParticipante.vencimiento) {
          // Usar componentes de fecha para evitar problemas de zona horaria
          const [añoStr, mesStr, diaStr] = primerParticipante.vencimiento.split('-');
          const añoVencimiento = parseInt(añoStr);
          const mesVencimiento = parseInt(mesStr);
          incluirCuota = mesVencimiento === mes && añoVencimiento === año
          console.log(`[DEBUG] Filtro final cuota - ${claveGrupo}: vencimiento=${primerParticipante.vencimiento}, mes=${mesVencimiento}, año=${añoVencimiento}, incluir=${incluirCuota}`);
        }
      
      if (incluirCuota) {
        gastosUnificados.push({
          id: claveGrupo,
          gasto_id: gastoBase.id,
          usuario_id: gastoBase.usuario_id,
          descripcion: gastoBase.descripcion,
          monto_total_cuota: montoTotalCuota,
          monto_usuario: montoUsuario,
          tipo: gastoBase.tipo,
          fecha: primerParticipante.vencimiento || gastoBase.fecha,
          cuotas: gastoBase.cuotas,
          numero_cuota: primerParticipante.numero_cuota,
          descuento: gastoBase.descuento,
          tipo_descuento: gastoBase.tipo_descuento,
          created_at: gastoBase.created_at,
          updated_at: gastoBase.updated_at,
          cantidad_participantes: participantes.length,
          monto_pagado: montoPagado,
          monto_pagado_usuario: montoPagadoUsuario,
          porcentaje_pagado: Math.round(porcentajePagado * 100) / 100,
          porcentaje_pagado_usuario: Math.round(porcentajePagadoUsuario * 100) / 100,
          esta_completamente_pagada: estaCompletamentePagada,
          usuario_completamente_pagado: usuarioCompletamentePagado,
          usuario: gastoBase.usuario,
          participantes: participantes
        })
      }
    })
    
    // Ordenar por fecha de vencimiento descendente
    gastosUnificados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    
    return gastosUnificados
  },

  // Obtener gastos del usuario (propios y compartidos) como cuotas individuales
  async obtenerGastos(userId: string, mes?: number, año?: number) {
    // Consulta para gastos propios - obtener detalles directamente
    let queryPropio = supabase
      .from('gastos_detalle')
      .select(`
        *,
        gasto:gastos(
          *,
          usuario:usuarios(nickname, email)
        ),
        usuario:usuarios(nickname, email),
        pagos(*)
      `)
      .eq('gasto.usuario_id', userId)
    
    // Consulta para gastos compartidos - donde el usuario participa pero no es el creador
    let queryCompartidos = supabase
      .from('gastos_detalle')
      .select(`
        *,
        gasto:gastos(
          *,
          usuario:usuarios(nickname, email)
        ),
        usuario:usuarios(nickname, email),
        pagos(*)
      `)
      .eq('usuario_id', userId)
      .neq('gasto.usuario_id', userId)
    
    // Filtrar por mes y año de vencimiento si se proporcionan
    if (mes !== undefined && año !== undefined) {
      const inicioMes = new Date(año, mes - 1, 1).toISOString().split('T')[0]
      const finMes = new Date(año, mes, 0).toISOString().split('T')[0] // Último día del mes actual
      
      console.log(`[DEBUG] obtenerGastos - Filtros de fecha - Mes: ${mes}, Año: ${año}`);
      console.log(`[DEBUG] obtenerGastos - inicioMes: ${inicioMes}, finMes: ${finMes}`);
      
      queryPropio = queryPropio
        .gte('vencimiento', inicioMes)
        .lte('vencimiento', finMes)
      
      queryCompartidos = queryCompartidos
        .gte('vencimiento', inicioMes)
        .lte('vencimiento', finMes)
    }
    
    // Ejecutar consultas
    const [{ data: detallesPropio, error: errorPropio }, { data: detallesCompartidos, error: errorCompartidos }] = await Promise.all([
      queryPropio.order('vencimiento', { ascending: false }),
      queryCompartidos.order('vencimiento', { ascending: false })
    ])
    
    if (errorPropio) throw errorPropio
    if (errorCompartidos) throw errorCompartidos

    // Combinar ambos arrays
    const todosLosDetalles = [...(detallesPropio || []), ...(detallesCompartidos || [])]
    
    // Transformar detalles a formato de gastos individuales por cuota
    const gastosIndividuales = todosLosDetalles
      .filter(detalle => detalle.gasto !== null) // Filtrar detalles sin gasto asociado
      .map(detalle => {
        const gastoBase = detalle.gasto!
        // Generar ID único manejando tanto usuarios registrados como participantes no registrados
        const participanteId = detalle.usuario_id || detalle.nombre_participante || 'anonimo'
        return {
          id: `${gastoBase.id}-cuota-${detalle.numero_cuota}-${participanteId}`, // ID único por cuota y participante
          gasto_id: gastoBase.id, // ID original del gasto
        usuario_id: gastoBase.usuario_id,
        descripcion: gastoBase.descripcion,
        monto: detalle.monto, // Monto específico de esta cuota
        tipo: gastoBase.tipo,
        fecha: detalle.vencimiento, // Usar fecha de vencimiento de la cuota
        cuotas: gastoBase.cuotas,
        numero_cuota: detalle.numero_cuota,
        descuento: gastoBase.descuento,
        tipo_descuento: gastoBase.tipo_descuento,
        created_at: gastoBase.created_at,
        updated_at: gastoBase.updated_at,
        usuario: gastoBase.usuario,
        // Incluir solo el detalle actual
        detalles: [{
          id: detalle.id,
          gasto_id: detalle.gasto_id,
          usuario_id: detalle.usuario_id,
          nombre_participante: detalle.nombre_participante,
          monto: detalle.monto,
          pagado: detalle.pagado,
          vencimiento: detalle.vencimiento,
          numero_cuota: detalle.numero_cuota,
          created_at: detalle.created_at,
          updated_at: detalle.updated_at,
          usuario: detalle.usuario,
          pagos: detalle.pagos
        }]
      }
    })

    // Ordenar por fecha de vencimiento descendente
    gastosIndividuales.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    
    return gastosIndividuales as Gasto[]
  },

  // Obtener gastos donde el usuario participa pero no es el creador
  async obtenerGastosCompartidosComoParticipante(userId: string, mes?: number, año?: number): Promise<GastoCuotaUnificada[]> {
    console.log('[DEBUG] Iniciando obtenerGastosCompartidosComoParticipante para userId:', userId)
    console.log(`[DEBUG] Filtros - mes: ${mes}, año: ${año}`)
    try {
      // Usar la función RPC como respaldo si la consulta directa falla
      console.log('[DEBUG] Intentando usar función RPC como método principal')
      const { data: gastosRPC, error: errorRPC } = await supabase.rpc('obtener_gastos_compartidos', {
        usuario_actual_id: userId
      })
      
      if (errorRPC) {
        console.error('[DEBUG] Error en función RPC:', errorRPC)
        throw errorRPC
      }
      
      console.log('[DEBUG] Función RPC exitosa, gastos encontrados:', gastosRPC?.length || 0)
      
      if (!gastosRPC || gastosRPC.length === 0) {
        return []
      }
      
      // La función RPC ya devuelve solo gastos compartidos donde el usuario participa pero no es creador
      // Aplicar filtro adicional como medida de seguridad para excluir gastos donde el usuario actual es el creador
      let gastosCompartidosComoParticipante = gastosRPC.filter((gasto: any) => gasto.creador_id !== userId)
      
      console.log('[DEBUG] Gastos compartidos como participante (después del filtro):', gastosCompartidosComoParticipante.length)
      console.log('[DEBUG] Gastos filtrados por ser creador:', gastosRPC.length - gastosCompartidosComoParticipante.length)
      
      // Filtrar por mes y año si se especifica
      if (mes !== undefined && año !== undefined) {
        gastosCompartidosComoParticipante = gastosCompartidosComoParticipante.filter((gasto: any) => {
          if (!gasto.mi_vencimiento) {
            console.log(`[DEBUG] Gasto compartido sin vencimiento excluido:`, gasto.gasto_id);
            return false;
          }
          // Usar componentes de fecha para evitar problemas de zona horaria
          const [añoStr, mesStr, diaStr] = gasto.mi_vencimiento.split('-');
          const añoVencimiento = parseInt(añoStr);
          const mesVencimiento = parseInt(mesStr);
          const incluir = mesVencimiento === mes && añoVencimiento === año;
          console.log(`[DEBUG] Filtro participante - Gasto ${gasto.gasto_id}: vencimiento=${gasto.mi_vencimiento}, mes=${mesVencimiento}, año=${añoVencimiento}, incluir=${incluir}`);
          return incluir;
        });
        
        console.log(`[DEBUG] Gastos compartidos después del filtro de fecha: ${gastosCompartidosComoParticipante.length}`);
      }
      
      // Transformar los datos de la RPC al formato GastoCuotaUnificada
      const gastosUnificados: GastoCuotaUnificada[] = gastosCompartidosComoParticipante.map((gasto: any) => ({
        id: `${gasto.gasto_id}-cuota-${gasto.mi_numero_cuota}`,
        gasto_id: gasto.gasto_id,
        usuario_id: gasto.creador_id, // Este es el creador del gasto
        descripcion: gasto.descripcion,
        monto_total_cuota: gasto.monto_total, // Monto total del gasto
        monto_usuario: gasto.mi_monto, // Monto que le corresponde al usuario actual
        tipo: 'compartido' as TipoGasto,
        fecha: gasto.mi_vencimiento || gasto.fecha, // Usar vencimiento si está disponible
        cuotas: gasto.cuotas,
        numero_cuota: gasto.mi_numero_cuota,
        descuento: gasto.descuento,
        tipo_descuento: gasto.tipo_descuento as TipoDescuento,
        es_recurrente: false, // La RPC no devuelve este campo
        gasto_padre_id: null, // La RPC no devuelve este campo
        created_at: gasto.created_at,
        updated_at: gasto.created_at, // Usar created_at como fallback
        cantidad_participantes: 1, // No sabemos la cantidad real
        monto_pagado: gasto.mi_pagado ? gasto.mi_monto : 0,
        monto_pagado_usuario: gasto.mi_pagado ? gasto.mi_monto : 0,
        porcentaje_pagado: gasto.mi_pagado ? 100 : 0,
        porcentaje_pagado_usuario: gasto.mi_pagado ? 100 : 0,
        esta_completamente_pagada: gasto.mi_pagado,
        usuario_completamente_pagado: gasto.mi_pagado,
        usuario: {
          id: gasto.creador_id,
          email: gasto.creador_email,
          nickname: gasto.creador_nickname,
          first_name: '',
          last_name: '',
          created_at: gasto.created_at,
          updated_at: gasto.created_at
        },
        participantes: [] // La RPC no devuelve participantes detallados
      }))
      
      console.log('[DEBUG] Gastos unificados finales:', gastosUnificados.length)
      return gastosUnificados
    } catch (error) {
      console.error('[DEBUG] Error en obtenerGastosCompartidosComoParticipante:', error)
      console.error('[DEBUG] Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
      throw error
    }
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
        tipo_descuento: gasto.tipo_descuento || 'uniforme',
        es_recurrente: gasto.es_recurrente || false,
        gasto_padre_id: gasto.gasto_padre_id || null
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
    
    const { data: detallesCreados, error: detallesError } = await supabase
      .from('gastos_detalle')
      .insert(detalles)
      .select()
    
    if (detallesError) throw detallesError
    
    // Si el gasto está marcado como pagado, crear pagos automáticos
    if (gasto.pagado && detallesCreados) {
      const pagosParaCrear = detallesCreados
        .filter(detalle => detalle.monto > 0) // Solo crear pagos para montos mayores a 0
        .map(detalle => ({
          gasto_detalle_id: detalle.id,
          monto: detalle.monto,
          medio_pago: 'efectivo' as MedioPago,
          fecha_pago: new Date().toISOString().split('T')[0]
        }))
      
      if (pagosParaCrear.length > 0) {
        const { error: pagosError } = await supabase
          .from('pagos')
          .insert(pagosParaCrear)
        
        if (pagosError) {
          console.warn('Error al crear pagos automáticos:', pagosError)
          // No lanzamos el error para no interrumpir la creación del gasto principal
        }
      }
    }
    
    // Si el gasto está marcado como pagado y es recurrente, generar automáticamente el siguiente gasto
    if (gasto.pagado && gasto.es_recurrente) {
      try {
        await this.generarGastoRecurrente(nuevoGasto.id, userId)
      } catch (error) {
        console.warn('Error al generar gasto recurrente automáticamente:', error)
        // No lanzamos el error para no interrumpir la creación del gasto principal
      }
    }
    
    return nuevoGasto
  },

  // Generar gasto recurrente para el mes siguiente
  async generarGastoRecurrente(gastoOriginalId: string, userId: string, nuevoMonto?: number) {
    // Obtener el gasto original
    const { data: gastoOriginal, error: gastoError } = await supabase
      .from('gastos')
      .select(`
        *,
        detalles:gastos_detalle(*)
      `)
      .eq('id', gastoOriginalId)
      .eq('usuario_id', userId)
      .single()
    
    if (gastoError || !gastoOriginal) {
      throw new Error('No se pudo encontrar el gasto original')
    }

    if (!gastoOriginal.es_recurrente) {
      throw new Error('El gasto no es recurrente')
    }

    // Verificar si el gasto original estaba marcado como pagado
    const gastoOriginalEstabaPagado = gastoOriginal.detalles?.every(d => d.pagado) || false

    // Calcular la fecha del próximo mes
    const fechaOriginal = new Date(gastoOriginal.fecha)
    const proximaFecha = new Date(fechaOriginal)
    proximaFecha.setMonth(proximaFecha.getMonth() + 1)

    // Usar el nuevo monto si se proporciona, sino usar el monto original
    const montoAUsar = nuevoMonto || gastoOriginal.monto

    // Crear el nuevo gasto recurrente
    const { data: nuevoGasto, error: nuevoGastoError } = await supabase
      .from('gastos')
      .insert({
        usuario_id: userId,
        descripcion: gastoOriginal.descripcion,
        monto: montoAUsar,
        tipo: gastoOriginal.tipo,
        fecha: proximaFecha.toISOString().split('T')[0],
        cuotas: gastoOriginal.cuotas,
        descuento: gastoOriginal.descuento || 0,
        tipo_descuento: gastoOriginal.tipo_descuento || 'uniforme',
        es_recurrente: true,
        gasto_padre_id: gastoOriginal.gasto_padre_id || gastoOriginalId
      })
      .select()
      .single()
    
    if (nuevoGastoError) throw nuevoGastoError

    // Crear detalles para el nuevo gasto basados en el original
    const detalles: GastoDetalleCreate[] = []
    const cantidadParticipantes = gastoOriginal.detalles?.filter(d => d.numero_cuota === 1).length || 1
    
    // Calcular montos de cuotas con descuento aplicado
    const montosCalculados = calcularMontosConDescuento(
      montoAUsar,
      gastoOriginal.cuotas,
      gastoOriginal.descuento || 0,
      gastoOriginal.tipo_descuento || 'uniforme'
    )

    // Crear detalles para cada cuota y participante
    for (let cuota = 1; cuota <= gastoOriginal.cuotas; cuota++) {
      const fechaVencimiento = new Date(proximaFecha)
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + (cuota - 1))
      
      // Obtener participantes únicos de la cuota 1 del gasto original
      const participantesOriginales = gastoOriginal.detalles?.filter(d => d.numero_cuota === 1) || []
      
      for (const participanteOriginal of participantesOriginales) {
        const montoPorParticipante = Math.round((montosCalculados[cuota - 1] / cantidadParticipantes) * 100) / 100
        
        detalles.push({
          gasto_id: nuevoGasto.id,
          usuario_id: participanteOriginal.usuario_id,
          nombre_participante: participanteOriginal.nombre_participante,
          monto: montoPorParticipante,
          pagado: false, // El nuevo gasto siempre debe empezar sin pagar
          vencimiento: fechaVencimiento.toISOString().split('T')[0],
          numero_cuota: cuota
        })
      }
    }

    const { data: detallesCreados, error: detallesError } = await supabase
      .from('gastos_detalle')
      .insert(detalles)
      .select()
    
    if (detallesError) throw detallesError

    // No crear pagos automáticos para el nuevo gasto recurrente
    // Los pagos deben permanecer asociados únicamente al gasto original

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
    
    // Verificar que no existan pagos asociados al gasto
    const { data: pagosAsociados, error: pagosError } = await supabase
      .from('pagos')
      .select(`
        id,
        gasto_detalle:gastos_detalle!inner(
          gasto_id
        )
      `)
      .eq('gasto_detalle.gasto_id', gastoId)
      .limit(1)
    
    if (pagosError) {
      throw new Error('Error al verificar pagos asociados')
    }
    
    if (pagosAsociados && pagosAsociados.length > 0) {
      throw new Error('No se puede eliminar el gasto porque tiene pagos asociados. Primero elimine todos los pagos.')
    }
    
    // Eliminar gasto (cascade eliminará detalles)
    const { error } = await supabase
      .from('gastos')
      .delete()
      .eq('id', gastoId)
    
    if (error) throw error
  },

  // Actualizar monto de detalle y recalcular
  async actualizarMontoDetalle(detalleId: string, nuevoMonto: number, userId: string) {
    // Verificar que el detalle pertenece a un gasto del usuario
    const { data: detalle, error: detalleError } = await supabase
      .from('gastos_detalle')
      .select(`
        id,
        gasto_id,
        monto,
        numero_cuota,
        gasto:gastos!inner(
          id,
          usuario_id,
          monto,
          cuotas,
          descuento,
          tipo_descuento
        )
      `)
      .eq('id', detalleId)
      .eq('gasto.usuario_id', userId)
      .single()
    
    if (detalleError || !detalle) {
      throw new Error('Detalle no encontrado o sin permisos')
    }

    // Verificar que no tenga pagos asociados
    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('id')
      .eq('gasto_detalle_id', detalleId)
      .limit(1)
    
    if (pagosError) {
      throw new Error('Error al verificar pagos asociados')
    }
    
    if (pagos && pagos.length > 0) {
      throw new Error('No se puede editar el monto porque tiene pagos asociados')
    }

    // Actualizar el monto del detalle
    const { error: updateError } = await supabase
      .from('gastos_detalle')
      .update({ monto: nuevoMonto })
      .eq('id', detalleId)
    
    if (updateError) throw updateError

    // Recalcular todos los detalles del gasto
    await this.recalcularDetallesGasto(detalle.gasto_id, userId)
  },

  // Recalcular todos los detalles de un gasto
  async recalcularDetallesGasto(gastoId: string, userId: string) {
    // Obtener el gasto y todos sus detalles
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos')
      .select(`
        id,
        monto,
        cuotas,
        descuento,
        tipo_descuento,
        detalles:gastos_detalle(
          id,
          monto,
          numero_cuota
        )
      `)
      .eq('id', gastoId)
      .eq('usuario_id', userId)
      .single()
    
    if (gastoError || !gasto) {
      throw new Error('Gasto no encontrado')
    }

    // Calcular el nuevo monto total basado en los detalles actuales
    const montoTotalDetalles = gasto.detalles?.reduce((sum, detalle) => sum + detalle.monto, 0) || 0
    
    // Actualizar el monto del gasto si es diferente
    if (montoTotalDetalles !== gasto.monto) {
      const { error: updateGastoError } = await supabase
        .from('gastos')
        .update({ monto: montoTotalDetalles })
        .eq('id', gastoId)
      
      if (updateGastoError) throw updateGastoError
    }

    return { montoAnterior: gasto.monto, montoNuevo: montoTotalDetalles }
  }
}
// Servicios de participantes (ya no se usan con el esquema simplificado)
// export const participantesService = { ... }


export const pagosService = {
  // Obtener pagos del usuario
  async obtenerPagos(userId: string, mes?: number, año?: number) {
    const { data, error } = await supabase.rpc('obtener_pagos_usuario', {
      p_usuario_id: userId,
      p_mes: mes || null,
      p_año: año || null
    });

    if (error) {
      console.error('Error al obtener pagos:', error);
      throw error;
    }

    return data?.map((row: any) => ({
      id: row.pago_id,
      gasto_detalle_id: row.gasto_detalle_id,
      monto: row.pago_monto,
      fecha_pago: row.pago_fecha_pago,
      medio_pago: row.pago_medio_pago,
      notas: row.pago_notas,
      created_at: row.pago_created_at,
      updated_at: row.pago_updated_at,
      gasto_detalle: {
        id: row.gasto_detalle_id,
        gasto_id: row.gasto_id,
        usuario_id: row.usuario_id,
        monto: row.gasto_detalle_monto,
        pagado: row.gasto_detalle_pagado,
        vencimiento: row.gasto_detalle_vencimiento,
        numero_cuota: row.gasto_detalle_numero_cuota,
        created_at: row.gasto_detalle_created_at,
        updated_at: row.gasto_detalle_updated_at,
        gasto: {
          id: row.gasto_id,
          usuario_id: row.gasto_usuario_id,
          descripcion: row.gasto_descripcion,
          monto: row.gasto_monto,
          tipo: row.gasto_tipo,
          fecha: row.gasto_fecha,
          cuotas: row.gasto_cuotas,
          created_at: row.gasto_created_at,
          updated_at: row.gasto_updated_at,
          usuario: {
            id: row.gasto_usuario_id,
            email: row.gasto_usuario_email,
            nickname: row.gasto_usuario_nickname,
            created_at: row.gasto_usuario_created_at,
            updated_at: row.gasto_usuario_updated_at
          }
        },
        usuario: {
          id: row.usuario_id,
          email: row.usuario_email,
          nickname: row.usuario_nickname,
          created_at: row.usuario_created_at,
          updated_at: row.usuario_updated_at
        }
      }
    })) || [];
  },

  // Crear pago
  async crearPago(pago: PagoCreate, userId: string) {
    // Verificar que el gasto detalle pertenece al usuario
    const { data: detalle, error: detalleError } = await supabase
      .from('gastos_detalle')
      .select(`
        *,
        gasto:gastos!inner(*)
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

    // Verificar si el gasto es recurrente y si se completó el pago de TODO el gasto
    if (detalle.gasto?.es_recurrente) {
      // Verificar si TODOS los detalles del gasto (todas las cuotas) están pagados
      const { data: todosLosDetalles, error: detallesError } = await supabase
        .from('gastos_detalle')
        .select('*, pagos(*)')
        .eq('gasto_id', detalle.gasto_id)
      
      if (!detallesError && todosLosDetalles) {
        // Verificar si todos los detalles de todas las cuotas están completamente pagados
        const todosCompletamentePagados = todosLosDetalles.every(d => {
          const totalPagado = d.pagos?.reduce((sum: number, p: any) => sum + p.monto, 0) || 0
          return totalPagado >= d.monto
        })

        // Solo generar el gasto recurrente si TODO el gasto (100%) está pagado
        if (todosCompletamentePagados) {
          try {
            // Usar el usuario_id del gasto original (creador) para generar el recurrente
            await gastosService.generarGastoRecurrente(detalle.gasto_id, detalle.gasto.usuario_id)
          } catch (recurrenteError) {
            console.error('Error generando gasto recurrente:', recurrenteError)
            // No lanzamos el error para no afectar el pago principal
          }
        }
      }
    }
    
    return data as Pago
  },

  // Eliminar pago
  async eliminarPago(pagoId: string, userId: string) {
    // Obtener información del pago y gasto_detalle antes de eliminar
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .select(`
        *,
        gasto_detalle:gastos_detalle(
          id,
          monto,
          pagado
        )
      `)
      .eq('id', pagoId)
      .single()
    
    if (pagoError || !pago || !pago.gasto_detalle) {
      throw new Error('Pago no encontrado')
    }
    
    const gastoDetalleId = pago.gasto_detalle.id
    const montoDetalle = pago.gasto_detalle.monto
    
    // Eliminar el pago
    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('id', pagoId)
    
    if (error) throw error
    
    // Recalcular el estado pagado del gasto_detalle
    // Obtener todos los pagos restantes para este detalle
    const { data: pagosRestantes, error: pagosError } = await supabase
      .from('pagos')
      .select('monto')
      .eq('gasto_detalle_id', gastoDetalleId)
    
    if (pagosError) {
      console.error('Error al obtener pagos restantes:', pagosError)
      return // No lanzamos error para no afectar la eliminación del pago
    }
    
    // Calcular el total pagado restante
    const totalPagadoRestante = pagosRestantes?.reduce((sum, p) => sum + p.monto, 0) || 0
    
    // Determinar si el detalle debe seguir marcado como pagado
    const debeSeguirPagado = totalPagadoRestante >= montoDetalle
    
    // Actualizar el estado pagado del gasto_detalle
    const { error: updateError } = await supabase
      .from('gastos_detalle')
      .update({ pagado: debeSeguirPagado })
      .eq('id', gastoDetalleId)
    
    if (updateError) {
      console.error('Error al actualizar estado pagado:', updateError)
      // No lanzamos error para no afectar la eliminación del pago
    }
  }
}

export const solicitudesPagoService = {
  // Crear una nueva solicitud de pago
  async crearSolicitudPago(solicitud: SolicitudPagoCreate, userId: string) {
    try {
      const { data, error } = await supabase
        .rpc('crear_solicitud_pago', {
          gasto_detalle_id_param: solicitud.gasto_detalle_id,
          usuario_creador_id_param: solicitud.usuario_creador_id,
          monto_param: solicitud.monto,
          notas_param: solicitud.notas || null
        })

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Error al crear solicitud de pago:', error)
      throw error
    }
  },

  // Obtener solicitudes de pago recibidas (para el creador del gasto)
  async obtenerSolicitudesRecibidas(userId: string) {
    try {
      const { data, error } = await supabase
        .rpc('obtener_solicitudes_recibidas', {
          usuario_creador_id_param: userId
        })

      if (error) throw error
      return data || []
    } catch (error: any) {
      console.error('Error al obtener solicitudes recibidas:', error)
      throw error
    }
  },

  // Obtener solicitudes de pago enviadas (para el participante)
  async obtenerSolicitudesEnviadas(userId: string) {
    try {
      const { data, error } = await supabase
        .rpc('obtener_solicitudes_enviadas', {
          usuario_solicitante_id_param: userId
        })

      if (error) throw error
      return data || []
    } catch (error: any) {
      console.error('Error al obtener solicitudes enviadas:', error)
      throw error
    }
  },

  // Aceptar una solicitud de pago
  async aceptarSolicitud(solicitudId: string, usuarioCreadorId: string) {
    try {
      console.log('Aceptar solicitud:', solicitudId, usuarioCreadorId)

      const { data, error } = await supabase.rpc('aceptar_solicitud_pago', {
          solicitud_id_param: solicitudId,
          usuario_creador_id_param: usuarioCreadorId
        })

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Error al aceptar solivvcitud:', error)
      throw error
    }
  },

  // Rechazar una solicitud de pago
  async rechazarSolicitud(solicitudId: string, usuarioCreadorId: string) {
    try {
      const { data, error } = await supabase
        .rpc('rechazar_solicitud_pago', {
          solicitud_id_param: solicitudId,
          usuario_creador_id_param: usuarioCreadorId
        })

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Error al rechazar solicitud:', error)
      throw error
    }
  }
}

// Servicios de IOU (ya no se usan con el esquema simplificado)
// export const iouService = { ... }

// Interface para datos de resumen mensual
export interface DatosResumenMensual {
  gastos_fijos: number
  gastos_variables: number
  total_gastos: number
  por_pagar: number
  me_adeudan: number
  cantidad_gastos_fijos: number
  cantidad_gastos_variables: number
  cantidad_detalles_por_pagar: number
  cantidad_detalles_adeudados: number
}

export const resumenService = {
  // Obtener datos unificados para el resumen mensual
  async obtenerDatosResumenMensual(userId: string, mes?: number, año?: number): Promise<DatosResumenMensual> {
    try {
      console.log(`[DEBUG] Obteniendo datos de resumen para userId: ${userId}, mes: ${mes}, año: ${año}`);
      
      const { data, error } = await supabase
        .rpc('obtener_datos_resumen_mensual', {
          p_usuario_id: userId,
          p_mes: mes || null,
          p_año: año || null
        })
      
      if (error) {
        console.error('Error al obtener datos de resumen:', error);
        throw error;
      }
      
      // La función RPC devuelve un array con un solo elemento
      const resultado = data?.[0] || {
        gastos_fijos: 0,
        gastos_variables: 0,
        total_gastos: 0,
        por_pagar: 0,
        me_adeudan: 0,
        cantidad_gastos_fijos: 0,
        cantidad_gastos_variables: 0,
        cantidad_detalles_por_pagar: 0,
        cantidad_detalles_adeudados: 0
      };
      
      console.log('[DEBUG] Datos de resumen obtenidos:', resultado);
      return resultado as DatosResumenMensual;
    } catch (error) {
      console.error('Error en obtenerDatosResumenMensual:', error);
      throw error;
    }
  }
}