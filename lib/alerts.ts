// lib/alerts.ts - Utilidades para mostrar alertas
import { Alert } from 'react-native'

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