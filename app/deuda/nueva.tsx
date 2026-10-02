// app/deuda/nueva.tsx - Alta de una deuda (dinero que se debe a una persona o entidad)
import { useState } from 'react'

import { DeudaForm } from '../../components/DeudaForm'
import { useMonth } from '../../contexts/MonthContext'
import { mesDeFecha, primerVencimiento } from '../../services/gastoVista'
import * as deudasService from '../../services/deudasService'
import { construirInputDeuda, valoresInicialesDeuda, type ValoresDeudaForm } from '../../services/deudaFormulario'

export default function NuevaDeudaScreen() {
  const [valoresIniciales] = useState(valoresInicialesDeuda)
  const { setSelectedDate } = useMonth()

  // The list shows the selected month, so jump to the month of the first cuota to make the new deuda visible.
  async function guardar(valores: ValoresDeudaForm) {
    const { cuotas } = await deudasService.crear(construirInputDeuda(valores))
    const { mes, año } = mesDeFecha(primerVencimiento(cuotas))
    setSelectedDate(mes, año)
  }

  return (
    <DeudaForm
      titulo="Nueva deuda"
      textoGuardar="Guardar deuda"
      valoresIniciales={valoresIniciales}
      onGuardar={guardar}
    />
  )
}
