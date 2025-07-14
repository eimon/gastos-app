// app/(tabs)/participantes.tsx - Pantalla de participantes
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native'
import {
  Card,
  Title,
  Paragraph,
  Button,
  FAB,
  Avatar,
  Chip,
  Searchbar,
} from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'
import { supabase, participantesService, Participante } from '../../lib/supabase'
import { router } from 'expo-router'
import { showAlert } from '../../lib/alerts'

export default function ParticipantesScreen() {
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    cargarParticipantes()
  }, [])

  const cargarParticipantes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const participantesData = await participantesService.obtenerParticipantes(user.id)
      setParticipantes(participantesData)
    } catch (error) {
      console.error('Error cargando participantes:', error)
      showAlert('Error', 'No se pudieron cargar los participantes')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarParticipantes()
  }

  const participantesFiltrados = participantes.filter(participante =>
    participante.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (participante.email && participante.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getInitials = (nickname: string) => {
    return nickname
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const renderParticipante = ({ item: participante }: { item: Participante }) => {
    return (
      <Card style={styles.participanteCard}>
        <Card.Content>
          <View style={styles.participanteHeader}>
            <Avatar.Text
              size={50}
              label={getInitials(participante.nickname)}
              style={[
                styles.avatar,
                { backgroundColor: participante.es_registrado ? '#4CAF50' : '#FF9800' }
              ]}
            />
            <View style={styles.participanteInfo}>
              <Title style={styles.participanteNombre}>{participante.nickname}</Title>
              {participante.email && (
                <Paragraph style={styles.participanteEmail}>{participante.email}</Paragraph>
              )}
              <View style={styles.participanteMeta}>
                <Chip
                  icon={participante.es_registrado ? 'account-check' : 'account-plus'}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: participante.es_registrado ? '#E8F5E8' : '#FFF3E0'
                    }
                  ]}
                  textStyle={[
                    styles.statusChipText,
                    {
                      color: participante.es_registrado ? '#4CAF50' : '#FF9800'
                    }
                  ]}
                >
                  {participante.es_registrado ? 'Registrado' : 'Invitado'}
                </Chip>
                <Text style={styles.fechaText}>
                  {new Date(participante.created_at).toLocaleDateString('es-AR')}
                </Text>
              </View>
            </View>
          </View>
        </Card.Content>

        <Card.Actions>
          <Button
            mode="outlined"
            onPress={() => router.push(`/participante/${participante.id}`)}
            icon="eye"
          >
            Ver Historial
          </Button>
          {!participante.es_registrado && (
            <Button
              mode="contained"
              onPress={() => router.push(`/participante/${participante.id}/invitar`)}
              icon="email"
            >
              Invitar
            </Button>
          )}
        </Card.Actions>
      </Card>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Buscar participantes..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
        <View style={styles.estadisticas}>
          <View style={styles.estadisticaItem}>
            <Text style={styles.estadisticaNumero}>{participantes.length}</Text>
            <Text style={styles.estadisticaLabel}>Total</Text>
          </View>
          <View style={styles.estadisticaItem}>
            <Text style={styles.estadisticaNumero}>
              {participantes.filter(p => p.es_registrado).length}
            </Text>
            <Text style={styles.estadisticaLabel}>Registrados</Text>
          </View>
          <View style={styles.estadisticaItem}>
            <Text style={styles.estadisticaNumero}>
              {participantes.filter(p => !p.es_registrado).length}
            </Text>
            <Text style={styles.estadisticaLabel}>Invitados</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={participantesFiltrados}
        renderItem={renderParticipante}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay participantes registrados</Text>
            <Text style={styles.emptySubtext}>
              Toca el botón + para agregar tu primer participante
            </Text>
          </View>
        }
      />

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => router.push('/crear-participante')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchbar: {
    marginBottom: 16,
  },
  estadisticas: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  estadisticaItem: {
    alignItems: 'center',
  },
  estadisticaNumero: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  estadisticaLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  lista: {
    padding: 16,
  },
  participanteCard: {
    marginBottom: 12,
    elevation: 2,
  },
  participanteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    marginRight: 16,
  },
  participanteInfo: {
    flex: 1,
  },
  participanteNombre: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  participanteEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  participanteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  fechaText: {
    color: '#666',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
})