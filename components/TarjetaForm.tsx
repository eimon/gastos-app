// components/TarjetaForm.tsx - Formulario presentacional para crear/editar una tarjeta
import { View, StyleSheet } from 'react-native'
import { Button, HelperText, TextInput } from 'react-native-paper'

import type { ErrorTarjeta } from '../domain/tarjeta'

export interface ValoresTarjetaForm {
  nombre: string
  diaCierre: string
  diaVencimiento: string
}

interface Props {
  valores: ValoresTarjetaForm
  errores: ErrorTarjeta[]
  guardando: boolean
  textoBoton: string
  onCambiar: (campo: keyof ValoresTarjetaForm, valor: string) => void
  onGuardar: () => void
}

export default function TarjetaForm({
  valores,
  errores,
  guardando,
  textoBoton,
  onCambiar,
  onGuardar,
}: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        label="Nombre"
        value={valores.nombre}
        onChangeText={(texto) => onCambiar('nombre', texto)}
        mode="outlined"
        style={styles.input}
      />
      <HelperText type="error" visible={errores.includes('NOMBRE_REQUERIDO')}>
        El nombre es obligatorio.
      </HelperText>

      <TextInput
        label="Día de cierre (1-31)"
        value={valores.diaCierre}
        onChangeText={(texto) => onCambiar('diaCierre', texto)}
        mode="outlined"
        keyboardType="number-pad"
        style={styles.input}
      />
      <HelperText type="error" visible={errores.includes('DIA_CIERRE_INVALIDO')}>
        Ingresá un día entre 1 y 31.
      </HelperText>

      <TextInput
        label="Día de vencimiento (1-31)"
        value={valores.diaVencimiento}
        onChangeText={(texto) => onCambiar('diaVencimiento', texto)}
        mode="outlined"
        keyboardType="number-pad"
        style={styles.input}
      />
      <HelperText type="error" visible={errores.includes('DIA_VENCIMIENTO_INVALIDO')}>
        Ingresá un día entre 1 y 31.
      </HelperText>

      <Button mode="contained" onPress={onGuardar} loading={guardando} disabled={guardando} style={styles.boton}>
        {textoBoton}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  input: {
    marginBottom: 4,
  },
  boton: {
    marginTop: 16,
  },
})
