// app/_layout.tsx - Layout principal
import { useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Provider as PaperProvider } from 'react-native-paper'

import { MonthProvider } from '../contexts/MonthContext'
import { DatabaseProvider } from '../data/db/DatabaseProvider'

export default function RootLayout() {
  // Bumped by DatabaseProvider's "Reintentar" action to force a fresh mount
  // (and therefore a fresh useMigrations attempt) after a migration error.
  const [intentoDb, setIntentoDb] = useState(0)

  return (
    <PaperProvider>
      <StatusBar style="dark" />
      <DatabaseProvider key={intentoDb} onReintentar={() => setIntentoDb((intento) => intento + 1)}>
        <MonthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </MonthProvider>
      </DatabaseProvider>
    </PaperProvider>
  )
}
