# Configuración de Google OAuth para Android

Este archivo contiene las instrucciones para configurar Google OAuth en la aplicación móvil Android.

## Métodos de Autenticación Implementados

### 1. Método Nativo (Recomendado para Android)
- Utiliza `@react-native-google-signin/google-signin`
- Usa la cuenta de Google ya logueada en el dispositivo
- Mejor experiencia de usuario
- Requiere configuración específica de Android

### 2. Método Web (Fallback para iOS)
- Utiliza `expo-auth-session` y `WebBrowser`
- Abre el navegador para autenticación
- Funciona en todas las plataformas

## URLs de Redirección Configuradas

### Para Supabase:
- `gastos-app://auth` (deep link de la app)
- `https://tmaxjfuxfczypjbrqelq.supabase.co/auth/v1/callback` (callback de Supabase)

### Para Google Cloud Console:
Necesitas crear **DOS OAuth Client IDs**:

#### 1. OAuth Client ID para Android (Método Nativo)
- **Tipo**: Android
- **Nombre del paquete**: `com.gastosapp.mobile`
- **Huella digital SHA-1**: (ver instrucciones abajo)

#### 2. OAuth Client ID para Web (Método Web)
- **Tipo**: Web application
- **URIs de redirección autorizados**: `https://tmaxjfuxfczypjbrqelq.supabase.co/auth/v1/callback`

## Obtener SHA-1 Fingerprint

### Generar debug keystore (si no existe):
```bash
# Ejecutar un build de Android para generar el debug keystore automáticamente
npx expo run:android
```

### Para desarrollo (debug keystore):
```bash
# En Windows (después de generar el keystore)
keytool -list -v -keystore "C:\Users\eimon\proyectos\gastos-app\android\app\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# En macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### Para producción:
```bash
# Usar el keystore de producción
keytool -list -v -keystore path/to/your/release.keystore -alias your-key-alias
```

## Pasos de Configuración

### 1. En Google Cloud Console:
1. Crear OAuth Client ID para Android
2. Usar package name: `com.gastosapp.mobile`
3. Añadir SHA-1 fingerprint del debug keystore
4. Copiar el Client ID generado

### 2. En Supabase Dashboard:
1. Ve a **Authentication > Providers > Google**
2. Habilita el proveedor de Google
3. Configura:
   - **Client ID**: El Client ID del **OAuth Client ID para Web** (no el de Android)
   - **Client Secret**: El Client Secret del **OAuth Client ID para Web**
4. En **Redirect URLs**, asegúrate de tener:
   - `gastos-app://auth`
   - `https://tmaxjfuxfczypjbrqelq.supabase.co/auth/v1/callback`

## Configuración en el Código

En `lib/auth.ts`, actualiza la función `configureGoogleSignIn` con:

```typescript
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: 'TU_WEB_CLIENT_ID_AQUI', // Client ID del OAuth Web
    offlineAccess: true,
    hostedDomain: '',
    forceCodeForRefreshToken: true,
  })
}
```

**Importante**: Usa el **Web Client ID**, no el Android Client ID para la configuración.

### 3. Variables de Entorno:
Verificar que `EXPO_PUBLIC_GOOGLE_CLIENT_ID` en `eas.json` contenga el Client ID correcto.

## Configuración Actual del Proyecto

✅ **Ya configurado:**
- Deep links en `app.json` con intentFilters
- Esquema personalizado: `gastos-app`
- Implementación de OAuth con expo-auth-session
- Manejo de deep links en `_layout.tsx`

❌ **Pendiente de configurar:**
- Client ID de Android en Google Console
- URLs de redirección en Supabase
- SHA-1 fingerprint para el keystore de debug

## Verificación

Después de la configuración, probar:
1. `npx expo run:android` para ejecutar en dispositivo/emulador
2. Intentar login con Google
3. Verificar que la redirección funcione correctamente

## Notas Importantes

- El Client ID de Web y Android son diferentes
- Cada keystore (debug/release) requiere su propio SHA-1
- Las URLs de redirección deben coincidir exactamente
- Para producción, repetir el proceso con el keystore de release