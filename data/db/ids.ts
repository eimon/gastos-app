import { randomUUID } from 'expo-crypto';

/** Generates a sync-ready TEXT UUID for a new row's primary key. */
export function generarId(): string {
  return randomUUID();
}
