// components/CampoMonto.tsx - Campo de monto con formato de moneda
import type { ComponentProps } from 'react'
import { TextInput } from 'react-native-paper'
import CurrencyInput from 'react-native-currency-input'

interface Props {
  label: string
  valor: number | null
  onCambiar: (valor: number | null) => void
}

export function CampoMonto({ label, valor, onCambiar }: Props) {
  return (
    <CurrencyInput
      value={valor}
      onChangeValue={onCambiar}
      prefix="$ "
      delimiter="."
      separator=","
      precision={2}
      minValue={0}
      renderTextInput={(textInputProps) => (
        // The lib types selectionColor as ColorValue; Paper's TextInput wants a string.
        <TextInput {...(textInputProps as ComponentProps<typeof TextInput>)} label={label} mode="outlined" keyboardType="numeric" />
      )}
    />
  )
}
