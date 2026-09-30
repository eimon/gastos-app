// components/TarjetaForm.tsx - Formulario presentacional para crear/editar una tarjeta
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, HelperText, TextInput } from 'react-native-paper'

import type { ErrorTarjeta } from '../domain/tarjeta'
import { useAlturaTeclado } from '../hooks/useAlturaTeclado'

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
  const alturaTeclado = useAlturaTeclado()

  // Bottom padding of the keyboard height shrinks the ScrollView so every field and the button stay reachable.
  return (
    <View style={[styles.raiz, { paddingBottom: alturaTeclado }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
          Debe ser un día entre 1 y 31.
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
          Debe ser un día entre 1 y 31.
        </HelperText>

        <Button mode="contained" onPress={onGuardar} loading={guardando} disabled={guardando} style={styles.boton}>
          {textoBoton}
        </Button>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
  },
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
