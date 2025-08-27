// lib/auth.ts - Configuración de autenticación OAuth
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { makeRedirectUri } from 'expo-auth-session'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { supabase } from './supabase'
import { Platform } from 'react-native'

// Configurar WebBrowser para OAuth
WebBrowser.maybeCompleteAuthSession()

// Configurar Google Sign-In nativo
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID, // Client ID de tipo Web
    offlineAccess: true, // Para obtener refresh token
    hostedDomain: '', // Opcional: restringir a un dominio específico
    forceCodeForRefreshToken: true, // Para obtener refresh token en Android
  })
}

export const handleGoogleOAuth = async () => {
  try {
    // Crear URL de redirección
    const redirectUrl = makeRedirectUri({
      scheme: 'gastos-app',
      path: '/auth/callback'
    })

    console.log('Redirect URL:', redirectUrl)

    // Iniciar OAuth con Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Error en OAuth:', error)
      throw error
    }

    console.log('OAuth data:', data)

    // En plataformas móviles, abrir el navegador para OAuth
    if (Platform.OS !== 'web' && data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      )
      
      console.log('WebBrowser result:', result)
      
      if (result.type === 'success' && result.url) {
        // La sesión se manejará automáticamente por Supabase
        return { success: true }
      } else if (result.type === 'cancel') {
        throw new Error('Autenticación cancelada por el usuario')
      } else {
        throw new Error('Error en la autenticación')
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error en handleGoogleOAuth:', error)
    throw error
  }
}

// Función de login nativo con Google Sign-In
export const signInWithGoogleNative = async () => {
  try {
    // Verificar si Google Play Services están disponibles
    await GoogleSignin.hasPlayServices()
    
    // Realizar sign in
    const userInfo = await GoogleSignin.signIn()
    
    console.log('Google Sign-In exitoso:', userInfo)
    
    // Verificar que tenemos el idToken (está en userInfo.data.idToken)
    const idToken = userInfo.data?.idToken || userInfo.idToken
    if (!idToken) {
      throw new Error('No se pudo obtener el ID token de Google')
    }
    
    // Autenticar con Supabase usando el ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      access_token: userInfo.data?.serverAuthCode || userInfo.serverAuthCode || undefined,
    })
    
    if (error) {
      console.error('Error autenticando con Supabase:', error)
      throw error
    }
    
    console.log('Autenticación con Supabase exitosa:', data)
    return { success: true, user: data.user }
    
  } catch (error: any) {
    console.error('Error en signInWithGoogleNative:', error)
    
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Inicio de sesión cancelado por el usuario')
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Inicio de sesión en progreso')
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services no disponible')
    } else {
      throw error
    }
  }
}

// Función para manejar deep links de autenticación
export const handleAuthDeepLink = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    
    // Verificar si es un callback de autenticación
    if (parsedUrl.pathname.includes('/auth/callback')) {
      // Supabase manejará automáticamente el callback
      console.log('Auth callback recibido:', url)
      return true
    }
    
    return false
  } catch (error) {
    console.error('Error procesando deep link:', error)
    return false
  }
}