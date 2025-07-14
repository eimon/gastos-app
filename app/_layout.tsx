// app/_layout.tsx - Layout principal
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Provider as PaperProvider } from 'react-native-paper'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import LoginScreen from '../components/LoginScreen'
import UserProfileSetup from '../components/UserProfileSetup'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileComplete, setProfileComplete] = useState(false)

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
      </PaperProvider>
    )
  }

  return (
    <PaperProvider>
      <StatusBar style="dark" />
      {!profileComplete && (
        <UserProfileSetup 
          user={session.user} 
          onProfileComplete={() => setProfileComplete(true)} 
        />
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </PaperProvider>
  )
}