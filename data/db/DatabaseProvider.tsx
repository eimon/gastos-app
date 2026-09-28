import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../drizzle/migrations';
import { db } from './client';

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * Runs pending SQLite migrations (via `useMigrations`) before rendering the
 * app. Gates render with a loading state while migrations run and an error
 * state if they fail — the rest of the app assumes the schema is ready.
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge">No se pudo preparar la base de datos.</Text>
        <Text variant="bodySmall">{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
});
