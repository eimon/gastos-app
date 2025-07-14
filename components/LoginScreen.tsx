// components/LoginScreen.tsx - Pantalla de login
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
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
  Divider,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { showAlert } from '../lib/alerts'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')

  const handleAuth = async () => {
    if (!email || !password) {
      showAlert('Error', 'Por favor completa todos los campos')
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        // Registro
        if (!firstName || !lastName || !username) {
          showAlert('Error', 'Por favor completa todos los campos')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              username: username,
            }
          }
        })

        if (error) throw error

        if (data.user && !data.session) {
          showAlert(
            'Registro exitoso',
            'Por favor verifica tu email antes de iniciar sesión'
          )
        }
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
      }
    } catch (error: any) {
      showAlert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      })
      if (error) throw error
    } catch (error: any) {
      showAlert('Error', error.message)
    }
  }

  const resetPassword = async () => {
    if (!email) {
      showAlert('Error', 'Por favor ingresa tu email')
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      showAlert(
        'Email enviado',
        'Revisa tu email para restablecer tu contraseña'
      )
    } catch (error: any) {
      showAlert('Error', error.message)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="wallet" size={64} color="#2196F3" />
          </View>
          <Title style={styles.title}>Gastos App</Title>
          <Paragraph style={styles.subtitle}>
            Gestiona tus gastos personales y compartidos
          </Paragraph>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </Title>

            {isSignUp && (
              <>
                <TextInput
                  label="Nombre"
                  value={firstName}
                  onChangeText={setFirstName}
                  style={styles.input}
                  mode="outlined"
                  left={<TextInput.Icon icon="account" />}
                />
                <TextInput
                  label="Apellido"
                  value={lastName}
                  onChangeText={setLastName}
                  style={styles.input}
                  mode="outlined"
                  left={<TextInput.Icon icon="account" />}
                />
                <TextInput
                  label="Nombre de usuario"
                  value={username}
                  onChangeText={setUsername}
                  style={styles.input}
                  mode="outlined"
                  left={<TextInput.Icon icon="at" />}
                  autoCapitalize="none"
                />
              </>
            )}

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email" />}
            />

            <TextInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              mode="outlined"
              secureTextEntry
              left={<TextInput.Icon icon="lock" />}
            />

            <Button
              mode="contained"
              onPress={handleAuth}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </Button>

            {!isSignUp && (
              <Button
                mode="text"
                onPress={resetPassword}
                style={styles.textButton}
              >
                ¿Olvidaste tu contraseña?
              </Button>
            )}

            <Divider style={styles.divider} />

            <Button
              mode="outlined"
              onPress={handleGoogleAuth}
              style={styles.button}
              contentStyle={styles.buttonContent}
              icon="google"
            >
              Continuar con Google
            </Button>

            <Button
              mode="text"
              onPress={() => setIsSignUp(!isSignUp)}
              style={styles.textButton}
            >
              {isSignUp
                ? '¿Ya tienes cuenta? Inicia sesión'
                : '¿No tienes cuenta? Regístrate'}
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Al continuar, aceptas nuestros términos y condiciones
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
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
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginVertical: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  textButton: {
    marginVertical: 4,
  },
  divider: {
    marginVertical: 16,
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