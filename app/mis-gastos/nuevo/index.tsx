// app/mis-gastos/nuevo/index.tsx - Alta de un gasto (personal o compartido)
import { useState } from 'react'

import { GastoForm } from '../../../components/GastoForm'
import * as gastosService from '../../../services/gastosService'
import { construirInputCrear, valoresInicialesGasto } from '../../../services/gastoFormulario'

export default function NuevoGastoScreen() {
  const [valoresIniciales] = useState(valoresInicialesGasto)

  return (
    <GastoForm
      titulo="Nuevo gasto"
      textoGuardar="Guardar gasto"
      valoresIniciales={valoresIniciales}
      onGuardar={(valores) => gastosService.crear(construirInputCrear(valores)).then(() => undefined)}
    />
  )
}
