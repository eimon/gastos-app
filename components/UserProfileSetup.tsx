// components/UserProfileSetup.tsx - Configuración inicial del perfil
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  Avatar,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { showAlert } from '../lib/alerts'

interface Props {
  user: User
  onProfileComplete: () => void
}

export default function UserProfileSetup({ user, onProfileComplete }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)

  useEffect(() => {
    checkExistingProfile()
  }, [])

  const checkExistingProfile = async () => {
    try {
      // Verificar si el usuario ya tiene un perfil completo
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data && data.username && data.first_name) {
        // El perfil ya está completo
        onProfileComplete()
        return
      }

      // Prellenar con datos del auth si están disponibles
      if (user.user_metadata) {
        setFirstName(user.user_metadata.first_name || '')
        setLastName(user.user_metadata.last_name || '')
        setUsername(user.user_metadata.username || '')
      }
    } catch (error) {
      console.error('Error verificando perfil:', error)
    } finally {
      setCheckingProfile(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      showAlert('Error', 'Por favor completa todos los campos')
      return
    }

    setLoading(true)
    try {
      // Verificar que el username no esté en uso
      const { data: existingUser } = await supabase
        .from('usuarios')
        .select('id')
        .eq('username', username.trim())
        .neq('id', user.id)
        .single()

      if (existingUser) {
        showAlert('Error', 'Este nombre de usuario ya está en uso')
        return
      }

      // Crear o actualizar el perfil del usuario
      const { error } = await supabase
        .from('usuarios')
        .upsert({
          id: user.id,
          email: user.email,
          username: username.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          is_active: true,
          is_verified: user.email_confirmed_at ? true : false,
          provider: user.app_metadata?.provider || null,
          provider_id: user.app_metadata?.provider_id || null,
          foto_url: user.user_metadata?.avatar_url || null,
        })

      if (error) throw error

      // Crear participante asociado al usuario
      await supabase
        .from('participantes')
        .upsert({
          email: user.email,
          nickname: username.trim(),
          usuario_id: user.id,
          es_registrado: true,
        })

      showAlert('Éxito', 'Perfil configurado correctamente')
      onProfileComplete()
    } catch (error: any) {
      console.error('Error guardando perfil:', error)
      showAlert('Error', error.message || 'No se pudo guardar el perfil')
    } finally {
      setLoading(false)
    }
  }

  const getInitials = () => {
    const first = firstName.charAt(0).toUpperCase()
    const last = lastName.charAt(0).toUpperCase()
    return first + last
  }

  if (checkingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass" size={48} color="#2196F3" />
        <Text style={styles.loadingText}>Verificando perfil...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Avatar.Text
            size={80}
            label={getInitials() || 'U'}
            style={styles.avatar}
          />
          <Title style={styles.title}>Completa tu Perfil</Title>
          <Paragraph style={styles.subtitle}>
            Para comenzar a usar la app, necesitamos algunos datos básicos
          </Paragraph>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Información Personal</Title>

            <TextInput
              label="Nombre *"
              value={firstName}
              onChangeText={setFirstName}
              style={styles.input}
              mode="outlined"
              left={<TextInput.Icon icon="account" />}
              placeholder="Tu nombre"
            />

            <TextInput
              label="Apellido *"
              value={lastName}
              onChangeText={setLastName}
              style={styles.input}
              mode="outlined"
              left={<TextInput.Icon icon="account" />}
              placeholder="Tu apellido"
            />

            <TextInput
              label="Nombre de usuario *"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              mode="outlined"
              left={<TextInput.Icon icon="at" />}
              placeholder="Como te identificarán otros usuarios"
              autoCapitalize="none"
              helperText="Este será tu identificador único en la app"
            />

            <View style={styles.infoContainer}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.infoText}>
                Tu email: {user.email}
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleSaveProfile}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Guardar y Continuar
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Podrás modificar esta información más tarde en tu perfil
          </Paragraph>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    backgroundColor: '#2196F3',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    elevation: 4,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  input: {
    marginBottom: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976D2',
    flex: 1,
  },
  button: {
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
})