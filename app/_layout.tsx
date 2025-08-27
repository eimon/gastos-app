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
import * as Linking from 'expo-linking'
import { handleAuthDeepLink } from '../lib/auth'

import { MonthProvider } from '../contexts/MonthContext'

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

    // Manejar deep links para OAuth
    const handleDeepLink = (event: { url: string }) => {
      handleAuthDeepLink(event.url)
    }

    // Escuchar deep links
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink)

    // Verificar si la app se abrió con un deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleAuthDeepLink(url)
      }
    })

    return () => {
      subscription.unsubscribe()
      linkingSubscription?.remove()
    }
  }, [])

  if (loading) {
    return null
  }

  if (!session) {
    return (
      <PaperProvider>
        <StatusBar style="dark" />
        <LoginScreen />
      </PaperProvider>
    )
  }

  return (
    <PaperProvider>
      <MonthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="nuevo-gasto/index" />
        </Stack>
      </MonthProvider>
    </PaperProvider>
  )
}