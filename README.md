# SkinByYulieth · Gestión contable

Aplicación web privada para llevar la contabilidad de la cabina de estética **SkinByYulieth**. Permite registrar ventas, pagos parciales, clientes, gastos, retiros y otros ingresos, y consultar el tablero, el historial y la auditoría desde el celular o el computador.

> **Estado:** MVP funcional con persistencia real. No es una maqueta: todas las pantallas trabajan contra la API y la base de datos SQLite descritas en este documento.

---

## 1. Funcionalidades

- **Acceso privado** con dos cuentas individuales, contraseñas cifradas y sesiones en cookie.
- **Tablero** con período mensual por defecto, semanas de lunes a domingo y rango de fechas personalizado.
- **Ventas** con servicio del catálogo o concepto libre, precio histórico, cliente opcional, edición y anulación.
- **Pagos parciales y totales**, con fecha, método (efectivo o transferencia), edición y anulación. Se rechazan los sobrepagos.
- **Estados de venta:** pendiente, parcial, pagada y anulada.
- **Clientes** opcionales, con directorio, ficha, historial de ventas y pagos.
- **Catálogo de servicios** con precio sugerido y desactivación sin borrar el historial.
- **Gastos** con categoría, fecha, descripción y comprobante opcional (JPG, PNG, WEBP o PDF de hasta 5 MB).
- **Retiros personales** separados de los gastos del negocio.
- **Otros ingresos** para dinero que no proviene de una venta.
- **Historial cronológico unificado** con filtros por fecha, tipo, flujo y texto.
- **Auditoría** de creación, edición y anulación, con usuario, fecha y detalle de los cambios.
- **Exportaciones CSV** compatibles con Excel para ventas, pagos, devoluciones, gastos, retiros, otros ingresos, clientes y auditoría.
- **Copias de seguridad automáticas y manuales**, con verificación de integridad y retención configurable.
- **Interfaz en español**, formato de pesos colombianos (`$140.000`), diseño mobile-first y fechas en hora de Bogotá.

---

## 2. Reglas contables

Estas reglas son la base de todos los cálculos y conviene revisarlas antes de usar la aplicación:

### Dinero recibido

Para un período, el dinero recibido es:

```
pagos válidos + otros ingresos activos − devoluciones activas
```

No se usa el valor vendido. Una venta de `$140.000` con un pago de `$50.000` aporta `$50.000` al dinero recibido en la fecha del pago, aunque la venta se haya registrado antes.

### Gastos y ganancia estimada

- Los gastos pagados son los gastos activos del período.
- La ganancia estimada es `dinero recibido − gastos pagados`.
- La compra de un equipo se registra como gasto pagado en el MVP; no se deprecia.
- Los **retiros personales no reducen la ganancia**. Se muestran aparte porque son dinero que sale del negocio hacia el uso personal, no un costo de operación.
- El **saldo pendiente** del tablero suma los saldos de todas las ventas activas, sin importar su fecha. No está limitado al período seleccionado.

### Estados de una venta

| Estado | Significado |
| --- | --- |
| `pending` | Sin pagos válidos. |
| `partial` | Tiene pagos, pero el saldo es mayor que cero. |
| `paid` | El pago cubre el total. |
| `voided` | Anulada. No cuenta como venta activa ni genera saldo pendiente. |

### Anulación y dinero recibido

Una venta se puede anular. Si ya tenía pagos, el sistema exige indicar qué ocurrió con ese dinero:

1. **Devolví el dinero:** los pagos siguen válidos y se registra una devolución por el monto recibido. La devolución descuenta el ingreso del período en su propia fecha. Se pueden hacer devoluciones adicionales hasta agotar el pago y también se pueden anular.
2. **Fue un error de registro:** los pagos se anulan y dejan de contar como ingresos. No se crea devolución.
3. **Retuve el dinero:** los pagos se anulan y el monto recibido se convierte en un registro de **Otros ingresos** con concepto de retención.

La venta anulada, sus pagos, devoluciones y eventos de auditoría se conservan para trazabilidad, pero no contaminan los reportes de ventas activas.

### Otras reglas

