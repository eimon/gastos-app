// components/AvisoErrorRecarga.tsx - Aviso con opción de reintentar cuando falla una recarga y ya hay datos en pantalla
import { Banner } from 'react-native-paper'

interface Props {
  visible: boolean
  mensaje: string
  onReintentar: () => void
}

export function AvisoErrorRecarga({ visible, mensaje, onReintentar }: Props) {
  return (
    <Banner visible={visible} icon="alert-circle-outline" actions={[{ label: 'Reintentar', onPress: onReintentar }]}>
      {mensaje}
    </Banner>
  )
}
