// components/GastoForm.tsx - Formulario compartido de alta y edición de un gasto, con vista previa de cuotas
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Appbar, Button, Chip, HelperText, List, SegmentedButtons, Text, TextInput } from 'react-native-paper'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { router } from 'expo-router'

import { CampoMonto } from './CampoMonto'
import { ParticipantesForm } from './ParticipantesForm'
import { useAlturaTeclado } from '../hooks/useAlturaTeclado'
import { useServicio } from '../hooks/useServicio'
import * as tarjetasService from '../services/tarjetasService'
import {
  MENSAJES_ERROR_GASTO,
  erroresVisibles,
  esRepartoPersonalizado,
  evaluarFormulario,
  montosPersonalizadosCents,
  type ValoresGastoForm,
} from '../services/gastoFormulario'
import { formatearFecha, formatearMonto } from '../services/gastoVista'
import { aFechaISOLocal, deFechaISOLocal } from '../services/fechaLocal'
import { sumarMontos } from '../domain/participantes'
import type { GastoConDetalle } from '../data/repositories/gastosRepo'
import type { Tarjeta } from '../data/repositories/tarjetasRepo'
import { conservarVencimientos, MENSAJES_ERROR_GASTO_GUARDADO } from '../services/gastoEdicion'
import { showAlert } from '../lib/alerts'

const TIPOS = [
  { value: 'personal', label: 'Personal' },
  { value: 'compartido', label: 'Compartido' },
]
const TIPOS_DESCUENTO = [
  { value: 'uniforme', label: 'Uniforme' },
  { value: 'prorrateo', label: 'Prorrateo' },
]

const MODOS_REPARTO = [
  { value: 'iguales', label: 'Partes iguales' },
  { value: 'personalizado', label: 'Montos personalizados' },
]

interface Props {
  titulo: string
  textoGuardar: string
  valoresIniciales: ValoresGastoForm
  /** Persists the form; a rejection is shown to the user as an alert. */
  onGuardar: (valores: ValoresGastoForm) => Promise<void>
  /** Edit with payments: only the description can change, the rest is shown disabled. */
  soloDescripcion?: boolean
  /** Stored gasto when editing: its due dates are kept unless the date, cuotas or card change. */
  original?: GastoConDetalle
  /** The card already linked to the gasto, offered even when archived. */
  tarjetaVinculada?: Tarjeta
}

/** Dims and blocks touches for everything the edit rules lock. */
function Bloqueable({ bloqueado, children }: { bloqueado: boolean; children: ReactNode }) {
  return (
    <View
      pointerEvents={bloqueado ? 'none' : 'auto'}
      importantForAccessibility={bloqueado ? 'no-hide-descendants' : 'auto'}
      style={bloqueado ? styles.bloqueado : undefined}
    >
      {children}
    </View>
  )
}

