import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Height of the software keyboard (0 when hidden). With Android edge-to-edge
 * (mandatory on SDK 57) the window does not shrink for the keyboard, so screens
 * with text inputs add this as bottom padding to keep the focused field
 * scrollable above it. Listeners are removed on unmount.
 */
export function useAlturaTeclado(): number {
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    const mostrar = Keyboard.addListener('keyboardDidShow', (evento) => setAltura(evento.endCoordinates.height));
    const ocultar = Keyboard.addListener('keyboardDidHide', () => setAltura(0));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);

  return altura;
}