- La moneda se guarda en **pesos colombianos enteros**; no se usan centavos.
- Las fechas de negocio se guardan como fecha local de Colombia (`YYYY-MM-DD HH:mm:ss`).
- Una venta guarda el nombre y el precio del servicio en el momento de crearla. Cambiar el catálogo después no altera ventas anteriores.
- Los servicios y las categorías **no se eliminan**: se desactivan para conservar el historial.
- Los gastos guardan el nombre de la categoría usado en ese momento.
- Las devoluciones solo se registran sobre ventas anuladas, por decisión del MVP.

---

## 3. Stack y arquitectura

| Capa | Tecnología |
| --- | --- |
| Interfaz | React 19 + Vite 8 + TypeScript |
| Servidor | Node.js 22.12+ + Express 5 + TypeScript (`tsx`) |
| Base de datos | SQLite con `better-sqlite3` (WAL, claves foráneas) |
| Autenticación | Sesiones opacas en cookie `httpOnly`; hash SHA-256 del token en la base |
| Contraseñas | `bcryptjs` con 12 rondas |
| Validación | Zod en todos los endpoints |
| Archivos | Comprobantes como BLOB dentro de SQLite (máximo 5 MB) |
| Exportaciones | CSV con BOM UTF-8 y separador `;` para Excel |

La aplicación es un monolito: Express sirve la API y, en producción, también el frontend compilado. SQLite guarda todo en un solo archivo, lo que simplifica las copias de seguridad. Por eso debe ejecutarse en **un solo servidor con disco persistente**, no en un entorno serverless ni con varias réplicas.

### Estructura del proyecto

```
src/                 Interfaz React (páginas, componentes, estilos)
server/
  routes/            Endpoints HTTP
  services/          Lógica contable y consultas
  db/migrations/     Esquema SQL versionado
  scripts/           Crear usuario, migrar, respaldar
  auth.ts            Sesiones y contraseñas
  backup.ts          Copias automáticas y verificación
  app.ts             Configuración de Express y seguridad
shared/              Tipos, fechas y formato de moneda compartidos
tests/               Pruebas de contabilidad y de API
data/                Base de datos local (ignorada por git)
```

---

## 4. Requisitos

- Node.js **22.12 o superior**.
- npm.
- En Linux, herramientas de compilación para `better-sqlite3` si no hay binario precompilado para tu versión de Node (`build-essential`, `python3`).
- Para producción: un servidor con disco persistente, HTTPS y la posibilidad de mantener un proceso Node en ejecución.

---

## 5. Instalación y ejecución local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea el archivo de entorno:

   ```bash
   # Linux / macOS
   cp .env.example .env

   # Windows (PowerShell)
   Copy-Item .env.example .env
   ```

3. Genera un secreto de sesión y pégalo en `SESSION_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

4. Crea las dos cuentas. El comando se ejecuta una vez por persona y pide nombre, correo y contraseña (mínimo 10 caracteres, con al menos una letra y un número):

   ```bash
   npm run user:create
   ```

5. Inicia el entorno de desarrollo:

   ```bash
   npm run dev
   ```

   La interfaz queda en `http://localhost:5173` y la API en `http://localhost:3001`. Vite redirige `/api` al servidor.

6. Primer uso recomendado:
   - Revisa el catálogo y crea los servicios con sus precios.
   - Revisa las categorías de gasto (el sistema crea cuatro categorías iniciales).
   - Registra una venta de prueba y luego anúlala con la política que corresponda.

La base de datos local se crea automáticamente en `./data/skinbyyulieth.db`. Las migraciones se aplican solas al iniciar el servidor.

### Comandos disponibles

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor y Vite en modo desarrollo. |
| `npm run dev:server` | Solo la API. |
| `npm run dev:web` | Solo la interfaz. |
| `npm run build` | Verifica tipos y compila el frontend en `dist/client`. |
| `npm start` | Inicia en producción con el frontend compilado. |
| `npm test` | Ejecuta todas las pruebas. |
| `npm run test:watch` | Pruebas en modo interactivo. |
| `npm run typecheck` | Verificación de TypeScript. |
| `npm run user:create` | Crea una cuenta. |
| `npm run backup` | Crea una copia manual desde la línea de comandos. |
| `npm run db:migrate` | Muestra las migraciones aplicadas. |

---

## 6. Variables de entorno

Todas se leen desde `.env`. El archivo `.env` no se debe subir al repositorio.

