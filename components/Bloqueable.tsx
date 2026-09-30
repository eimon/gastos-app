// components/Bloqueable.tsx - Atenúa y bloquea los toques de lo que las reglas de edición no permiten cambiar
import type { ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'

export function Bloqueable({ bloqueado, children }: { bloqueado: boolean; children: ReactNode }) {
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

const styles = StyleSheet.create({
  bloqueado: {
    opacity: 0.5,
  },
})
