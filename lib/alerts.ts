// lib/alerts.ts - Utilidades para mostrar alertas
import { Alert } from 'react-native'
import Toast from 'react-native-toast-message'

export const showAlert = (title: string, message: string, onPress?: () => void) => {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'OK',
        onPress: onPress,
      },
    ],
    { cancelable: false }
  )
}

export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'Cancelar',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: onConfirm,
      },
    ],
    { cancelable: false }
  )
}

export const showOptions = (
  title: string,
  message: string,
  options: Array<{
    text: string
    onPress: () => void
    style?: 'default' | 'cancel' | 'destructive'
  }>
) => {
  Alert.alert(
    title,
    message,
    options,
    { cancelable: true }
  )
}

// Funciones para Toast
export const showSuccessToast = (message: string, title?: string) => {
  Toast.show({
    type: 'success',
    text1: title || 'Éxito',
    text2: message,
    position: 'top',
    visibilityTime: 3000,
    autoHide: true,
    topOffset: 60,
  })
}

export const showErrorToast = (message: string, title?: string) => {
  Toast.show({
    type: 'error',
    text1: title || 'Error',
    text2: message,
    position: 'top',
    visibilityTime: 4000,
    autoHide: true,
    topOffset: 60,
  })
}

export const showInfoToast = (message: string, title?: string) => {
  Toast.show({
    type: 'info',
    text1: title || 'Información',
    text2: message,
    position: 'top',
    visibilityTime: 3000,
    autoHide: true,
    topOffset: 60,
  })
}