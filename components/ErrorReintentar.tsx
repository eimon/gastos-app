// components/ErrorReintentar.tsx - Estado de error con opción de reintentar
import { View, StyleSheet } from 'react-native'
import { Button, Text } from 'react-native-paper'

interface Props {
  mensaje: string
  onReintentar: () => void
}

export function ErrorReintentar({ mensaje, onReintentar }: Props) {
  return (
    <View style={styles.centro}>
      <Text>{mensaje}</Text>
      <Button icon="reload" onPress={onReintentar}>
        Reintentar
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
})
