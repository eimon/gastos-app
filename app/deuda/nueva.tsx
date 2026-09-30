// app/deuda/nueva.tsx - Alta de una deuda (dinero que se debe a una persona o entidad)
import { useState } from 'react'

import { DeudaForm } from '../../components/DeudaForm'
import * as deudasService from '../../services/deudasService'
import { construirInputDeuda, valoresInicialesDeuda } from '../../services/deudaFormulario'

export default function NuevaDeudaScreen() {
  const [valoresIniciales] = useState(valoresInicialesDeuda)

  return (
    <DeudaForm
      titulo="Nueva deuda"
      textoGuardar="Guardar deuda"
      valoresIniciales={valoresIniciales}
      onGuardar={(valores) => deudasService.crear(construirInputDeuda(valores)).then(() => undefined)}
    />
  )
}
