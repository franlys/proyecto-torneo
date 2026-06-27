# 🏆 Kronix E-sports Platform

¡Bienvenido a **Kronix**! Una plataforma web de última generación diseñada para la organización de torneos de E-sports, rankings nacionales, gestión de streamers, suscripciones VIP y sorteos interactivos en vivo.

---

## 🛠️ Tecnologías y Arquitectura

La plataforma está construida utilizando un stack moderno, escalable y optimizado para una experiencia de usuario fluida y en tiempo real:

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router, Server Components y Server Actions), estructurado para máxima velocidad y SEO.
- **Estilos**: [TailwindCSS](https://tailwindcss.com/) con una paleta personalizada de estética oscura y luces de neón (Cyan y Purple).
- **Backend / Base de Datos**: [Supabase](https://supabase.com/) como motor PostgreSQL, administrando autenticación, base de datos relacional y almacenamiento de archivos (Supabase Storage).
- **Notificaciones**: [Resend](https://resend.com/) para el envío automatizado de correos electrónicos transaccionales y de marketing.
- **Animaciones e Interactividad**: HTML5 Canvas y Web Audio API para efectos en tiempo real.

---

## 🚀 Módulos Clave de la Plataforma

### 1. 🏆 Gestión de Torneos (Tournaments)
- Registro y administración de brackets, reglas de puntuación y equipos participantes.
- Restricción de permisos: Los administradores y streamers pueden gestionar colaboraciones o sus propios torneos, garantizando la privacidad de los datos.
- Anuncio automático de nuevos torneos a todos los usuarios de la plataforma por correo.

### 2. ⚔️ Partidas en Vivo (Matches & Live Scoring)
- Flujo de partidas en curso ("AC Live") integrado con plataformas de apuestas de Esports externas.
- Registro de eliminaciones, muertes y cálculo dinámico del Top Fragger en torneos de estilo *Kill Race*.

### 3. 🎟️ Módulo de Sorteos (Raffles) — ¡NUEVO!
Módulo de rifas/sorteos totalmente integrado al panel del Super Admin y a las vistas de usuarios comunes:
- **Compra segura de Boletos**: Los usuarios autenticados eligen la cantidad de números y suben una foto del comprobante de transferencia bancaria.
- **Notificación automatizada**: Correos interactivos para reserva en revisión (`pending`), boletos verificados (`confirmed`) y felicitación al ganador (`winner`).
- **Verificación de Pagos**: Panel administrativo simplificado donde el Super Admin valida los depósitos y aprueba o cancela transacciones.
- **Ruleta en Vivo (Live Wheel)**: Ruleta interactiva renderizada en HTML5 Canvas con sonidos de giro dinámicos y animación de Confetti celebrando los colores corporativos de Kronix al determinar el ganador.

---

## 🔧 Configuración del Entorno de Desarrollo

Para correr el proyecto localmente, asegúrate de tener configurado tu archivo `.env.local` en la raíz con las siguientes variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend Email Integration
RESEND_API_KEY=re_your_api_key

# Webhook Secrets
AC_WEBHOOK_SECRET=your-arena-crypto-secret
```

---

## 💻 Ejecución Local

1. Instala todas las dependencias del proyecto:
   ```bash
   npm install
   ```
2. Inicia el servidor de desarrollo local:
   ```bash
   npm run dev
   ```
3. Accede a la plataforma desde tu navegador en [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Migraciones de Base de Datos

Las estructuras y tablas principales se inicializan a través de los scripts de la carpeta `supabase/migrations`. 
Para el módulo de sorteos, la inicialización local se puede revisar en el script de arranque `scratch/execute-raffles-migration.js`.
