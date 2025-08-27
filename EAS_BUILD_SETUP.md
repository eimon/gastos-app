# Configuración de EAS Build con Variables de Entorno

## Problema Resuelto

El archivo `eas.json` ahora usa variables de entorno en lugar de valores hardcodeados para evitar exponer claves sensibles en el repositorio Git.

## Configuración Local

1. **Archivo `.env`**: Contiene los valores reales para desarrollo local (ya está en `.gitignore`)
2. **Archivo `eas.json`**: Usa referencias a variables de entorno con `$VARIABLE_NAME`

## Para Builds con EAS

### Opción 1: Variables de Entorno del Sistema

Antes de ejecutar `eas build`, exportá las variables:

```bash
# Windows (PowerShell)
$env:EXPO_PUBLIC_SUPABASE_URL="https://tmaxjfuxfczypjbrqelq.supabase.co"
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY="tu_supabase_anon_key"
$env:EXPO_PUBLIC_GOOGLE_CLIENT_ID="tu_google_client_id"
$env:EXPO_PUBLIC_APP_NAME="Gastos App"
$env:EXPO_PUBLIC_APP_VERSION="1.0.1"

# Luego ejecutar
eas build --profile preview
```

```bash
# Linux/macOS
export EXPO_PUBLIC_SUPABASE_URL="https://tmaxjfuxfczypjbrqelq.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="tu_supabase_anon_key"
export EXPO_PUBLIC_GOOGLE_CLIENT_ID="tu_google_client_id"
export EXPO_PUBLIC_APP_NAME="Gastos App"
export EXPO_PUBLIC_APP_VERSION="1.0.1"

# Luego ejecutar
eas build --profile preview
```

### Opción 2: Archivo .env para EAS

Creá un archivo `.env.eas` (no incluido en Git) con:

```
EXPO_PUBLIC_SUPABASE_URL=https://tmaxjfuxfczypjbrqelq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=tu_google_client_id
EXPO_PUBLIC_APP_NAME=Gastos App
EXPO_PUBLIC_APP_VERSION=1.0.1
```

Y ejecutar:
```bash
eas build --profile preview --non-interactive
```

### Opción 3: EAS Secrets (Recomendado para CI/CD)

Para builds automáticos, usá EAS Secrets:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://tmaxjfuxfczypjbrqelq.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "tu_supabase_anon_key"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "tu_google_client_id"
eas secret:create --scope project --name EXPO_PUBLIC_APP_NAME --value "Gastos App"
eas secret:create --scope project --name EXPO_PUBLIC_APP_VERSION --value "1.0.1"
```

## Archivos Importantes

- ✅ `.env` - Variables locales (en `.gitignore`)
- ✅ `.env.example` - Plantilla para otros desarrolladores
- ✅ `eas.json` - Configuración con referencias a variables
- ❌ **NO subir** archivos con valores reales al repositorio

## Verificación

Para verificar que las variables se están leyendo correctamente:

```bash
eas build --profile preview --dry-run
```

Esto mostrará la configuración sin ejecutar el build.