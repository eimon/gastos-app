// app/(tabs)/_layout.tsx - Layout de las tabs
import React, { useState } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, StyleSheet } from 'react-native'
import { showAlert, showConfirm } from '../../lib/alerts'
import { Menu, IconButton, Provider } from 'react-native-paper'
import { supabase } from '../../lib/supabase'

function HeaderMenu() {
  const [visible, setVisible] = useState(false)

  const openMenu = () => setVisible(true)
  const closeMenu = () => setVisible(false)

  const handleLogout = async () => {
    closeMenu()
    showConfirm(
      'Cerrar sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      async () => {
        await supabase.auth.signOut()
      }
    )
  }

  return (
    <View style={styles.headerContainer}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={
          <IconButton
            icon="menu"
            size={24}
            iconColor="#1e293b"
            onPress={openMenu}
            style={styles.menuButton}
          />
        }
        contentStyle={styles.menuContent}
      >
        <Menu.Item
          onPress={handleLogout}
          title="Cerrar Sesión"
          leadingIcon="logout"
          titleStyle={styles.menuItemText}
        />
      </Menu>
    </View>
  )
}

export default function TabLayout() {
  return (
    <Provider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#2196F3',
          tabBarInactiveTintColor: 'gray',
          headerStyle: {
            backgroundColor: 'rgba(248, 250, 252, 0.95)',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 0, 0, 0.1)',
          },
          headerTitleStyle: {
            color: '#1e293b',
            fontWeight: '700',
            fontSize: 20,
          },
          headerRight: () => <HeaderMenu />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            href: null, // Ocultar esta tab del navegador
          }}
        />
        <Tabs.Screen
          name="gastos"
          options={{
            title: 'Gastos',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'wallet' : 'wallet-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="participantes"
          options={{
            title: 'Participantes',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'people' : 'people-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="pagos"
          options={{
            title: 'Pagos',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'card' : 'card-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="resumen"
          options={{
            title: 'Resumen',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'analytics' : 'analytics-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
      </Tabs>
    </Provider>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    marginRight: 8,
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItemText: {
    color: '#dc2626',
    fontWeight: '600',
  },
})