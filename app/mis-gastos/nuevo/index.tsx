// app/mis-gastos/nuevo/index.tsx - Alta de un gasto (personal o compartido)
import { useState } from 'react'

import { GastoForm } from '../../../components/GastoForm'
import { useMonth } from '../../../contexts/MonthContext'
import { mesDeFecha, primerVencimiento } from '../../../services/gastoVista'
import * as gastosService from '../../../services/gastosService'
import { construirInputCrear, valoresInicialesGasto, type ValoresGastoForm } from '../../../services/gastoFormulario'

export default function NuevoGastoScreen() {
  const [valoresIniciales] = useState(valoresInicialesGasto)
  const { setSelectedDate } = useMonth()

  // The list shows the selected month, so jump to the month of the first cuota to make the new gasto visible.
  async function guardar(valores: ValoresGastoForm) {
    const { cuotas } = await gastosService.crear(construirInputCrear(valores))
    const { mes, año } = mesDeFecha(primerVencimiento(cuotas))
    setSelectedDate(mes, año)
  }

  return (
    <GastoForm
      titulo="Nuevo gasto"
      textoGuardar="Guardar gasto"
      valoresIniciales={valoresIniciales}
      onGuardar={guardar}
    />
  )
}
