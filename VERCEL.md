# Desplegar Áurea Taller en Vercel

La interfaz y la API se despliegan en Vercel. La información se conserva en una base **libSQL de Turso**: nunca en un archivo SQLite temporal de una función. El funcionamiento local con SQLite sigue disponible por `node server.cjs`.

## 1. Base de datos

Crea una base **libSQL** en Turso y obtén su URL `libsql://...` y un token de lectura/escritura. Este adaptador utiliza `@libsql/client`; elige una base libSQL compatible, no una base de otro motor que use un SDK diferente. Usa bases distintas para producción y pruebas/Preview.

## 2. Variables privadas

En **Vercel → Project → Settings → Environment Variables**, configura:

| Variable | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | URL libSQL de la base |
| `TURSO_AUTH_TOKEN` | Token de lectura/escritura de esa base |
| `TALLER_SETUP_KEY` | Clave aleatoria de al menos 24 caracteres para crear el primer administrador |

Genera la clave en tu computador con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. No agregues prefijos `VITE_` ni `NEXT_PUBLIC_`, ni copies las credenciales al código o a Git. `.env.example` contiene únicamente ejemplos. Las variables se leen en el servidor; el build no las incorpora al navegador.

## 3. Importar el proyecto

Sube el código a tu repositorio e impórtalo en Vercel con la raíz de esta carpeta.

Se entrega `dist/aurea-taller-vercel.zip` con el código, las pruebas y esta guía, sin datos ni credenciales. Descomprímelo antes de subirlo a tu repositorio. Puedes regenerarlo ejecutando `scripts/package-vercel.ps1` desde PowerShell.

- **Framework Preset:** Other.
- **Node.js:** 24.x.
- **Build Command:** `pnpm build`.
- **Output Directory:** `public`.
- **Install Command:** dejar el automático; se incluye `pnpm-lock.yaml`.
- `vercel.json` configura la API, sus rutas y encabezados de seguridad.

El build copia una lista cerrada de seis archivos públicos. `data`, respaldos, fotografías locales, logs y archivos `.env` están excluidos del envío por `.vercelignore`. No despliegues la carpeta `data` ni la base `taller.sqlite` como archivos públicos.

## 4. Primer acceso o migración

**Si empiezas vacío:** abre la URL del despliegue, introduce la clave de puesta en marcha configurada en Vercel y crea tu administrador. La clave solo es necesaria para la creación inicial. Configura las tarifas y los datos de tu taller antes de operar.

**Si quieres conservar el taller local:** crea un respaldo y pausa los cambios en el taller durante la migración. Guarda las tres variables en un archivo privado `.env.local` y ejecuta, con Node.js 24:

```powershell
node --env-file=.env.local scripts/migrate-turso.cjs "C:\ruta\data\taller.sqlite"
```

Ejecuta esto **antes de crear el administrador en la web**. El programa exige una base de destino vacía y cancela si ya contiene usuarios o datos. Conserva órdenes, metales, caja, auditoría, usuarios, contraseñas y claves de idempotencia. No transfiere sesiones abiertas. El origen se abre en modo de solo lectura.

Después de migrar, inicia sesión con tu usuario habitual en la URL de Vercel. La base local y la nube son instalaciones independientes: no existe sincronización automática entre ambas.

## 5. Comprobación tras publicar

1. Abre `/api/session`: debe responder JSON, indicar `environment: "cloud"` y no mostrar credenciales.
2. Crea el administrador o inicia sesión si migraste. Revisa clientes y órdenes; una instalación nueva empieza vacía.
3. Comprueba una operación en una base de pruebas, recarga y verifica que persiste. Prueba también tras un nuevo despliegue apuntando a esa misma base de pruebas.
4. Descarga una copia y comprueba impresión/PDF. Revisa los logs de Vercel si recibes HTTP 503: normalmente falta configurar una variable, la base no está accesible o el token no tiene permisos.
5. Antes de publicar cambios, ejecuta `pnpm test` y `pnpm build`.

## Persistencia, respaldos y límites

Las sesiones, restricciones de intentos de acceso, operaciones y auditoría se guardan en Turso. Las escrituras usan transacciones; las revisiones e idempotencia también se comprueban después de obtener el bloqueo para coordinar distintas instancias.

Se guarda una copia diaria en `cloud_backups` al iniciar el servicio o antes del primer cambio del día, además de una copia previa a cada restauración. La descarga desde Configuración conserva el formato JSON habitual. Para recuperar una copia diaria almacenada en la base:

```powershell
# Listar copias disponibles
node --env-file=.env.local scripts/export-cloud-backup.cjs
# Exportar una sin sobrescribir archivos existentes
node --env-file=.env.local scripts/export-cloud-backup.cjs taller-AAAA-MM-DD copia.json
```

Vercel limita los cuerpos de petición y las respuestas almacenadas en búfer a 4,5 MB. Las respuestas grandes de esta API usan streaming; las restauraciones de más de 3 MB se suben automáticamente en fragmentos autenticados, con checksum, vencimiento y límite total de 25 MB. No subas restauraciones grandes directamente con una única llamada HTTP: usa la interfaz o la migración anterior.

Esta versión alojada **necesita internet**. El modo local conserva su operación sin internet. La compatibilidad física de balanzas e impresoras no cambia por alojar el programa en Vercel. El acceso remoto puede estar sujeto a los límites y costos de los planes de Vercel y Turso.

## Alcance de la validación

Se prueban el build, el modo local y el adaptador de nube utilizando el SDK HTTP real de libSQL contra un emulador de protocolo con almacenamiento SQLite persistente. Se comprueban cambios de instancia, concurrencia, permisos, respaldos y transferencias grandes. Esto no sustituye la verificación del despliegue real: hacen falta una base Turso y las variables privadas de tu cuenta para confirmar conectividad, permisos y límites efectivos del proveedor. No se han publicado datos ni credenciales del taller.

Referencias oficiales: [SQLite y Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [SDK de Turso](https://docs.turso.tech/sdk/ts/reference), [límites de Vercel](https://vercel.com/docs/functions/limitations), [streaming y archivos grandes](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
