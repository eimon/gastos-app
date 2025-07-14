# Gastos App

Aplicación móvil para gestión de gastos compartidos, desarrollada con Expo y Supabase.

## Características

- 📱 **Multiplataforma**: iOS, Android y Web
- 💰 **Gestión de Gastos**: Crear, editar y eliminar gastos personales y compartidos
- 👥 **Participantes**: Gestionar participantes registrados y no registrados
- 💳 **Pagos**: Registrar y seguimiento de pagos (efectivo, transferencia)
- 📊 **Resúmenes**: Estadísticas y análisis de gastos
- 🔐 **Autenticación**: Login con email/password y Google OAuth
- 🌐 **Tiempo Real**: Sincronización automática con Supabase

## Tecnologías

- **Frontend**: React Native + Expo
- **UI**: React Native Paper + Expo Vector Icons
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Navegación**: Expo Router
- **Estado**: React Hooks
- **TypeScript**: Tipado estático

## Instalación

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Expo CLI
- Cuenta de Supabase

### Configuración

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd gastos-app
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar Supabase**
   - Crear un proyecto en [Supabase](https://supabase.com)
   - Ejecutar las migraciones SQL (ver sección Database)
   - Copiar `.env.example` a `.env`
   - Configurar las variables de entorno:
     ```
     EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
     EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
     ```

4. **Ejecutar la aplicación**
   ```bash
   npm start
   ```

## Estructura de Base de Datos

### Tablas Principales

#### usuarios
```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  hashed_password VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  rol VARCHAR(20) DEFAULT 'user',
  provider VARCHAR(50),
  provider_id VARCHAR(255),
  foto_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### participantes
```sql
CREATE TABLE participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  usuario_id UUID REFERENCES usuarios(id),
  es_registrado BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### gastos
```sql
CREATE TYPE tipo_gasto AS ENUM ('personal', 'compartido');

CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  tipo tipo_gasto NOT NULL,
  fecha DATE NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### gastos_detalle
```sql
CREATE TABLE gastos_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES participantes(id),
  monto DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### pagos
```sql
CREATE TYPE medio_pago AS ENUM ('efectivo', 'transferencia');

CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id UUID NOT NULL REFERENCES gastos(id),
  participante_id UUID NOT NULL REFERENCES participantes(id),
  monto DECIMAL(10,2) NOT NULL,
  medio_pago medio_pago NOT NULL,
  fecha_pago DATE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Configuración de RLS (Row Level Security)

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Políticas de ejemplo (ajustar según necesidades)
CREATE POLICY "Users can view own data" ON usuarios
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON usuarios
  FOR UPDATE USING (auth.uid() = id);
```

## Estructura del Proyecto

```
gastos-app/
├── app/                    # Pantallas y navegación (Expo Router)
│   ├── (tabs)/            # Navegación por pestañas
│   │   ├── gastos.tsx     # Lista de gastos
│   │   ├── participantes.tsx # Gestión de participantes
│   │   ├── pagos.tsx      # Lista de pagos
│   │   ├── resumen.tsx    # Estadísticas y resumen
│   │   └── _layout.tsx    # Layout de pestañas
│   ├── _layout.tsx        # Layout principal
│   └── index.tsx          # Pantalla inicial
├── components/            # Componentes reutilizables
│   ├── LoginScreen.tsx    # Pantalla de login
│   └── UserProfileSetup.tsx # Configuración de perfil
├── lib/                   # Utilidades y configuración
│   ├── supabase.ts       # Cliente y tipos de Supabase
│   └── alerts.ts         # Utilidades para alertas
├── assets/               # Recursos estáticos
├── app.json             # Configuración de Expo
├── package.json         # Dependencias
└── tsconfig.json        # Configuración TypeScript
```

## Scripts Disponibles

```bash
# Desarrollo
npm start          # Iniciar servidor de desarrollo
npm run android    # Ejecutar en Android
npm run ios        # Ejecutar en iOS
npm run web        # Ejecutar en navegador

# Build
npm run build      # Construir para producción

# Utilidades
npm run reset-cache # Limpiar caché de Metro
```

## Funcionalidades Principales

### Gestión de Gastos
- Crear gastos personales y compartidos
- Asignar participantes y montos
- Editar y eliminar gastos
- Filtrar por tipo y buscar

### Participantes
- Agregar participantes registrados y no registrados
- Buscar y filtrar participantes
- Ver historial de participación

### Pagos
- Registrar pagos en efectivo o transferencia
- Asociar pagos a gastos específicos
- Ver resumen por método de pago

### Resumen y Estadísticas
- Total de gastos y pagos
- Distribución por tipo
- Gastos recientes
- Análisis por período

## Configuración de Autenticación

### Email/Password
Configurado automáticamente con Supabase Auth.

### Google OAuth (Opcional)
1. Configurar OAuth en Google Cloud Console
2. Agregar credenciales en Supabase Auth
3. Configurar `EXPO_PUBLIC_GOOGLE_CLIENT_ID` en `.env`

## Deployment

### Expo Application Services (EAS)
```bash
# Instalar EAS CLI
npm install -g @expo/eas-cli

# Configurar proyecto
eas build:configure

# Build para Android
eas build --platform android

# Build para iOS
eas build --platform ios
```

### Web
```bash
# Build para web
npm run build

# Los archivos estáticos estarán en dist/
```

## Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## Soporte

Para reportar bugs o solicitar features, por favor crear un issue en el repositorio.

---

**Desarrollado con ❤️ usando Expo y Supabase**