export function GastoForm({ titulo, textoGuardar, valoresIniciales, onGuardar, soloDescripcion = false, original, tarjetaVinculada }: Props) {
  const { datos: tarjetas } = useServicio(tarjetasService.listar)
  const alturaTeclado = useAlturaTeclado()
  const [valores, setValores] = useState<ValoresGastoForm>(valoresIniciales)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // A ref, not just state: two taps in the same frame both see guardando=false.
  const guardandoRef = useRef(false)

  function cambiar<K extends keyof ValoresGastoForm>(campo: K, valor: ValoresGastoForm[K]) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
  }

  const tarjetasActivas = tarjetas ?? []
  // A card already linked to this gasto stays selectable even when archived.
  const tarjetasDisponibles =
    tarjetaVinculada && !tarjetasActivas.some((t) => t.id === tarjetaVinculada.id)
      ? [...tarjetasActivas, tarjetaVinculada]
      : tarjetasActivas
  const evaluacion = evaluarFormulario(valores, tarjetasDisponibles)
  const { partes } = evaluacion
  // Locked edits only validate the description; the other fields are never saved.
  const errores = soloDescripcion ? evaluacion.errores.filter((e) => e === 'DESCRIPCION_REQUERIDA') : evaluacion.errores
  const plan = soloDescripcion
    ? null
    : original && evaluacion.plan
      ? conservarVencimientos(evaluacion.plan, original, {
          fechaCompra: valores.fechaCompra,
          cuotas: Number(valores.cuotas),
          tarjetaId: valores.tarjetaId,
        })
      : evaluacion.plan
  const erroresAMostrar = erroresVisibles(errores, valores, intentoGuardar)
  const hayDescuento = (valores.descuento ?? 0) > 0
  const cuotasNumero = Number(valores.cuotas)
  // Discount only exists with more than 1 cuota; custom amounts only with exactly 1 (shared).
  const permiteDescuento = Number.isInteger(cuotasNumero) && cuotasNumero > 1
  const permitePersonalizado = valores.tipo === 'compartido' && cuotasNumero === 1
  const personalizado = esRepartoPersonalizado(valores)

  // Imperative Android dialog: it opens once per press, so a re-render can't re-open it.
  function abrirSelectorFecha() {
    DateTimePickerAndroid.open({
      value: deFechaISOLocal(valores.fechaCompra),
      mode: 'date',
      // Only fires when a date is picked; dismissing the dialog keeps the current value.
      onValueChange: (_evento, fecha) => {
        cambiar('fechaCompra', aFechaISOLocal(fecha))
      },
    })
  }

  async function guardar() {
    if (guardandoRef.current) return
    setIntentoGuardar(true)
    if (errores.length > 0) return

    guardandoRef.current = true
    setGuardando(true)
    try {
      await onGuardar(valores)
      router.back()
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo guardar el gasto')
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  return (
    // Bottom padding of the keyboard height shrinks the ScrollView so the focused field scrolls into view.
    <View style={[styles.container, { paddingBottom: alturaTeclado }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={router.back} />
        <Appbar.Content title={titulo} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {soloDescripcion && (
          <HelperText type="info" visible>
            {MENSAJES_ERROR_GASTO_GUARDADO.BLOQUEADO_POR_PAGO}
          </HelperText>
        )}
        <Bloqueable bloqueado={soloDescripcion}>
          <SegmentedButtons value={valores.tipo} onValueChange={(v) => cambiar('tipo', v as ValoresGastoForm['tipo'])} buttons={TIPOS} />
        </Bloqueable>

        <TextInput
          label="Descripción"
          value={valores.descripcion}
          onChangeText={(texto) => cambiar('descripcion', texto)}
          mode="outlined"
          style={styles.campo}
        />
        <Bloqueable bloqueado={soloDescripcion}>
          {personalizado ? (
            <Text variant="titleMedium" style={styles.campo}>
              Total: {formatearMonto(sumarMontos(montosPersonalizadosCents(valores)))}
            </Text>
          ) : (
            <CampoMonto label="Monto total" valor={valores.monto} onCambiar={(v) => cambiar('monto', v)} />
          )}

          <Button icon="calendar" mode="outlined" onPress={abrirSelectorFecha} style={styles.campo}>
            {`Fecha de compra: ${formatearFecha(valores.fechaCompra)}`}
          </Button>

          {permitePersonalizado && (
            <SegmentedButtons
              value={valores.modoReparto}
              onValueChange={(v) => cambiar('modoReparto', v as ValoresGastoForm['modoReparto'])}
              buttons={MODOS_REPARTO}
              style={styles.campo}
            />
          )}

          {valores.tipo === 'compartido' && (
            <ParticipantesForm
              filas={valores.participantes}
              personalizado={personalizado}
              montoUsuario={valores.montoUsuario}
              onCambiarFilas={(filas) => cambiar('participantes', filas)}
              onCambiarMontoUsuario={(monto) => cambiar('montoUsuario', monto)}
            />
          )}

          {permiteDescuento && (
            <CampoMonto label="Descuento (opcional)" valor={valores.descuento} onCambiar={(v) => cambiar('descuento', v)} />
          )}
          {permiteDescuento && hayDescuento && (
            <SegmentedButtons
              value={valores.tipoDescuento}
              onValueChange={(v) => cambiar('tipoDescuento', v as ValoresGastoForm['tipoDescuento'])}
              buttons={TIPOS_DESCUENTO}
              style={styles.campo}
            />
          )}

          <TextInput
            label="Cuotas"
            value={valores.cuotas}
            onChangeText={(texto) => cambiar('cuotas', texto)}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.campo}
          />

          <Text variant="labelLarge" style={styles.campo}>
            Tarjeta
          </Text>
          <View style={styles.tarjetas}>
            <Chip selected={valores.tarjetaId === null} onPress={() => cambiar('tarjetaId', null)}>
              Sin tarjeta
            </Chip>
            {tarjetasDisponibles.map((tarjeta) => (
              <Chip
                key={tarjeta.id}
                icon="credit-card-outline"
                selected={valores.tarjetaId === tarjeta.id}
                onPress={() => cambiar('tarjetaId', tarjeta.id)}
              >
                {tarjeta.deletedAt ? `${tarjeta.nombre} (archivada)` : tarjeta.nombre}
              </Chip>
            ))}
          </View>
          {tarjetasDisponibles.length === 0 && (
            <Button icon="plus" onPress={() => router.push('/tarjetas/nueva')}>
              No hay tarjetas activas: crear una
            </Button>
          )}

        </Bloqueable>

        {erroresAMostrar.map((error) => (
          <HelperText key={error} type="error" visible>
            {MENSAJES_ERROR_GASTO[error]}
          </HelperText>
        ))}

        {partes && !soloDescripcion && (
          <List.Section title="Parte de cada persona">
            {partes.map((parte) => (
              <List.Item key={parte.nombre} title={parte.nombre} description={formatearMonto(parte.montoCents)} />
            ))}
          </List.Section>
        )}

        {plan && (
          <List.Section title="Vista previa de cuotas">
            {plan.cuotas.map((cuota) => (
              <List.Item
                key={cuota.numero}
                title={`Cuota ${cuota.numero} de ${plan.cuotas.length} · ${formatearMonto(cuota.montoCents)}`}
                description={`Vence el ${formatearFecha(cuota.fechaVencimiento)}`}
              />
            ))}
          </List.Section>
        )}

        <Button mode="contained" onPress={guardar} loading={guardando} disabled={guardando} style={styles.boton}>
          {textoGuardar}
        </Button>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 16,
    paddingBottom: 48,
  },
  campo: {
    marginTop: 12,
  },
  tarjetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloqueado: {
    opacity: 0.5,
  },
  boton: {
    marginTop: 16,
  },
})
