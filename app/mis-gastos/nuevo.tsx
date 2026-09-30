// app/mis-gastos/nuevo.tsx - Alta de un gasto (personal o compartido) con vista previa de cuotas
import { useRef, useState, type ComponentProps } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Appbar, Button, Chip, HelperText, List, SegmentedButtons, Text, TextInput } from 'react-native-paper'
import CurrencyInput from 'react-native-currency-input'
import { router } from 'expo-router'

import { useServicio } from '../../hooks/useServicio'
import * as gastosService from '../../services/gastosService'
import * as tarjetasService from '../../services/tarjetasService'
import {
  MENSAJES_ERROR_GASTO,
  construirInputCrear,
  erroresVisibles,
  evaluarFormulario,
  fechaHoyISO,
  type ValoresGastoForm,
} from '../../services/gastoFormulario'
import { formatearFecha, formatearMonto } from '../../services/gastoVista'
import { showAlert } from '../../lib/alerts'

const TIPOS = [
  { value: 'personal', label: 'Personal' },
  { value: 'compartido', label: 'Compartido' },
]
const TIPOS_DESCUENTO = [
  { value: 'uniforme', label: 'Uniforme' },
  { value: 'prorrateo', label: 'Prorrateo' },
]

function CampoMonto(props: { label: string; valor: number | null; onCambiar: (valor: number | null) => void }) {
  return (
    <CurrencyInput
      value={props.valor}
      onChangeValue={props.onCambiar}
      prefix="$ "
      delimiter="."
      separator=","
      precision={2}
      minValue={0}
      renderTextInput={(textInputProps) => (
        // The lib types selectionColor as ColorValue; Paper's TextInput wants a string.
        <TextInput {...(textInputProps as ComponentProps<typeof TextInput>)} label={props.label} mode="outlined" keyboardType="numeric" />
      )}
    />
  )
}

export default function NuevoGastoScreen() {
  const { datos: tarjetas } = useServicio(tarjetasService.listar)
  const [valores, setValores] = useState<ValoresGastoForm>(() => ({
    descripcion: '',
    fechaCompra: fechaHoyISO(),
    monto: null,
    descuento: null,
    tipo: 'personal',
    tipoDescuento: 'uniforme',
    cuotas: '1',
    tarjetaId: null,
    participantes: '',
  }))
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // A ref, not just state: two taps in the same frame both see guardando=false.
  const guardandoRef = useRef(false)

  function cambiar<K extends keyof ValoresGastoForm>(campo: K, valor: ValoresGastoForm[K]) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
  }

  const tarjetasActivas = tarjetas ?? []
  const { errores, plan } = evaluarFormulario(valores, tarjetasActivas)
  const erroresAMostrar = erroresVisibles(errores, valores, intentoGuardar)
  const hayDescuento = (valores.descuento ?? 0) > 0

  async function guardar() {
    if (guardandoRef.current) return
    setIntentoGuardar(true)
    if (errores.length > 0) return

    guardandoRef.current = true
    setGuardando(true)
    try {
      await gastosService.crear(construirInputCrear(valores))
      router.back()
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo guardar el gasto')
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={router.back} />
        <Appbar.Content title="Nuevo gasto" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <SegmentedButtons value={valores.tipo} onValueChange={(v) => cambiar('tipo', v as ValoresGastoForm['tipo'])} buttons={TIPOS} />

        <TextInput
          label="Descripción"
          value={valores.descripcion}
          onChangeText={(texto) => cambiar('descripcion', texto)}
          mode="outlined"
          style={styles.campo}
        />
        <CampoMonto label="Monto total" valor={valores.monto} onCambiar={(v) => cambiar('monto', v)} />
        <TextInput
          label="Fecha de compra (AAAA-MM-DD)"
          value={valores.fechaCompra}
          onChangeText={(texto) => cambiar('fechaCompra', texto)}
          mode="outlined"
          style={styles.campo}
        />

        {valores.tipo === 'compartido' && (
          <TextInput
            label="Participantes (separados por coma)"
            value={valores.participantes}
            onChangeText={(texto) => cambiar('participantes', texto)}
            mode="outlined"
            style={styles.campo}
          />
        )}

        <CampoMonto label="Descuento (opcional)" valor={valores.descuento} onCambiar={(v) => cambiar('descuento', v)} />
        {hayDescuento && (
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
          {tarjetasActivas.map((tarjeta) => (
            <Chip
              key={tarjeta.id}
              icon="credit-card-outline"
              selected={valores.tarjetaId === tarjeta.id}
              onPress={() => cambiar('tarjetaId', tarjeta.id)}
            >
              {tarjeta.nombre}
            </Chip>
          ))}
        </View>
        {tarjetasActivas.length === 0 && (
          <Button icon="plus" onPress={() => router.push('/tarjetas/nueva')}>
            No hay tarjetas activas: crear una
          </Button>
        )}

        {erroresAMostrar.map((error) => (
          <HelperText key={error} type="error" visible>
            {MENSAJES_ERROR_GASTO[error]}
          </HelperText>
        ))}

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
          Guardar gasto
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
  boton: {
    marginTop: 16,
  },
})
