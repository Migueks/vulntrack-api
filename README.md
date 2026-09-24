# VulnTrack API

Backend de **VulnTrack**, una plataforma FullStack de gestión de vulnerabilidades de ciberseguridad.

La aplicación permite gestionar activos tecnológicos, catalogar vulnerabilidades, registrar hallazgos de seguridad, asignar responsables, controlar su ciclo de vida y consultar indicadores de riesgo mediante un Dashboard.

El proyecto se ha desarrollado como parte de un Proyecto Final de Máster FullStack.

## Tecnologías

- Node.js 22
- Express 5
- MongoDB Atlas
- Mongoose
- JavaScript (CommonJS)
- JSON Web Tokens (JWT)
- bcrypt
- Zod
- Helmet
- CORS
- express-rate-limit
- Multer
- Cloudinary
- csv-parse
- Node.js Test Runner

## Arquitectura

La aplicación utiliza una arquitectura modular organizada en:

Routes → Middlewares → Controllers → Services → Models

```text
src/
├── config/
├── constants/
├── middlewares/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── assets/
│   ├── vulnerabilities/
│   ├── findings/
│   └── dashboard/
├── seeds/
├── services/
├── utils/
├── app.js
└── server.js
```

Cada módulo mantiene separadas sus responsabilidades.

Las rutas reciben las peticiones HTTP, los middlewares validan autenticación y permisos, los controladores gestionan las respuestas y los servicios contienen la lógica de negocio.

Mongoose se utiliza para definir los modelos y acceder a MongoDB Atlas.

## Funcionalidades

### Authentication

- Inicio de sesión mediante email y contraseña.
- Contraseñas protegidas mediante bcrypt.
- Autenticación JWT.
- Tokens con caducidad de dos horas.
- Verificación del usuario en MongoDB.
- Invalidación de JWT tras cambios de contraseña o estado de cuenta.
- Limitación de intentos de inicio de sesión.

### Users

- Roles ADMIN, ANALYST y VIEWER.
- Consulta y gestión administrativa de usuarios.
- Activación y desactivación de cuentas.
- Edición del perfil personal.
- Cambio de contraseña.
- Restricciones para evitar desactivar usuarios con Findings activos asignados.

### Assets

- Inventario de activos tecnológicos.
- Alta, consulta y modificación.
- Criticidad de activos.
- Estados ACTIVE, INACTIVE y DECOMMISSIONED.
- Filtros, búsqueda y paginación.
- Recalculo de prioridades cuando cambia la criticidad.

### Vulnerabilities

- Catálogo de vulnerabilidades.
- Identificadores CVE opcionales.
- Puntuación CVSS.
- Cálculo automático de severidad.
- Estados ACTIVE y ARCHIVED.
- Filtros, búsqueda y paginación.
- Recalculo de prioridades cuando cambia la severidad.

### Findings

- Registro de vulnerabilidades detectadas en activos.
- Asignación de responsables.
- Estados OPEN, IN_PROGRESS, MITIGATED, RESOLVED, ACCEPTED_RISK y FALSE_POSITIVE.
- Prioridades P1, P2, P3 y P4.
- Fechas límite de remediación según SLA.
- Detección de Findings vencidos.
- Notas e historial de cambios.
- Evidencias privadas.
- Restricciones de acceso por rol y asignación.

### Dashboard

- Total de Findings activos y cerrados.
- Findings vencidos y sin asignar.
- Distribución por estado y prioridad.
- Distribución por severidad.
- Activos críticos y afectados.
- Tendencia mensual de detecciones y cierres.
- Tiempo medio de resolución.
- Activos con más hallazgos activos.
- Actividad reciente.
- Carga de trabajo por responsable para ADMIN.

Las estadísticas se calculan a partir de MongoDB mediante Aggregation Pipeline.

## Roles y permisos

| Funcionalidad                         | ADMIN | ANALYST          | VIEWER |
| ------------------------------------- | ----- | ---------------- | ------ |
| Consultar activos y vulnerabilidades  | Sí    | Sí               | Sí     |
| Crear activos y vulnerabilidades      | Sí    | Sí               | No     |
| Modificar criticidad y CVSS           | Sí    | No               | No     |
| Gestionar usuarios                    | Sí    | No               | No     |
| Consultar Findings                    | Sí    | Sí               | Sí     |
| Crear Findings                        | Sí    | Sí               | No     |
| Gestionar Findings                    | Sí    | Según asignación | No     |
| Descargar evidencias                  | Sí    | Según asignación | No     |
| Consultar Dashboard                   | Sí    | Sí               | Sí     |
| Consultar carga de trabajo individual | Sí    | No               | No     |

Los permisos se comprueban en el backend. El frontend no sustituye las validaciones de autorización.

## Instalación

### Requisitos

- Node.js 22
- npm
- MongoDB Atlas
- Cuenta de Cloudinary

Clonar el repositorio:

```bash
git clone https://github.com/Migueks/vulntrack-api.git
```

Acceder al proyecto:

```bash
cd vulntrack-api
```

Instalar las dependencias:

```bash
npm ci
```

Crear el archivo de entorno a partir de `.env.example`.

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Completar las variables necesarias y arrancar el servidor:

