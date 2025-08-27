// app/(tabs)/_layout.tsx - Layout de las tabs
import React, { useState, useEffect } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { showAlert, showConfirm } from '../../lib/alerts'
import { Menu, IconButton, Provider } from 'react-native-paper'
import { supabase } from '../../lib/supabase'

function HeaderMenu() {
  const [visible, setVisible] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)

  const openMenu = () => setVisible(true)
  const closeMenu = () => setVisible(false)

  useEffect(() => {
    const getUserAvatar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.user_metadata?.picture) {
          setUserAvatar(user.user_metadata.picture)
        }
      } catch (error) {
        // Si hay error, no mostrar avatar
      }
    }

    getUserAvatar()
  }, [])

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
          userAvatar ? (
            <TouchableOpacity onPress={openMenu} style={styles.avatarButton}>
              <Image 
                source={{ uri: userAvatar }} 
                style={styles.avatar}
                defaultSource={require('../../assets/icon.png')}
              />
            </TouchableOpacity>
          ) : (
            <IconButton
              icon="menu"
              size={24}
              iconColor="#1e293b"
              onPress={openMenu}
              style={styles.menuButton}
            />
          )
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
  avatarButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
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