| Variable | Predeterminado | Descripción |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` o `production`. `npm start` fuerza producción. |
| `PORT` | `3001` | Puerto del servidor Express. |
| `DATABASE_PATH` | `./data/skinbyyulieth.db` | Archivo SQLite. Puede ser absoluto. |
| `BACKUP_DIR` | `./backups` | Carpeta de copias automáticas y manuales. |
| `BACKUP_RETENTION_DAYS` | `30` | Días que se conservan las copias. |
| `BACKUP_INTERVAL_MINUTES` | `1440` | Minutos entre copias automáticas (mínimo efectivo: 5). |
| `APP_ORIGIN` | `http://localhost:5173` | Origen permitido para solicitudes y cookies. En producción debe ser el dominio HTTPS exacto. |
| `SESSION_SECRET` | — | Secreto largo y aleatorio. Obligatorio en producción. |
| `SESSION_DAYS` | `30` | Duración de la sesión. |
| `COOKIE_SECURE` | `false` en desarrollo, `true` en producción | Enviar la cookie solo por HTTPS. |
| `MAX_RECEIPT_MB` | `5` | Tamaño máximo del comprobante de gasto. |
| `TRUST_PROXY` | `true` en producción | Confiar en el proxy inverso para obtener IP y protocolo. |
| `CLIENT_DIR` | `./dist/client` | Carpeta del frontend compilado. |

> En producción el servidor se niega a iniciar si `SESSION_SECRET` está vacío o si se usa el secreto de desarrollo.

---

## 7. Pruebas y verificación

```bash
npm run typecheck
npm test
npm run build
```

Las **34 pruebas** cubren, entre otros:

- Casos contables A–I: venta pagada, pago parcial, pago posterior, ganancia y retiros, compra de equipo, anulación con pagos, dos usuarios, precio histórico y períodos semanales/mensuales.
- Validación de fechas, sobrepagos y edición por debajo de lo pagado.
- Anulación de ventas con devolución, retención o error de registro.
- Devoluciones adicionales y anulación de devoluciones.
- Autenticación, protección de endpoints, origen/CSRF y límite de intentos de acceso.
- Comprobantes PDF/imagen, tipos no permitidos y descarga autenticada.
- Exportaciones CSV autenticadas y con encabezados claros.

La compilación de producción se verificó con un recorrido funcional completo sobre una base desechable: acceso, catálogo vacío, venta, pago, rechazo de sobrepago, tablero, historial, auditoría, exportación con BOM, protección CSRF, copia de seguridad, anulación con devolución y cierre de sesión.

---

## 8. Producción

### Requisitos de la infraestructura

- Servidor Linux con Node.js 22.12+.
- **Disco persistente** para `DATABASE_PATH` y `BACKUP_DIR`. No uses un sistema de archivos efímero.
- HTTPS mediante Nginx, Caddy u otro proxy inverso.
- Una sola instancia de la aplicación. No ejecutes varias réplicas sobre el mismo archivo SQLite.
- Capacidad de subir archivos de al menos 5 MB si se usan comprobantes.

### Pasos de despliegue

1. Copia el proyecto al servidor e instala dependencias. No uses `--omit=dev`: la compilación y `npm start` necesitan herramientas de desarrollo como `tsx` y Vite:

   ```bash
   npm ci
   ```

2. Crea `.env` a partir de `.env.example` y ajusta como mínimo:

   ```env
   NODE_ENV=production
   PORT=3001
   DATABASE_PATH=/var/lib/skinbyyulieth/skinbyyulieth.db
   BACKUP_DIR=/var/backups/skinbyyulieth
   APP_ORIGIN=https://contabilidad.tu-dominio.com
   SESSION_SECRET=<secreto-aleatorio-largo>
   COOKIE_SECURE=true
   BACKUP_RETENTION_DAYS=30
   BACKUP_INTERVAL_MINUTES=1440
   ```

3. Compila el frontend:

   ```bash
   npm run build
   ```

4. Crea las cuentas:

   ```bash
   npm run user:create
   ```

5. Inicia la aplicación:

   ```bash
   npm start
   ```

6. Comprueba `https://tu-dominio.com/health` y el acceso desde el navegador.

### Ejemplo de servicio systemd

```ini
[Unit]
Description=SkinByYulieth
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/skinbyyulieth
EnvironmentFile=/srv/skinbyyulieth/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
User=skinbyyulieth
Group=skinbyyulieth

[Install]
WantedBy=multi-user.target
```

