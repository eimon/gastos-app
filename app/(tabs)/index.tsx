// app/(tabs)/index.tsx - Pantalla principal que redirige a gastos
import { useEffect } from 'react'
import { router } from 'expo-router'

export default function IndexScreen() {
  useEffect(() => {
    // Redirigir automáticamente a la pantalla de gastos
    router.replace('/gastos')
  }, [])

  return null
}