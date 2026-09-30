// app/(tabs)/index.tsx - Pantalla principal que redirige a gastos
import { Redirect } from 'expo-router'

export default function IndexScreen() {
  return <Redirect href="/gastos" />
}
