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
import Toast from 'react-native-toast-message'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return null
  }

  if (!session) {
    return (
      <PaperProvider>
        <StatusBar style="dark" />
        <LoginScreen />
        <Toast />
      </PaperProvider>
    )
  }

  return (
    <PaperProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="nuevo-gasto/index" />
      </Stack>
      <Toast />
    </PaperProvider>
  )
}