### Ejemplo de proxy Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name contabilidad.tu-dominio.com;

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

`APP_ORIGIN` debe coincidir exactamente con el origen público (incluido `https://`). Si cambias de dominio, actualízalo y reinicia el servicio.

### Actualizaciones

1. Crea una copia de seguridad manual antes de actualizar.
2. Instala dependencias y compila: `npm ci && npm run build`.
3. Reinicia el proceso. Las migraciones pendientes se aplican al abrir la base.
4. Verifica `/health` y una pantalla de solo lectura.

Si una actualización falla, vuelve a la versión anterior del código y restaura la copia de seguridad creada antes del cambio.

---

## 9. Copias de seguridad y restauración

### Cómo funcionan

- Al iniciar el servidor se crea una copia a los **15 segundos**.
- Después se crea una copia cada `BACKUP_INTERVAL_MINUTES` minutos (valor mínimo aplicado: 5).
- Cada copia se hace con la API de backup de SQLite, se abre en modo lectura y se le ejecuta `PRAGMA integrity_check`.
- Si la verificación falla, el archivo incompleto se elimina y el error queda en el log.
- Las copias se guardan en `BACKUP_DIR` con el nombre `skinbyyulieth-<fecha>.db`.
- Se eliminan las copias más antiguas que `BACKUP_RETENTION_DAYS` días.
- También se puede crear una copia manual desde **Datos y respaldos** o con `npm run backup`.
- Los comprobantes de gastos están dentro de la base, así que la copia incluye todo.

### Copia fuera del servidor

Las copias automáticas viven en el mismo servidor. Para protegerse de la pérdida del disco:

```bash
# Ejemplo: traer la copia más reciente a tu equipo
scp usuario@servidor:/var/backups/skinbyyulieth/skinbyyulieth-*.db ./respaldo-local/
```

Guarda al menos una copia fuera del servidor y verifica que se pueda abrir. No guardes las copias en el repositorio ni en carpetas públicas.

### Procedimiento de restauración

1. **Detén la aplicación** para que nadie esté escribiendo:

   ```bash
   sudo systemctl stop skinbyyulieth
   ```

2. Guarda la base actual como respaldo antes de reemplazarla:

   ```bash
   mv /var/lib/skinbyyulieth/skinbyyulieth.db /var/lib/skinbyyulieth/skinbyyulieth.db.antes-restauracion
   ```

3. Copia la copia elegida sobre el archivo de la base:

   ```bash
   cp /var/backups/skinbyyulieth/skinbyyulieth-2026-10-28-08-00-00.db \
      /var/lib/skinbyyulieth/skinbyyulieth.db
   ```

4. **Elimina los archivos WAL y SHM antiguos** si existen. Pertenecen a la base anterior y no deben mezclarse con la restaurada:

   ```bash
   rm -f /var/lib/skinbyyulieth/skinbyyulieth.db-wal \
         /var/lib/skinbyyulieth/skinbyyulieth.db-shm
   ```

5. Verifica la integridad antes de arrancar:

   ```bash
   sqlite3 /var/lib/skinbyyulieth/skinbyyulieth.db "PRAGMA integrity_check;"
   ```

   Debe responder `ok`.

6. Inicia la aplicación y comprueba:

   ```bash
   sudo systemctl start skinbyyulieth
   ```

   Revisa el tablero, una venta, un gasto con comprobante y la auditoría. Si algo no cuadra, detén el servicio y vuelve a la base anterior.

> **Importante:** no restaures una base con la aplicación en ejecución. Tampoco copies solo el `.db` mientras hay escrituras activas sin usar la API de backup; el archivo WAL podría contener cambios pendientes. Para copias en caliente usa la copia integrada o `npm run backup`.

---

## 10. Exportaciones

La pantalla **Datos y respaldos** permite descargar:

- Ventas
- Pagos
- Devoluciones
- Gastos
- Retiros
- Otros ingresos
- Clientes (directorio completo)
- Auditoría

Los archivos son CSV en UTF-8 con BOM y separador `;`, pensados para abrirse directamente en Excel en español. No se genera un archivo `.xlsx` nativo. Las exportaciones usan las fechas de cada movimiento; los clientes se exportan completos.

---

## 11. Seguridad y privacidad

