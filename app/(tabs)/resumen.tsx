// app/(tabs)/resumen.tsx - Marcador de posición hasta que el resumen mensual esté disponible
import { View, StyleSheet } from 'react-native'
import { Appbar, Text } from 'react-native-paper'

export default function ResumenScreen() {
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Resumen" />
      </Appbar.Header>
      <View style={styles.centro}>
        <Text variant="titleMedium">Próximamente</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
