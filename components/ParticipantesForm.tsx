// components/ParticipantesForm.tsx - Filas de participantes (una por persona), con monto propio en modo personalizado
import { View, StyleSheet } from 'react-native'
import { Button, IconButton, Text, TextInput } from 'react-native-paper'

import { CampoMonto } from './CampoMonto'
import { NOMBRE_USUARIO } from '../domain/participantes'
import { siguienteIdFila, type FilaParticipante } from '../services/gastoFormulario'

interface Props {
  filas: FilaParticipante[]
  personalizado: boolean
  montoUsuario: number | null
  onCambiarFilas: (filas: FilaParticipante[]) => void
  onCambiarMontoUsuario: (monto: number | null) => void
}

export function ParticipantesForm({ filas, personalizado, montoUsuario, onCambiarFilas, onCambiarMontoUsuario }: Props) {
  function agregar() {
    onCambiarFilas([...filas, { id: siguienteIdFila(filas), nombre: '', monto: null }])
  }

  function actualizar(id: string, cambios: Partial<FilaParticipante>) {
    onCambiarFilas(filas.map((fila) => (fila.id === id ? { ...fila, ...cambios } : fila)))
  }

  return (
    <View style={styles.contenedor}>
      <Text variant="labelLarge">Participantes</Text>
      {filas.map((fila) => (
        <View key={fila.id} style={styles.fila}>
          <View style={styles.campos}>
            <TextInput
              label="Nombre"
              value={fila.nombre}
              onChangeText={(nombre) => actualizar(fila.id, { nombre })}
              mode="outlined"
              dense
            />
            {personalizado && (
              <CampoMonto label="Monto" valor={fila.monto} onCambiar={(monto) => actualizar(fila.id, { monto })} />
            )}
          </View>
          <IconButton
            icon="close"
            accessibilityLabel="Quitar participante"
            onPress={() => onCambiarFilas(filas.filter((otra) => otra.id !== fila.id))}
          />
        </View>
      ))}

      <View style={styles.fila}>
        <View style={styles.campos}>
          <TextInput label="Nombre" value={NOMBRE_USUARIO} mode="outlined" dense disabled />
          {personalizado && <CampoMonto label="Monto (parte propia)" valor={montoUsuario} onCambiar={onCambiarMontoUsuario} />}
        </View>
        <View style={styles.espacio} />
      </View>

      <Button icon="account-plus" onPress={agregar}>
        Agregar participante
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: {
    marginTop: 12,
    gap: 8,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  campos: {
    flex: 1,
    gap: 8,
  },
  espacio: {
    width: 48,
  },
})
