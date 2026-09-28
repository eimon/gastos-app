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

  if (!session) {
    return (
      <PaperProvider>
        <StatusBar style="dark" />
        <DatabaseProvider>
          <LoginScreen />
        </DatabaseProvider>
      </PaperProvider>
    )
  }

  return (
    <PaperProvider>
      <MonthProvider>
        <StatusBar style="dark" />
        <DatabaseProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="nuevo-gasto/index" />
          </Stack>
        </DatabaseProvider>
      </MonthProvider>
    </PaperProvider>
  )
}