// app/(tabs)/_layout.tsx - Layout de las tabs (cada pantalla trae su propia barra superior)
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Gastos',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="deudas"
        options={{
          title: 'Deudas',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'cash' : 'cash-outline'} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="resumen"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'analytics' : 'analytics-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