- Contraseñas con bcrypt (12 rondas). Nunca se muestran ni se devuelven por la API.
- Sesiones con token aleatorio de 32 bytes; en la base solo se guarda su hash SHA-256.
- Cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción.
- Todos los endpoints privados exigen sesión; las rutas de comprobantes también.
- Protección de origen/CSRF mediante `Origin` y `Sec-Fetch-Site` en métodos de escritura.
- Límite de 10 intentos fallidos de acceso cada 15 minutos por IP.
- Helmet con CSP en producción, sin `X-Powered-By`.
- Validación Zod y consultas parametrizadas en toda la API.
- Comprobantes limitados a JPG, PNG, WEBP o PDF y 5 MB.
- No hay borrado físico de ventas, pagos, gastos, retiros ni otros ingresos: se anulan y quedan auditados.
- La auditoría guarda usuario, acción, entidad, resumen, motivo y JSON anterior/posterior.

**La base de datos contiene información privada del negocio, hashes de contraseñas y comprobantes.** Trata las copias de seguridad como material sensible, restringe el acceso al servidor y no compartas los CSV por canales inseguros.

---

## 12. Limitaciones conocidas

- **Un solo servidor:** SQLite y el planificador de copias viven en el proceso. No hay soporte para varias réplicas ni para serverless.
- **Dos cuentas con los mismos permisos:** no hay roles, permisos diferenciados ni invitaciones.
- **Sin recuperación de contraseña desde la interfaz.** Si se olvida una contraseña, se necesita una intervención manual en la base o una herramienta administrativa que no forma parte del MVP.
- **Sin autenticación de dos factores (2FA).**
- **Copias fuera del servidor manuales:** la aplicación no sube respaldos a la nube ni los descarga desde la interfaz. Hay que copiarlos con `scp` o desde el proveedor.
- **Sin cifrado en reposo:** ni la base ni las copias se cifran por la aplicación. Usa cifrado de disco si tu proveedor lo permite.
- **Exportación CSV, no `.xlsx` nativo.**
- **Comprobantes dentro de SQLite:** pueden aumentar el tamaño de la base y de cada copia; el límite es 5 MB por archivo.
- **Ganancia estimada en base a caja:** no es contabilidad de causación, no incluye depreciación, impuestos ni cuentas por pagar.
- **Sin facturación electrónica, DIAN, inventario, nómina, suscripciones ni multimoneda.**
- **Devoluciones solo sobre ventas anuladas.** No se registran devoluciones de ventas activas.
- **Sin pruebas E2E de navegador automatizadas en el repositorio.** La verificación visual y funcional de producción se hizo de forma manual; las pruebas automatizadas son de contabilidad y API.
- **Fechas nativas del navegador:** los campos `date` pueden mostrarse en el formato regional del dispositivo, aunque los datos se guarden y calculen en hora de Bogotá.
- **Sin modo offline ni aplicación instalable (PWA).**
- **Sin edición masiva ni importación de datos históricos.**

---

## 13. Puesta en marcha en el negocio

1. Define el `SESSION_SECRET` definitivo y configura HTTPS.
2. Crea las cuentas de Yulieth y Fabio con `npm run user:create`.
3. Configura el servicio systemd (o el gestor de procesos equivalente) y el proxy HTTPS.
4. Carga los servicios reales en **Catálogo** y revisa las categorías de gasto.
5. Registra una venta y un pago de prueba; verifica el tablero y luego anula la venta con la política correcta.
6. Crea una copia manual y pruébala en un equipo aparte antes de empezar a operar.
7. Programa una copia externa periódica (por ejemplo, semanal) fuera del servidor.

---

## 14. Estado de la entrega

| Elemento | Estado |
| --- | --- |
| Interfaz completa en español | ✅ |
| Persistencia SQLite y migraciones | ✅ |
| Autenticación y autorización por endpoint | ✅ |
| Ventas, pagos, clientes, gastos, retiros y otros ingresos | ✅ |
| Tablero, historial y auditoría | ✅ |
| Exportaciones CSV | ✅ |
| Copias automáticas y restauración documentada | ✅ |
| Pruebas automatizadas | ✅ 34 pruebas |
| Build de producción y recorrido funcional | ✅ |
| Documentación de despliegue y limitaciones | ✅ |

Para cualquier cambio de alcance (por ejemplo, roles, facturación electrónica o múltiples sucursales), revisa primero las limitaciones y el modelo de datos.
