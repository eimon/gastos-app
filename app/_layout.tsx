// app/_layout.tsx - Layout principal
// Importar polyfills antes que cualquier otra cosa
import '../lib/polyfills'

import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Provider as PaperProvider } from 'react-native-paper'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import LoginScreen from '../components/LoginScreen'

import { MonthProvider } from '../contexts/MonthContext'
import { DatabaseProvider } from '../data/db/DatabaseProvider'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Bumped by DatabaseProvider's "Reintentar" action to force a fresh mount
  // (and therefore a fresh useMigrations attempt) after a migration error.
  const [intentoDb, setIntentoDb] = useState(0)

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return null
  }

  // A SINGLE DatabaseProvider wraps both branches below, so switching
  // between the logged-out and logged-in tree (a real unmount/remount of
  // everything under it, since they're different `return`s) never
  // re-triggers `useMigrations` — migrations run exactly once per app
  // launch, not once per login-state change.
  return (
    <PaperProvider>
      <StatusBar style="dark" />
      <DatabaseProvider key={intentoDb} onReintentar={() => setIntentoDb((intento) => intento + 1)}>
        {!session ? (
          <LoginScreen />
        ) : (
          <MonthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="nuevo-gasto/index" />
            </Stack>
          </MonthProvider>
        )}
      </DatabaseProvider>
    </PaperProvider>
  )
}