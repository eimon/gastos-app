// app/(tabs)/resumen.tsx - Resumen del mes seleccionado: tarjetas, me deben, debo y gastos del mes
import { memo, type ReactNode } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { ActivityIndicator, Appbar, Card, Divider, Text, useTheme } from 'react-native-paper'

import { AvisoErrorRecarga } from '../../components/AvisoErrorRecarga'
import { ErrorReintentar } from '../../components/ErrorReintentar'
import { useMonth } from '../../contexts/MonthContext'
import { useServicio } from '../../hooks/useServicio'
import { formatearMonto, nombreMes } from '../../services/gastoVista'
import type { BloqueSaldos, FilaSaldoResumen } from '../../services/resumenVista'
import * as resumenService from '../../services/resumenService'

function Fila({ titulo, monto, negrita }: { titulo: string; monto: number; negrita?: boolean }) {
  const variante = negrita ? 'titleSmall' : 'bodyMedium'
  return (
    <View style={styles.fila}>
      <Text variant={variante} style={styles.titulo}>
        {titulo}
      </Text>
      <Text variant={variante}>{formatearMonto(monto)}</Text>
    </View>
  )
}

function Bloque({ titulo, vacio, children }: { titulo: string; vacio?: string; children: ReactNode }) {
  return (
    <Card style={styles.bloque}>
      <Card.Title title={titulo} titleVariant="titleMedium" />
      <Card.Content style={styles.contenido}>{vacio ? <Text>{vacio}</Text> : children}</Card.Content>
    </Card>
  )
}

const FilaSaldo = memo(function FilaSaldo({ fila }: { fila: FilaSaldoResumen }) {
  const { colors } = useTheme()
  return (
    <View style={styles.persona}>
      <Fila titulo={fila.nombre} monto={fila.totalCents} negrita />
      {fila.delMesCents > 0 && <Fila titulo="Del mes" monto={fila.delMesCents} />}
      {fila.vencidoCents > 0 && (
        <View style={styles.fila}>
          <Text variant="bodyMedium" style={[styles.titulo, { color: colors.error }]}>
            Vencido
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.error }}>
            {formatearMonto(fila.vencidoCents)}
          </Text>
        </View>
      )}
    </View>
  )
})

function BloqueDeSaldos({ titulo, bloque, vacio }: { titulo: string; bloque: BloqueSaldos; vacio: string }) {
  return (
    <Bloque titulo={titulo} vacio={bloque.filas.length === 0 ? vacio : undefined}>
      {bloque.filas.map((fila) => (
        <FilaSaldo key={fila.nombre} fila={fila} />
      ))}
      <Divider />
      <Fila titulo="Del mes" monto={bloque.totales.delMesCents} />
      <Fila titulo="Vencido" monto={bloque.totales.vencidoCents} />
      <Fila titulo="Total" monto={bloque.totales.totalCents} negrita />
    </Bloque>
  )
}

export default function ResumenScreen() {
  const { mesActual, añoActual, navegarMesAnterior, navegarMesSiguiente } = useMonth()
  const { datos: resumen, cargando, error, recargar } = useServicio(
    () => resumenService.obtener(mesActual, añoActual),
    [mesActual, añoActual],
  )

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Resumen" />
      </Appbar.Header>

      <View style={styles.mes}>
        <Appbar.Action icon="chevron-left" accessibilityLabel="Mes anterior" onPress={navegarMesAnterior} />
        <Text variant="titleMedium">{nombreMes(mesActual, añoActual)}</Text>
        <Appbar.Action icon="chevron-right" accessibilityLabel="Mes siguiente" onPress={navegarMesSiguiente} />
      </View>

      <AvisoErrorRecarga visible={!!error && !!resumen} mensaje="No se pudo actualizar el resumen." onReintentar={recargar} />

      {cargando && !resumen ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : !resumen ? (
        <ErrorReintentar mensaje="No se pudo cargar el resumen." onReintentar={recargar} />
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          <Bloque titulo="Tarjetas" vacio={resumen.tarjetas.filas.length === 0 ? 'No hay cuotas de tarjeta este mes.' : undefined}>
            {resumen.tarjetas.filas.map((fila) => (
              <Fila key={fila.tarjetaId} titulo={fila.nombre} monto={fila.totalCents} />
            ))}
            <Divider />
            <Fila titulo="Total" monto={resumen.tarjetas.totalCents} negrita />
          </Bloque>

          <BloqueDeSaldos titulo="Me deben" bloque={resumen.meDeben} vacio="No hay cobros pendientes." />
          <BloqueDeSaldos titulo="Debo" bloque={resumen.debo} vacio="No hay deudas pendientes." />

          <Bloque titulo="Gastos del mes">
            <Fila titulo="Personales" monto={resumen.gastosDelMes.personalCents} />
            <Fila titulo="Compartidos (solo la parte propia)" monto={resumen.gastosDelMes.compartidoCents} />
            <Divider />
            <Fila titulo="Total" monto={resumen.gastosDelMes.totalCents} negrita />
          </Bloque>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lista: {
    padding: 12,
    gap: 12,
  },
  bloque: {
    backgroundColor: '#fff',
  },
  contenido: {
    gap: 6,
  },
  persona: {
    gap: 2,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titulo: {
    flexShrink: 1,
  },
})