```bash
npm run dev
```

Por defecto, la API estará disponible en:

```text
http://localhost:3000/api/v1
```

## Variables de entorno

```dotenv
PORT=3000
NODE_ENV=development

MONGODB_URI=
JWT_SECRET=

CLIENT_ORIGIN=http://localhost:5173

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SEED_DEMO_PASSWORD=
```

`JWT_SECRET` debe contener al menos 32 bytes UTF-8.

`CLIENT_ORIGIN` debe coincidir con el origen autorizado del frontend.

Las credenciales de Cloudinary permiten gestionar las evidencias privadas.

`SEED_DEMO_PASSWORD` se utiliza exclusivamente al importar los datos de demostración.

Nunca deben publicarse valores reales de `.env`, contraseñas o credenciales.

## Endpoints principales

Prefijo común:

```text
/api/v1
```

### Health

```http
GET /health
```

### Authentication

```http
POST /auth/login
GET /auth/me
```

### Users

```http
GET   /users
POST  /users
GET   /users/:id
PATCH /users/:id
PATCH /users/:id/status

PATCH /users/me
PATCH /users/me/password
```

### Assets

```http
GET   /assets
POST  /assets
GET   /assets/:id
PATCH /assets/:id
PATCH /assets/:id/status
```

### Vulnerabilities

```http
GET   /vulnerabilities
POST  /vulnerabilities
GET   /vulnerabilities/:id
PATCH /vulnerabilities/:id
PATCH /vulnerabilities/:id/status
```

### Findings

```http
GET    /findings
POST   /findings
GET    /findings/:id

PATCH  /findings/:id/assignment
PATCH  /findings/:id/status

POST   /findings/:id/notes

POST   /findings/:id/evidence
GET    /findings/:id/evidence/:evidenceId/file
DELETE /findings/:id/evidence/:evidenceId
```

### Dashboard

```http
GET /dashboard/overview
```

Las rutas privadas requieren:

```http
Authorization: Bearer <JWT>
```

## Gestión de evidencias

Las evidencias nuevas se almacenan en Cloudinary como recursos autenticados.

Formatos admitidos:

- PNG
- JPEG
- WEBP
- PDF

Límites:

- Tamaño máximo: 5 MB por archivo.
- Máximo: 10 evidencias por Finding.

La subida utiliza `multipart/form-data` con un campo llamado `file`.

Las descargas se realizan a través del backend, que comprueba la autenticación y los permisos antes de recuperar el archivo.

Se mantiene compatibilidad con las evidencias locales anteriores mientras sus archivos sigan disponibles en el servidor.

## Seed y datos de demostración

El proyecto incluye un Excel con cuatro hojas relacionadas y sus correspondientes archivos CSV.

| Colección       | Registros iniciales |
| --------------- | ------------------: |
| Users           |                  12 |
| Assets          |                 120 |
| Vulnerabilities |                 120 |
| Findings        |                 300 |
| Total           |                 552 |

Los scripts utilizan `fs`, csv-parse y Mongoose.

Los códigos legibles del Excel se relacionan mediante ObjectIds durante la importación.

Comprobar los CSV:

```bash
npm run seed:check
```

Importar datos en una base de datos nueva:

```bash
npm run seed
```

**No ejecutar el seed sobre una base de datos que ya contenga información.**

El script está diseñado para impedir la importación sobre colecciones pobladas.

## Pruebas automatizadas

El backend utiliza el sistema nativo de pruebas de Node.js.

Ejecutar todas las pruebas:

```bash
npm test
```

Áreas cubiertas:

- Cálculo de severidad CVSS.
- Matriz de prioridades.
- Vencimientos SLA.
- Validación de versiones JWT.
- Validación de variables de entorno.

La primera batería contiene 14 pruebas unitarias.

Estas pruebas no sustituyen las pruebas de integración con MongoDB y Cloudinary.

## Seguridad

VulnTrack incorpora:

- Helmet para cabeceras HTTP.
- CORS con origen autorizado.
- Limitación de peticiones de login.
- Validación de entradas mediante Zod.
- Autenticación JWT.
- Autorización basada en roles.
- Validación de usuario activo.
- Invalidación de tokens mediante `tokenVersion`.
- Contraseñas cifradas mediante hash bcrypt.
- Validación de tipos de archivo por contenido.
- Almacenamiento autenticado de evidencias.
- Variables de entorno excluidas del repositorio.

## Comandos disponibles

```bash
npm run dev
npm start
npm test
npm run seed:check
npm run seed
```

Auditoría de dependencias:

```bash
npm audit --omit=dev
npm audit
```

## Estado del proyecto

El backend funcional se encuentra desarrollado y probado manualmente mediante Insomnia.

La batería inicial de pruebas unitarias se ha completado correctamente.

Antes de un despliegue público se deberán completar pruebas de integración y concurrencia, revisar los permisos mínimos de Cloudinary y configurar el entorno definitivo de producción.

## Frontend

El frontend se desarrollará en un repositorio independiente:

```text
vulntrack-web
```

Utilizará React y consumirá esta API REST.

## Autor

Miguel López-Herrero López

Proyecto Final Máster Desarrollo Web FullStack.
