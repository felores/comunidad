# Paquete de autorización para abrir la comunidad gratuita v0.1

Fecha: 2026-09-20

## Estado y alcance

- Estado: `draft-live`, con las cuatro precondiciones locales aceptadas por la
  Verificación independiente de cierre. Los Human Gates live siguen pendientes.
- Lifecycle: `implementation`.
- Implementación local: la verificación de la tarjeta 23 quedó reemplazada para
  rollout por una carrera idempotente detectada durante esta revisión.
- Artefacto local: [`../implementation-evidence/free-community-p0-local-v0.1.md`](../implementation-evidence/free-community-p0-local-v0.1.md).
- Decisiones base: [`primer-slice-comunidad-gratis-v0.1.md`](primer-slice-comunidad-gratis-v0.1.md).
- Este documento no autoriza ni ejecuta mutaciones live.

El objetivo es preparar la apertura del P0 gratuito implementado localmente sin mezclar cambios de datos,
secretos, infraestructura, despliegue y publicación. Cada etapa protegida exige
su propia aprobación y evidencia. Una aprobación posterior solo cubre la
mutación nombrada en su gate.

No forman parte de este rollout pagos, Hotmart, cursos pagos, un VPS nuevo,
otro Directus, migración editorial ni colecciones `sp_*` futuras.

## Condiciones que bloquean cualquier mutación

Detenerse antes del primer cambio si ocurre cualquiera de estas condiciones:

1. El commit o digest candidato no corresponde al árbol que pasó el gate local.
2. Falta un backup verificable de la base que se va a cambiar.
3. No hay un responsable humano para custodiar secretos y ejecutar rollback.
4. Un valor real aparece en el repositorio, comentario del Board o salida
   persistida del job.
5. La identidad de Astro hereda una política, rol o token de AOS/CRM.
6. Una imagen usa un tag mutable sin digest.
7. Un puerto de Astro, PostgreSQL o Remark42 queda publicado en el host.
8. DNS o TLS requieren reemplazar servicios existentes en `neo4j`.
9. No se puede volver al digest anterior sin reconstruir una imagen.
10. El backup de PostgreSQL o Remark42 no pasa una restauración aislada.

## Precondiciones locales reparadas

La Verificación independiente del rollout dejó sin efecto el PASS anterior para
fines de apertura. Las cuatro precondiciones locales que exigió quedaron
implementadas, verificadas y aceptadas por el pase independiente de cierre.
Esto no inicia ni autoriza ningún Human Gate live:

1. `ensureMember` debe releer por `auth_subject` después de un conflicto único
   y demostrar idempotencia bajo dos autorizaciones concurrentes.
2. Logout y reset invalidan comentarios de inmediato mediante expiración de
   cookies y validación Better Auth en el proxy.
3. El provisionador OAuth no puede ejecutar migraciones, imprimir secretos ni
   depender de un tmpfs privado que desaparezca al terminar el contenedor.
4. Los `FROM` del Dockerfile deben fijarse por digest.

### Contrato local de invalidación de comentarios

La reparación local debe cumplir las tres defensas, no elegir solo una:

- El handler de logout expira `JWT` y `XSRF-TOKEN` con
  `Path=/comentarios`, `Max-Age=0`, `HttpOnly` correcto y los mismos atributos
  `Secure`/`SameSite` del handoff, además de cerrar Better Auth.
- El flujo de reset que confirma la nueva clave devuelve las mismas expiraciones
  de cookies Remark42. Como Better Auth revoca todas las sesiones al reset, un
  browser distinto también queda bloqueado en su siguiente request.
- El proxy valida una sesión Better Auth activa antes de reenviar cualquier
  request de autenticación o escritura a Remark42. Como mínimo cubre POST, PUT,
  PATCH y DELETE bajo `/comentarios/api/**`. Si la sesión falta o fue revocada,
  responde 401/403, no llama al upstream y expira ambos cookies Remark42. Los
  puertos internos de Remark42 siguen sin ingress, por lo que el proxy es la
  única ruta de escritura.

Prueba enfocada observable requerida:

1. Crear y verificar una cuenta desechable. Obtener sesión Better Auth y cookies
   Remark42, publicar un comentario control y conservar una copia del cookie jar.
2. Ejecutar logout. Exigir tres `Set-Cookie` de expiración: sesión Better Auth,
   `JWT` y `XSRF-TOKEN`; los dos últimos llevan `Path=/comentarios`.
3. Repetir una publicación con el jar anterior, incluido el JWT todavía no
   expirado. Debe responder 401/403, no invocar Remark42 y expirar los dos
   cookies. `/api/remark42/sso` también responde 403 y no emite handoff.
4. Repetir desde una sesión nueva, emitir cookies Remark42, completar reset de
   password y reusar el jar anterior completo. La publicación y el SSO deben
   fallar igual, incluso desde otro browser que no recibió la respuesta de reset.
5. Confirmar que lectura pública permitida sigue funcionando y que login con la
   nueva clave puede emitir una sesión y handoff nuevos.

La prueba se ejecuta contra el handler, proxy, PostgreSQL y cookie jar reales.
Un test que solo decodifique el JWT o inspeccione funciones no satisface esta
precondición. La evidencia local actual sí cubre este recorrido, pendiente del
pase independiente final.

## Topología autorizable

```text
Internet
  -> sociedadparalela.com
       -> Traefik existente en neo4j
            -> sp-astro:4321
                 -> sp-auth-db:5432, red privada
                 -> sp-remark42:8080, red privada, vía /comentarios
                 -> https://aos.markenetica.com, TLS server-to-server
                 -> api.resend.com, TLS server-to-server

Sin ingreso público
  -> sp-auth-db
  -> sp-remark42:8080
```

Servicios nuevos dentro del host existente `neo4j`:

| Servicio Coolify | Responsabilidad | Ingreso | Límite |
|---|---|---|---|
| `sp-astro` | HTML, rutas de cuenta, Better Auth, proxy de comentarios y adapters | Solo Traefik | Aprobado: 1 vCPU, 1 GiB RAM |
| `sp-remark42` | Conversación y datos de comentarios | Solo red privada desde Astro | Aprobado: 0.5 vCPU, 512 MiB RAM |
| `sp-auth-db` | Base PostgreSQL exclusiva de Better Auth | Solo red privada desde Astro, job de migración y job OAuth | Propuesto para aprobación: 1 vCPU, 1 GiB RAM |
| `sp-oauth-provisioner` | Job detenido, de una sola ejecución, basado en el digest Astro | Solo red `sp-p0`; sin ingress | Comparte el límite de job de Astro y se elimina al terminar |
| `sp-oauth-secret-loader` | Consumidor detenido, de una sola ejecución, basado en el digest Astro | API Coolify y bind read-write del tmpfs de handoff; sin ingress | Comparte el límite de job de Astro y se elimina al terminar |

Los tres servicios usan volúmenes, secretos, healthchecks, logs y restart por
separado. No comparten red con WordPress, MariaDB o Buzz, salvo el ingreso de
Traefik a Astro. No se crea otro VPS ni otro servicio de control plane.

## Etapa 1. Control plane Directus

### Schema mínimo del P0

El recorrido gratuito solo consulta y crea `sp_members`. `sp_entitlements` no
participa en `community:free` y se difiere junto con cursos, módulos, releases,
pagos, cohorts y overrides.

Colección `sp_members`:

| Campo | Tipo Directus/PostgreSQL | Reglas |
|---|---|---|
| `id` | UUID | Primary key, generado por el servidor, inmutable |
| `auth_subject` | string, longitud máxima 255 | Requerido, único, inmutable. ID opaco de Better Auth |
| `email_normalized` | string, longitud máxima 320 | Requerido, único entre miembros no eliminados, minúsculas y sin espacios externos |
| `display_name` | string, longitud máxima 120 | Requerido, 1 a 120 caracteres tras trim |
| `status` | string | Requerido. Solo `active`, `blocked` o `deleted`. Preset inicial `active` |
| `source` | string, longitud máxima 120 | Opcional. Atribución, nunca permiso |
| `campaign` | string, longitud máxima 120 | Opcional. Atribución, nunca permiso |
| `content` | string, longitud máxima 120 | Opcional. Atribución, nunca permiso |
| `lead_magnet` | string, longitud máxima 120 | Opcional. Atribución, nunca permiso |
| `created_at` | timestamp with time zone | Requerido, generado al crear, inmutable |
| `updated_at` | timestamp with time zone | Requerido, actualizado por Directus |

No guardar password, sesión, token de verificación, token de reset, token de
Directus, secreto de OAuth ni secreto de Remark42. El email operativo no se
devuelve al navegador desde este adapter.

Restricciones de base requeridas:

- Primary key en `id`.
- Unique index en `auth_subject`.
- Unique index parcial en `email_normalized` donde `status <> 'deleted'`.
- Check de `status IN ('active', 'blocked', 'deleted')`.
- Check de `length(btrim(auth_subject)) BETWEEN 1 AND 255`.
- Check de `email_normalized = lower(btrim(email_normalized))` y
  `length(email_normalized) BETWEEN 3 AND 320`.
- Check de `display_name = btrim(display_name)` y
  `length(display_name) BETWEEN 1 AND 120`.
- Checks de longitud máxima 120 para cada campo opcional de atribución.

### Idempotencia

`ensureMember` busca por `auth_subject` y crea solo si no existe. La unique
constraint es la autoridad frente a carreras. Si dos requests intentan crear
el mismo sujeto, el segundo debe tratar el conflicto único como éxito mediante
una nueva lectura por `auth_subject`.

El adapter local actual hace lectura seguida de creación, pero no reintenta la
lectura después de un `409`. Por tanto, el gate de despliegue queda bloqueado
hasta que una reparación local y una prueba enfocada demuestren este caso. No
se relaja la unique constraint para acomodar el defecto.

### Identidad y política de Astro

Crear una identidad no humana `sp_astro_p0` con token dedicado. No asignarle
App Access, Admin Access, rol padre ni políticas existentes. Su única política
permite:

| Colección | Acción | Campos | Filtro o validación |
|---|---|---|---|
| `sp_members` | read | `id`, `auth_subject`, `status` | Item scope `null`. El adapter siempre envía `filter[auth_subject][_eq]`, `limit=1` y fields mínimos |
| `sp_members` | create | `auth_subject`, `email_normalized`, `display_name`, `status`, `source`, `campaign`, `content`, `lead_magnet` | Preset server-side `status=active`; el único valor permitido es `active` |

La política Directus propuesta se revisa como este payload declarativo. Los IDs
reales se sustituyen en el dry-run, sin cambiar acciones, campos o reglas:

```json
[
  {
    "collection": "sp_members",
    "action": "read",
    "permissions": null,
    "validation": null,
    "presets": null,
    "fields": ["id", "auth_subject", "status"]
  },
  {
    "collection": "sp_members",
    "action": "create",
    "permissions": null,
    "validation": {
      "_and": [
        { "auth_subject": { "_nempty": true } },
        { "email_normalized": { "_regex": "^[^\\s]+@[^\\s]+$" } },
        { "display_name": { "_nempty": true } },
        { "status": { "_eq": "active" } }
      ]
    },
    "presets": { "status": "active" },
    "fields": [
      "auth_subject", "email_normalized", "display_name", "status",
      "source", "campaign", "content", "lead_magnet"
    ]
  }
]
```

Los checks PostgreSQL anteriores son la autoridad para trim, lowercase y
longitud. El item scope de lectura no puede limitarse a un solo sujeto porque
la identidad de servidor atiende a todos los miembros. Esto deja un riesgo de
enumeración de `id`, `auth_subject` y `status` si el token se filtra. Se reduce
con campos mínimos, token server-only, logs redactados, rotación y ausencia de
acceso a email. El adapter debe rechazar cualquier query que no tenga el filtro
exacto, `limit=1` y la allowlist de fields.

No permite update, delete, share, import, export ni lectura de otros campos.
En Directus, "deny" significa ausencia comprobada de una fila de permiso. La
matriz ejecutable es:

| Dominio | Read | Create | Update | Delete |
|---|---:|---:|---:|---:|
| Cualquier colección CRM o Markenética | Deny | Deny | Deny | Deny |
| Cualquier colección AOS que no empiece por `sp_` | Deny | Deny | Deny | Deny |
| `sp_entitlements` y demás `sp_*` diferidas | Deny | Deny | Deny | Deny |
| `directus_users`, `directus_roles`, `directus_policies`, `directus_permissions` | Deny | Deny | Deny | Deny |
| `directus_settings`, `directus_fields`, `directus_collections`, `directus_files` | Deny | Deny | Deny | Deny |

En Directus los permisos son aditivos. La evidencia debe mostrar todas las
políticas efectivas de `sp_astro_p0`, no solo la política nueva.

El snapshot previo genera un inventario `all_collections`. Para cada colección
distinta de `sp_members`, la prueba autoritativa de create/update/delete es la
ausencia de una fila efectiva para esa acción. No se envía una mutación live
solo para demostrar un deny. La lectura negativa usa estos endpoints:

```text
Colección de aplicación: GET /items/<collection>?limit=1
directus_users:       GET /users?limit=1
directus_roles:       GET /roles?limit=1
directus_policies:    GET /policies?limit=1
directus_permissions: GET /permissions?limit=1
directus_settings:    GET /settings
directus_fields:      GET /fields?limit=1
directus_collections: GET /collections?limit=1
directus_files:       GET /files?limit=1
```

Cada GET debe responder 401 o 403. La matriz contiene una fila por colección,
las cuatro acciones y dos columnas de evidencia: permiso efectivo ausente para
read/create/update/delete y GET negativo para read. Un entorno desechable puede
añadir requests mutantes negativos, pero no son requisito ni se ejecutan live.

### Dry-run, aplicación y rollback

Antes de aplicar:

1. Exportar un snapshot read-only de schema, rol, políticas y permisos
   efectivos actuales.
2. Producir el diff declarativo exacto para una colección y una identidad.
3. Confirmar que el diff no toca settings globales, registro público, CORS,
   SMTP, usuarios AOS ni colecciones existentes.
4. Guardar el plan inverso: revocar token, quitar política, desactivar la
   colección y eliminarla solo si permanece vacía.

Después de aplicar, los dos requests positivos deben funcionar. Cada GET de la
matriz negativa debe responder `401` o `403`; create/update/delete se prueban
mediante ausencia de permiso efectivo, sin enviar una mutación live. Un `404`
no demuestra falta de permiso si la colección existe.

Rollback inmediato: revocar el token y poner Astro en modo sin registro. Si
`sp_members` ya contiene filas, no eliminar colección ni datos durante el
incidente. Restaurar schema solo desde backup y mediante una autorización
separada.

## Etapa 2. Better Auth sobre PostgreSQL

### Base, schema y roles

Crear un servicio PostgreSQL 17.6 aislado llamado `sp-auth-db`, con database
`sp_auth` y schema `auth`. El `search_path` de las conexiones de Better Auth
debe ser `auth,pg_catalog`. No usar la base de Directus, MariaDB ni un usuario
administrador como `AUTH_DATABASE_URL`.

Roles separados:

| Rol lógico | Uso | Privilegios |
|---|---|---|
| `sp_auth_owner` | Ownership | Rol `NOLOGIN NOINHERIT`. Owner del database/schema y objetos Better Auth |
| `sp_auth_migrator` | `npm run auth:migrate` en un job de una sola ejecución | Login temporal, miembro de `sp_auth_owner`; ejecuta la migración con `SET ROLE sp_auth_owner` y no conserva ownership propio |
| `sp_auth_runtime` | Proceso `sp-astro` | `CONNECT`, `USAGE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` solo sobre tablas y secuencias de `auth` |
| `sp_auth_backup` | Job de backup | `CONNECT`, `USAGE`, `SELECT` solo en `auth` |

DDL base a revisar antes de ejecución. Las credenciales se asignan fuera del
script mediante el secret store:

```sql
CREATE ROLE sp_auth_owner NOLOGIN NOINHERIT;
CREATE ROLE sp_auth_migrator LOGIN NOINHERIT VALID UNTIL '<MIGRATION_WINDOW_END>';
CREATE ROLE sp_auth_runtime LOGIN NOINHERIT;
CREATE ROLE sp_auth_backup LOGIN NOINHERIT;
GRANT sp_auth_owner TO sp_auth_migrator;

CREATE DATABASE sp_auth OWNER sp_auth_owner;
REVOKE CONNECT ON DATABASE sp_auth FROM PUBLIC;
GRANT CONNECT ON DATABASE sp_auth TO sp_auth_migrator, sp_auth_runtime, sp_auth_backup;

-- Ejecutar conectado a sp_auth con SET ROLE sp_auth_owner.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA auth AUTHORIZATION sp_auth_owner;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO sp_auth_runtime, sp_auth_backup;

ALTER ROLE sp_auth_migrator IN DATABASE sp_auth SET search_path = auth, pg_catalog;
ALTER ROLE sp_auth_runtime IN DATABASE sp_auth SET search_path = auth, pg_catalog;
ALTER ROLE sp_auth_backup IN DATABASE sp_auth SET search_path = auth, pg_catalog;
```

Después de migrar, ejecutar como `sp_auth_owner`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO sp_auth_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO sp_auth_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO sp_auth_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE sp_auth_owner IN SCHEMA auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sp_auth_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE sp_auth_owner IN SCHEMA auth
  GRANT USAGE, SELECT ON SEQUENCES TO sp_auth_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE sp_auth_owner IN SCHEMA auth
  GRANT SELECT ON TABLES TO sp_auth_backup;
```

Al cerrar la ventana: `ALTER ROLE sp_auth_migrator NOLOGIN;` y revocar su
membresía en `sp_auth_owner`. Un restore usa otro login temporal
`sp_auth_restore`, `NOINHERIT`, con membresía en `sp_auth_owner`, expiry
acotado y revocación al terminar. El owner nunca recibe login.

El proceso de migración asume el owner en cada conexión mediante un parámetro
de startup, no mediante un `SET ROLE` emitido en otra sesión:

```text
AUTH_DATABASE_URL="postgresql://sp_auth_migrator:<SECRET>@sp-auth-db:5432/sp_auth?options=-c%20role%3Dsp_auth_owner%20-c%20search_path%3Dauth%2Cpg_catalog"
npm run auth:migrate
```

Antes de migrar, una conexión con las mismas variables debe devolver
`current_user=sp_auth_owner`, `session_user=sp_auth_migrator` y
`search_path=auth,pg_catalog`. Una discrepancia detiene HG9.

La migración se genera con Better Auth 1.7.5 y los plugins fijados en el
lockfile. La configuración actual produce estas tablas lógicas:

```text
user
session
account
verification
jwks
oauthClient
oauthResource
oauthClientResource
oauthRefreshToken
oauthAccessToken
oauthConsent
oauthClientAssertion
```

`user` añade `source`, `campaign`, `content` y `leadMagnet`. El script actual
aplica la migración y solo imprime éxito. Para obtener evidencia exacta sin
depender de ese texto, ejecutar primero en una restauración desechable vacía:

```text
pg_dump --schema-only --no-owner --schema=auth sp_auth > before.sql
npm run auth:migrate
pg_dump --schema-only --no-owner --schema=auth sp_auth > after.sql
diff -u before.sql after.sql > migration.diff
```

Conservar `after.sql`, `migration.diff` y consultas a `pg_class`,
`information_schema.columns`, `pg_constraint` y `pg_indexes`. La revisión
aprueba ese diff exacto antes de repetir la migración live. No se mantiene una
copia SQL manual como autoridad.

### Migración, backup y restore

Orden obligatorio:

1. Crear roles, database y schema vacíos.
2. Ejecutar backup lógico y snapshot del volumen vacío como prueba del job.
3. Correr `npm run auth:migrate` con `sp_auth_migrator`.
4. Revocar el login temporal del migrator.
5. Conceder al runtime solo DML sobre los objetos resultantes.
6. Comparar el inventario con el schema esperado por el commit candidato.
7. Crear una cuenta sintética, verificarla, iniciar sesión y borrarla antes de
   datos reales.
8. Tomar backup postmigración, restaurarlo en una base desechable y repetir
   `select 1`, login y lectura de sesión.

No abrir tráfico si el restore no funciona. Las migraciones posteriores deben
ser expandibles y compatibles con el digest anterior. Ningún rollback de
imagen ejecuta downgrade de datos.

### OAuth client para Remark42

El cliente se crea después de migrar y antes de desplegar Remark42. Usar una
cuenta provisionadora temporal, verificada y marcada explícitamente mediante
`REMARK42_OAUTH_PROVISIONER_USER_ID`. Ejecutar
`npm run auth:remark42-client` una sola vez con su cookie de sesión temporal,
pero solo después de reparar ese script. Hoy vuelve a ejecutar migraciones y
escribe el secreto en stdout. La versión autorizable debe negarse si el schema
no coincide con el inventario aprobado, no ejecutar DDL y entregar el secreto
solo por el FIFO indicado por `REMARK42_OAUTH_SECRET_FIFO`. Stdout contiene
únicamente el client ID y una confirmación sin valores.

Contrato del cliente:

- Nombre: `Sociedad Paralela Remark42`.
- Tipo: confidential web client.
- Grant: `authorization_code`.
- Response type: `code`.
- Token auth: `client_secret_basic`.
- Scopes: `openid profile`.
- Redirect exacto:
  `https://sociedadparalela.com/comentarios/auth/sociedad-paralela/callback`.
- Consentimiento omitido para este cliente first-party.
- PKCE desactivado para el cliente confidencial actual.

### Protocolo efímero de handoff OAuth

El secreto nunca se escribe en un archivo regular ni debe sobrevivir al job
productor. HG18 crea el cliente y HG19 consume el secreto. Ambos gates usan
este protocolo exacto:

1. Antes de HG18, root monta un tmpfs de 64 KiB con
   `nodev,nosuid,noexec,mode=1770,uid=0,gid=10000` en
   `/run/sociedad-paralela/oauth-handoff/<HANDOFF_ID>`. `HANDOFF_ID` es un UUID
   no secreto registrado en la evidencia. El sticky bit impide que un job
   elimine entradas propiedad del otro. El productor corre como `10001:10001`,
   el consumidor como `10002:10002` y ambos tienen el GID suplementario `10000`
   solo para atravesar y escribir en este directorio acotado.
2. Dentro del tmpfs, root crea `client-secret.pipe` como FIFO
   `10001:10002 0640` y `result.pipe` como FIFO `10002:10001 0640`. Así el
   productor es propietario del FIFO que escribe y pertenece al grupo que puede
   leer el resultado; el consumidor es propietario del FIFO que escribe y
   pertenece al grupo que puede leer el secreto. Root crea también
   `binding-id` como archivo regular `0:10000 0440`, con un nonce hexadecimal
   aleatorio de 256 bits y no secreto. `ready.json` se publica por rename
   atómico como `10001:10000 0640`, no contiene secretos y registra client ID,
   PID productor, `HANDOFF_ID` y `HANDOFF_DEADLINE_EPOCH`. Fuera del temporal
   de ese rename, solo se permiten `binding-id`, ambos FIFO y `ready.json`.
3. Ambos jobs reciben exactamente el mismo bind source y target en modo
   read-write, sin excepción para el consumidor:

   ```text
   host:      /run/sociedad-paralela/oauth-handoff/<HANDOFF_ID>
   container: /run/sp-oauth-handoff
   ```

   Ningún manifiesto usa la ruta host desde dentro de un contenedor. No se
   comparan mount IDs entre namespaces. Antes de HG18, dos procesos de preflight
   ejecutados con las imágenes, UIDs, GIDs y mounts exactos de los jobs leen el
   mismo valor de `binding-id`; verifican con `stat` que el target es directorio
   `1770 0:10000`, que `client-secret.pipe` es FIFO `0640 10001:10002`, que
   `result.pipe` es FIFO `0640 10002:10001` y que `ready.json`, cuando exista,
   es archivo regular `0640 10001:10000`. Después hacen este round-trip no
   secreto: el proceso productor escribe `probe:<binding-id>\n` una vez en
   `client-secret.pipe`; el consumidor exige esa línea exacta y escribe
   `ack:<binding-id>\n` una vez en `result.pipe`; el productor exige ese ack.
   Ambos cierran los descriptores y salen 0. Cualquier valor, tipo, propietario,
   modo, línea, EOF, timeout o exit code diferente detiene el gate. Root vuelve
   a comprobar tipos, propietarios, modos y allowlist de entradas tras el probe.
   Los FIFO no conservan bytes cuando los procesos cierran; luego se inician los
   jobs reales sobre las mismas rutas. Esta identidad observada y el round-trip,
   no la igualdad de mount IDs, son la prueba de binding compartido.
4. `sp-oauth-provisioner` crea el cliente, conserva `client_secret` solo en
   memoria, escribe `ready.json` mediante rename atómico y queda bloqueado al
   abrir `client-secret.pipe` para escritura hasta que exista un lector. HG18
   termina con el productor vivo en `waiting-for-reader`, no con el job cerrado.
5. Después de aprobar HG19, root inicia `sp-oauth-secret-loader` con el
   entrypoint literal `/app/ops/start-coolify-secret-loader`. El launcher Node
   empaquetado valida `HANDOFF_DEADLINE_EPOCH`, abre `HANDOFF_FIFO` con
   `O_RDONLY|O_NONBLOCK` y entrega ese descriptor al loader como fd 3. El loader
   sondea fd 3 con el mismo deadline y el launcher aplica TERM seguido de KILL
   si el proceso no termina. Así no existe un `open(2)` bloqueante anterior al
   deadline cuando el productor desaparece. Solo el número de descriptor y la
   ruta no secreta aparecen en argv del loader. La operación equivalente es:

   ```sh
   open(HANDOFF_FIFO, O_RDONLY | O_NONBLOCK)
   spawn("/app/ops/sp-load-coolify-secret", [
     "--secret-fd", "3",
     "--result-fifo", HANDOFF_RESULT_FIFO
   ], { stdio: ["ignore", "inherit", "inherit", fifoFd] })
   ```

   El loader lee desde fd 3 exactamente una línea no vacía, rechaza NUL, EOF sin
   línea completa o datos después de la primera línea, y cierra fd 3. El secreto
   OAuth no entra en argv, environment, shell history, stdout, stderr ni archivo
   durable. Solo existe en memoria del productor, buffer de kernel del FIFO,
   memoria del consumidor y cuerpo TLS de la única request aprobada.
6. El consumidor construye en memoria una sola request
   `PATCH <COOLIFY_API_BASE_URL>/services/<COOLIFY_SERVICE_ID>/envs` con
   `Content-Type: application/json`, bearer token del secret store y este body:

   ```json
   {
     "key": "AUTH_CUSTOM_CSEC",
     "value": "<BYTES_READ_FROM_FD_3>",
     "is_preview": false,
     "is_literal": true,
     "is_multiline": false,
     "is_shown_once": true
   }
   ```

   `AUTH_CUSTOM_CSEC` debe existir vacío en el servicio detenido desde HG10.
   El consumidor no sigue redirects, no reintenta la mutación y acepta solo HTTP
   `201`, que es la respuesta documentada por Coolify para actualizar una
   variable de servicio. No imprime ni conserva el body de request o el campo
   `value`. La referencia normativa del endpoint es
   <https://coolify.io/docs/api/endpoints/services/update-env-by-service-uuid>.
7. Después de recibir `201`, el consumidor escribe el literal `ok\n` en
   `result.pipe`, borra sus buffers y sale 0. Ante cualquier error escribe
   `fail\n` cuando todavía puede hacerlo, borra buffers y sale distinto de cero.
   El productor escribe el secreto una sola vez, cierra el FIFO, borra su buffer
   y espera una única línea en `result.pipe` hasta el mismo deadline. Con `ok`,
   revoca la sesión provisionadora y sale 0. Con `fail`, EOF, timeout o señal,
   elimina el cliente recién creado, revoca la sesión y sale distinto de cero.
8. Root espera ambos estados terminales. El protocolo tiene éxito solo si los dos
   salen 0 y Coolify devuelve `201`. Entonces root confirma que el servicio sigue
   detenido y que la metadata de `AUTH_CUSTOM_CSEC` existe sin leer su valor.
   En éxito o fallo elimina `ready.json`, `binding-id` y ambos FIFO, desmonta el
   tmpfs y borra el directorio vacío. La evidencia contiene mount options,
   UIDs/GIDs, `stat`,
   el `binding-id` no secreto, transcript exacto del probe/ack, exit codes,
   service ID, nombre de variable, status HTTP y resultado del cleanup, nunca
   bodies, tokens ni valores secretos.

Configuración no secreta del consumidor:

- `COOLIFY_API_BASE_URL` es la URL HTTPS canónica de la instancia self-hosted,
  con path exacto `/api/v1` y sin slash final. Su fuente es el URL público de API
  configurado en la instancia Coolify existente. HG10 debe copiar el valor
  literal a la definición detenida del job y registrarlo en el diff aprobado.
  No se deriva de headers, DNS de aplicación ni input del productor.
- Antes de HG18, el preflight analiza esa URL y exige `https`, host no vacío,
  ausencia de userinfo, query y fragment, y path exacto `/api/v1`. No sigue
  redirects. `GET <COOLIFY_API_BASE_URL>/version` con el token del consumidor
  debe devolver `200`, un string de versión no vacío y un certificado válido
  para el host aprobado. La referencia del base URL y del endpoint de versión
  es <https://coolify.io/docs/api/overview>.
- `COOLIFY_SERVICE_ID` viene del recurso detenido `sp-remark42` creado en HG10.
  Debe ser idéntico al UUID registrado en el diff aprobado. El loader rechaza
  otro ID, otra base URL, otra variable, un redirect y cualquier método o path
  distinto de `PATCH /api/v1/services/<COOLIFY_SERVICE_ID>/envs`.

Precondiciones del protocolo:

- La reparación local fija el productor en UID/GID `10001:10001`, el consumidor
  en `10002:10002` y el grupo suplementario de handoff en GID `10000`; empaqueta
  ambos ejecutables auditados y prueba que ningún output contiene el secreto.
- El hash del consumidor, `COOLIFY_API_BASE_URL`, service ID y job definition
  exactos se aprueban antes de HG18. El consumidor no puede crear servicios,
  iniciar contenedores ni cambiar otra variable.
- Si no aparece lector antes de `HANDOFF_DEADLINE_EPOCH`, el productor elimina
  el cliente recién creado, revoca la sesión, borra memoria y sale distinto de
  cero. Si la eliminación falla, el rollout se detiene con el client ID para
  remediación humana.
- Si el consumidor lee el secreto pero no obtiene `201`, ambos procesos limpian
  memoria, el productor elimina el cliente y se repite HG18. Nunca se solicita
  un segundo secreto para el cliente huérfano.
- Un reboot, pérdida del mount, fallo del binding-id o del round-trip, tipo,
  ownership o modo distinto, entrada inesperada, output no redactado, productor
  terminado antes del consumo o imposibilidad de eliminar el cliente bloquea
  HG19.

Cerrar las sesiones del provisionador, vaciar sus variables temporales y
retirar el privilegio de crear clientes sigue siendo obligatorio.

## Etapa 3. Resend

### Dominio y DNS

Verificar `correo.sociedadparalela.com` en la cuenta Resend autorizada. El
owner debe copiar exactamente los registros que Resend entregue. No reemplazar
registros de correo existentes sin una revisión de conflicto.

La evidencia debe contener nombres, tipos, targets, TTL y estado verificado,
pero nunca la API key. Exigir SPF y DKIM válidos. La consulta read-only no
encontró DMARC publicado para el dominio principal ni el subdominio. Proponer
este registro exacto para aprobación inicial:

```text
TXT _dmarc.correo.sociedadparalela.com
"v=DMARC1; p=none; adkim=s; aspf=s; pct=100"
```

No añadir `rua` hasta que el owner nombre y verifique un buzón receptor. Cambiar
`p` a `quarantine` o `reject` necesita evidencia de alineación y otro gate.

Contrato de envío:

- From: `Sociedad Paralela <cuentas@correo.sociedadparalela.com>`.
- Solo verificación de cuenta y reset de password.
- Tracking de apertura desactivado.
- Tracking de clic desactivado. Los links sensibles no pasan por redirects de
  tracking.
- Sin listas, marketing, broadcasts ni contactos en este P0.
- La API key queda restringida al dominio o aplicación cuando Resend permita
  ese alcance.

Secretos server-only:

```text
EMAIL_TRANSPORT=resend
RESEND_API_KEY=<secret-store-only>
EMAIL_FROM=Sociedad Paralela <cuentas@correo.sociedadparalela.com>
```

Allowlist de URLs salientes en mensajes:

- Origen exacto `https://sociedadparalela.com`.
- Verificación bajo `/api/auth/verify-email`.
- Reset con callback visible bajo `/restablecer` y endpoint Better Auth
  correspondiente bajo `/api/auth`.
- Sin `localhost`, IP, preview domain, query externa ni esquema distinto de
  HTTPS.

Allowlist de callbacks recibidos por Better Auth:

- `BETTER_AUTH_URL=https://sociedadparalela.com`.
- `trustedOrigins` contiene solo ese origen para producción.
- No se habilitan wildcard origins.

Aceptación de entrega:

1. Enviar verificación y reset a dos buzones de prueba controlados en
   proveedores distintos.
2. Confirmar entrega, From, DKIM, SPF, DMARC, asunto y texto plano/HTML.
3. Confirmar que cada link usa el origen final, funciona una vez y expira.
4. Confirmar que registro y reset mantienen respuestas genéricas.
5. Confirmar que no hay pixel ni link de tracking.
6. Revisar logs por ID de mensaje y resultado, sin email completo, URL sensible
   ni token.

## Etapa 4. Remark42 v1.16.4

### Imagen, ruta y persistencia

El release fijado es `ghcr.io/umputun/remark42:v1.16.4`. Para Linux amd64, la
inspección read-only del manifiesto devolvió el digest de plataforma:

```text
ghcr.io/umputun/remark42@sha256:fa145a0d71eb41d9b08a47a98a009bc3fa8d9a631297309743d1139db5fcc08f
```

Antes del deploy, confirmar que `neo4j` es amd64 y volver a resolver el tag. Si
el digest difiere, detenerse. El volumen persistente monta `/srv/var` y entra
en el backup diario con restauración probada.

Astro publica Remark42 solo mediante el proxy del mismo origen:

- URL pública: `https://sociedadparalela.com/comentarios`.
- URL interna: `http://sp-remark42:8080`.
- Traefik no enruta al contenedor Remark42 de forma directa.
- El proxy elimina `Authorization`, cookies de Better Auth y cookies ajenas.
- Solo `JWT` y `XSRF-TOKEN` cruzan la frontera.
- Las cookies de respuesta pierden `Domain` y quedan en
  `Path=/comentarios`.

### Variables del servidor Remark42

```text
REMARK_URL=https://sociedadparalela.com/comentarios
SITE=sociedad-paralela
SECRET=<same-value-as-astro-REMARK42_SECRET>
AUTH_ANON=false
AUTH_CUSTOM_NAME=sociedad-paralela
AUTH_CUSTOM_CID=<oauth-client-id>
AUTH_CUSTOM_CSEC=<oauth-client-secret>
AUTH_CUSTOM_AUTH_URL=https://sociedadparalela.com/api/auth/oauth2/authorize
AUTH_CUSTOM_TOKEN_URL=https://sociedadparalela.com/api/auth/oauth2/token
AUTH_CUSTOM_INFO_URL=https://sociedadparalela.com/api/auth/oauth2/userinfo
AUTH_CUSTOM_SCOPES=openid,profile
AUTH_CUSTOM_ID_FIELD=sub
AUTH_CUSTOM_NAME_FIELD=name
AUTH_CUSTOM_PICTURE_FIELD=picture
```

`AUTH_DEV` no existe y el login anónimo permanece desactivado.

### Variables de Astro

```text
REMARK42_URL=https://sociedadparalela.com/comentarios
REMARK42_INTERNAL_URL=http://sp-remark42:8080
REMARK42_SITE_ID=sociedad-paralela
REMARK42_PROVIDER_NAME=sociedad-paralela
REMARK42_SECRET=<shared-secret>
REMARK42_PROXY_TIMEOUT_MS=5000
REMARK42_OAUTH_CLIENT_ID=<oauth-client-id>
REMARK42_OAUTH_CLIENT_SECRET=<oauth-client-secret>
```

El JWT SSO usa HS256, `iss=remark42`, `aud=sociedad-paralela`,
`user.aud=sociedad-paralela`, `user.id=sp_<better-auth-id>`, nombre visible,
`iat`, expiración a cinco minutos y `jti`. No contiene email.

### Coordinación y rotación de secretos

Astro y Remark42 deben recibir el mismo `REMARK42_SECRET` en una sola ventana.
La versión v1.16.4 no ofrece doble secreto para una rotación sin corte. La
rotación exige:

1. Desactivar temporalmente el botón de comentarios o dejar el proxy en 503.
2. Actualizar el secreto en ambos servicios sin mostrar su valor.
3. Reiniciar Remark42 y después Astro.
4. Invalidar los JWT SSO anteriores y esperar como máximo cinco minutos.
5. Repetir el smoke test de usuario verificado.

Rotar el secreto OAuth mediante un cliente de reemplazo con el mismo redirect.
Cargar el nuevo par en Remark42 durante una pausa, probar callback y revocar el
cliente anterior. Este procedimiento no depende de soporte para dos secretos
en un mismo cliente.

Backup aceptado: snapshot del volumen más archivo verificable fuera del host.
Restore aceptado: montar una copia en un contenedor aislado con la misma
versión, responder `/ping`, listar el hilo de prueba y conservar autor y texto.

## Etapa 5. Coolify, Traefik, DNS y TLS

### Manifiesto de variables no secretas

HG10 no puede aprobar definiciones Coolify hasta que su diff contenga este
inventario exacto. Una variable no listada bloquea el start. Los valores secretos
se cargan solo en sus Human Gates y no aparecen en este manifiesto.

`sp-astro`:

```text
NODE_ENV=production
PUBLIC_APP_URL=https://sociedadparalela.com
BETTER_AUTH_URL=https://sociedadparalela.com
EMAIL_TRANSPORT=resend
EMAIL_FROM=Sociedad Paralela <cuentas@correo.sociedadparalela.com>
CONTROL_PLANE_MODE=directus
CONTROL_PLANE_BASE_URL=https://aos.markenetica.com
CONTROL_PLANE_TIMEOUT_MS=2500
REMARK42_URL=https://sociedadparalela.com/comentarios
REMARK42_INTERNAL_URL=http://sp-remark42:8080
REMARK42_SITE_ID=sociedad-paralela
REMARK42_PROVIDER_NAME=sociedad-paralela
REMARK42_PROXY_TIMEOUT_MS=5000
```

`sp-remark42`:

```text
REMARK_URL=https://sociedadparalela.com/comentarios
SITE=sociedad-paralela
AUTH_ANON=false
AUTH_CUSTOM_NAME=sociedad-paralela
AUTH_CUSTOM_CID=<CLIENT_ID_FROM_HG18>
AUTH_CUSTOM_AUTH_URL=https://sociedadparalela.com/api/auth/oauth2/authorize
AUTH_CUSTOM_TOKEN_URL=https://sociedadparalela.com/api/auth/oauth2/token
AUTH_CUSTOM_INFO_URL=https://sociedadparalela.com/api/auth/oauth2/userinfo
AUTH_CUSTOM_SCOPES=openid,profile
AUTH_CUSTOM_ID_FIELD=sub
AUTH_CUSTOM_NAME_FIELD=name
AUTH_CUSTOM_PICTURE_FIELD=picture
```

`sp-auth-db`:

```text
POSTGRES_DB=sp_auth
POSTGRES_USER=<BOOTSTRAP_ROLE_FROM_HG9>
PGDATA=/var/lib/postgresql/data
```

`sp-oauth-provisioner`:

```text
NODE_ENV=production
BETTER_AUTH_URL=https://sociedadparalela.com
REMARK42_URL=https://sociedadparalela.com/comentarios
REMARK42_PROVIDER_NAME=sociedad-paralela
REMARK42_OAUTH_PROVISIONER_USER_ID=<USER_ID_FROM_HG17>
REMARK42_OAUTH_SECRET_FIFO=/run/sp-oauth-handoff/client-secret.pipe
REMARK42_OAUTH_RESULT_FIFO=/run/sp-oauth-handoff/result.pipe
HANDOFF_ID=<UUID_FROM_HG18>
HANDOFF_DEADLINE_EPOCH=<APPROVED_EPOCH_FROM_HG18>
HANDOFF_SHARED_GID=10000
```

Job consumidor `sp-oauth-secret-loader`:

```text
COOLIFY_API_BASE_URL=https://<COOLIFY_MANAGEMENT_FQDN_FROM_HG10>/api/v1
COOLIFY_SERVICE_ID=<SP_REMARK42_SERVICE_ID_FROM_HG10>
COOLIFY_APPROVED_API_BASE_URL=https://<COOLIFY_MANAGEMENT_FQDN_FROM_HG10>/api/v1
COOLIFY_APPROVED_SERVICE_ID=<SP_REMARK42_SERVICE_ID_FROM_HG10>
COOLIFY_API_TOKEN=<PROTECTED_SECRET_STORE_INJECTION>
HANDOFF_FIFO=/run/sp-oauth-handoff/client-secret.pipe
HANDOFF_RESULT_FIFO=/run/sp-oauth-handoff/result.pipe
HANDOFF_DEADLINE_EPOCH=<APPROVED_EPOCH_FROM_HG18>
```

HG10 debe sustituir ambas variables de base URL y ambas variables de service ID
por los mismos valores literales aprobados. El loader rechaza cualquier
divergencia antes de leer o enviar el secreto. `COOLIFY_API_TOKEN` se inyecta
solo desde el secret store del job consumidor y nunca aparece en el diff,
stdout, evidencia o productor. La notación anterior identifica la fuente y no
es válida para iniciar el job. El entrypoint exacto es
`/app/ops/start-coolify-secret-loader`.
El productor y el consumidor usan la ruta interna `/run/sp-oauth-handoff` y el
mismo bind source host. No se permite otra combinación.

Job de migración:

```text
PGOPTIONS=-c role=sp_auth_owner -c search_path=auth,pg_catalog
```

Secretos de `sp-astro`: `BETTER_AUTH_SECRET`, `AUTH_DATABASE_URL`,
`RESEND_API_KEY`, `CONTROL_PLANE_TOKEN`, `REMARK42_SECRET` y
ningún client secret OAuth. Secretos de `sp-remark42`: `SECRET` y
`AUTH_CUSTOM_CSEC`. Secretos del job OAuth: `AUTH_DATABASE_URL`,
`BETTER_AUTH_SECRET` y `REMARK42_OAUTH_PROVISIONER_SESSION_COOKIE`. PostgreSQL
recibe su password de bootstrap fuera del manifiesto. El consumidor usa un
token API Coolify inyectado solo al job consumidor y nunca al productor. Los
placeholders de client ID, user ID, IDs de servicio y rol bootstrap deben
resolverse antes del gate que inicia el servicio correspondiente.

### Imágenes y despliegue oscuro

- El Dockerfile actual usa el tag mutable `node:22.22.1-alpine3.22` en dos
  stages. Antes de congelar el candidato debe cambiar ambos `FROM` al digest
  Linux amd64 observado en la inspección read-only:
  `node@sha256:764fa18a0649c8682db1a580ce075d8662b6fb0eb2f05221af2d13f2ff43c383`.
- Construir Astro desde el commit reparado y registrar
  `<ASTRO_IMAGE_DIGEST>` en la evidencia. Coolify despliega ese digest, nunca
  `latest` o un tag de rama.
- La construcción produce un archivo OCI y metadata sin publicar:
  `docker buildx build --platform linux/amd64 --output type=oci,dest=<ASTRO_OCI_ARCHIVE> --metadata-file <ASTRO_METADATA_JSON> .`.
  `containerimage.digest` de la metadata es el valor aprobado. HG5 copia ese
  archivo a un registry existente mediante `skopeo copy`; no reconstruye.
- Usar el digest de Remark42 validado para la arquitectura del host.
- Para Linux amd64, fijar PostgreSQL como
  `postgres@sha256:747d5ed1fdeeb124b880fbe3d7c6557d2c4064ae41d6b6297d417882effce4be`.
- Volver a resolver los tres tags durante el gate. Cualquier digest distinto
  exige nueva revisión. No actualizarlo por conveniencia dentro del gate.
- Aplicar los límites de CPU y memoria de la tabla de topología. El límite de
  PostgreSQL necesita aprobación explícita en su gate.
- Mantener los servicios en una red `sp-p0` interna. Solo Astro se conecta a la
  red de ingress de Traefik.
- No publicar puertos con Docker. No crear reglas de firewall públicas.

Health y readiness:

| Servicio | Liveness | Readiness |
|---|---|---|
| Astro | `GET /api/health` devuelve 200 | `GET /api/readiness` devuelve 200 y prueba PostgreSQL |
| Remark42 | `GET /ping` interno devuelve 200 | Proxy `/comentarios/ping` responde por el origen final |
| PostgreSQL | `pg_isready` interno | `select 1` con `sp_auth_runtime` |

La readiness actual de Astro solo prueba PostgreSQL. Directus, Resend y
Remark42 se validan en smoke tests y no deben convertir una caída externa en
una caída de las páginas públicas prerenderizadas.

El smoke de recursos dura 10 minutos con 10 sesiones concurrentes que alternan
landing, login, comunidad y carga de un hilo. Se detiene si cualquier co-tenant
cambia de healthy a unhealthy, si aparece swap sostenido o si un servicio
supera 80 por ciento de su CPU o RAM asignada durante 2 minutos consecutivos.

Logs:

- Retención inicial de 14 días, con rotación y tope por servicio.
- No registrar cookies, headers Authorization, passwords, tokens, URLs de
  verificación/reset, API keys, secretos ni cuerpos completos de email.
- Usar request ID, tipo de operación, status y duración.
- Acceso restringido al owner operativo.

Backups:

- PostgreSQL: backup lógico diario y snapshot del volumen antes de cada
  migración. Restore mensual en destino aislado.
- Remark42: snapshot diario de `/srv/var` y restore mensual aislado.
- Configuración Coolify y lista de variables: export sin valores secretos.
- Directus conserva su runbook y backup de AOS. No se mezcla con los backups de
  `neo4j`.

Traefik, DNS y TLS:

1. Crear el router para `sociedadparalela.com` hacia Astro, sin activar DNS.
2. Limitar body size, header timeout, response timeout y rate limits para las
   rutas de cuenta.
3. Probar el router mediante resolución local o hostname temporal interno.
4. Al menos 24 horas antes del cutover, bajar a 300 segundos el TTL del registro
   existente que se va a reemplazar. Si Cloudflare no expone un registro apex
   dedicado, documentar el ID y valor exactos que controla el proxy.
5. Añadir DNS solo en la etapa de tráfico. No reemplazar otro registro sin
   exportarlo primero. El gate de publicación queda incompleto hasta registrar
   `<DNS_RECORD_ID>`, `<BEFORE_VALUE>` y `<NEO4J_INGRESS_VALUE>`.
6. Exigir certificado válido para el hostname final, redirección HTTP a HTTPS
   y HSTS solo después de confirmar que el rollback HTTPS funciona.

## Cutover ordenado

Cada paso produce evidencia y tiene una aprobación independiente cuando
implica una mutación distinta.

1. Reparar localmente el `409` idempotente, invalidación inmediata de comentarios
   tras logout/reset, productor/consumidor OAuth y los dos `FROM` de Node.
   Ejecutar pruebas enfocadas, `npm run gate` y verificación independiente.
2. Congelar el commit candidato. Construir Astro como archivo OCI y registrar
   su manifest digest junto con los digests de Remark42 y PostgreSQL.
3. Copiar el archivo OCI al repositorio aprobado sin reconstruir y confirmar
   que el digest remoto coincide.
4. Generar el dry-run de Directus. Revisar schema, payload de política, todas
   las políticas efectivas y la matriz negativa por colección.
5. Aplicar solo el schema `sp_members` y sus constraints.
6. Crear solo la identidad y política Directus. El token sigue sin generarse.
7. Crear el servicio PostgreSQL oscuro con volumen, red, límite y healthcheck.
8. Crear roles, database y schema. Migrar primero en una restauración
   desechable, aprobar el diff y repetir live. Probar backup y restore.
9. Crear las definiciones Coolify de Astro, Remark42 y los dos jobs OAuth.
   Conectarlos a la red `sp-p0` existente y crear volúmenes, sin secretos, sin
   iniciar y sin ingress.
10. Aplicar y verificar los registros DNS de `correo.sociedadparalela.com`.
11. Generar el token Directus y cargar solo `CONTROL_PLANE_TOKEN`.
12. Crear la key Resend y cargar solo `RESEND_API_KEY` y `EMAIL_FROM`.
13. Cargar `BETTER_AUTH_SECRET` y las credenciales de `sp_auth_runtime`.
14. Iniciar solo Astro en modo oscuro, con comentarios no configurados.
15. Configurar Traefik y TLS con resolución controlada y allowlist de la IP del
    owner, sin cambiar el registro DNS de tráfico general.
16. Crear y verificar la identidad provisionadora por ese origen controlado y
    capturar su sesión en tmpfs.
17. Ejecutar `sp-oauth-provisioner`, crear el cliente y dejar el productor vivo
    esperando el FIFO del tmpfs host compartido, sin stdout ni logs sensibles.
18. Iniciar el consumidor separado, transferir el client secret una vez por FIFO,
    exigir status `201` y ack `ok`, cargar el secreto SSO, limpiar buffers y
    desmontar tmpfs.
19. Iniciar Remark42 y reiniciar Astro en modo oscuro. Ejecutar health,
    readiness, backups y restores, sin hostname público.
20. Con el runtime en el origen final controlado, ejecutar la aceptación Resend
    de cuatro mensajes y después toda la matriz de smoke tests.
21. Ejecutar el fail-closed mediante reemplazo reversible del secret version de
    `CONTROL_PLANE_TOKEN`, restaurarlo y repetir health.
22. Completar `<DNS_RECORD_ID>`, `<BEFORE_VALUE>` y
    `<NEO4J_INGRESS_VALUE>`. Aprobar el cambio DNS exacto.
23. Bajar solo el TTL de ese registro a 300, conservando `<BEFORE_VALUE>`, y
    esperar al menos 24 horas.
24. Retirar la allowlist del router y probar desde una segunda red mediante
    resolución explícita al ingress, sin cambiar DNS. Restaurar la allowlist si
    falla cualquier check.
25. Publicar cambiando solo el target del registro. El router ya está abierto y
    no cambia dentro de este gate.
26. Repetir smoke tests desde Internet. Observar errores, CPU, RAM, disco y
    latencia durante la ventana de 10 minutos.

## Smoke tests acotados

Usar una cuenta sintética que se pueda eliminar. No usar una cuenta personal ni
datos de un miembro real.

| Caso | Acción | Resultado requerido |
|---|---|---|
| Anónimo | Abrir `/comunidad` y `/api/remark42/sso` | Login requerido. No JWT ni identidad de comentario |
| No verificado | Registrar sin consumir el link y abrir comunidad | Verificación requerida. No fila activa ni comentario |
| Miembro verificado | Verificar, iniciar sesión y abrir comunidad | Una fila `sp_members`, acceso, MDX y sesión persistente |
| Idempotencia | Lanzar dos autorizaciones concurrentes | Una fila por `auth_subject`; ambas terminan sin error |
| Fallo cerrado | Ejecutar el reemplazo reversible de secret version del gate dedicado | Comunidad protegida no concede acceso. Landing pública sigue disponible. El token anterior se restaura |
| Comentario | Entrar a `/comentarios`, publicar y recargar | Misma identidad, nombre visible, email ausente, comentario persistente |
| Logout | Publicar control, guardar jar, cerrar sesión y reintentar escritura/SSO con el jar anterior | Cookies Better Auth/JWT/XSRF expirados; escritura 401/403 sin upstream; SSO 403 sin handoff |
| Reset | Desde dos browsers, emitir cookies de comentarios, cambiar clave y reusar ambos jars | Sesiones anteriores revocadas; escritura 401/403 sin upstream; cookies Remark42 expiradas en siguiente request; SSO 403 |
| Resend | Verificación y reset a dos buzones | Autenticación de dominio válida, sin tracking, links HTTPS finales |
| Recuperación | Restaurar backups aislados | Login de prueba y comentario de prueba presentes |

La matriz negativa debe recorrer cada colección del snapshot distinta de
`sp_members` y registrar ausencia de permisos efectivos más GET 401/403. Las
ocho colecciones system nombradas en la etapa Directus son obligatorias. No
crear, editar ni borrar recursos para probar el deny en live.

## Stop conditions y rollback

Detener el cutover y no habilitar tráfico ante:

- cualquier permiso efectivo fuera de `sp_members`;
- más de una fila por sujeto o email normalizado;
- una migración no repetible o un restore fallido;
- email sin SPF/DKIM/DMARC aceptables, con tracking o con origen incorrecto;
- redirect OAuth distinto del allowlist;
- email, token o cookie de Better Auth visible en Remark42;
- puerto público, imagen mutable o healthcheck rojo;
- falta de TLS válido;
- error en anonymous, unverified, fail-closed, logout o reset;
- cualquier escritura Remark42 aceptada después de logout/reset o cualquier
  request denegado que conserve `JWT`/`XSRF-TOKEN`;
- degradación de salud de WordPress, MariaDB o Buzz;
- uso sostenido por encima de 80 por ciento del límite de memoria o CPU de un
  servicio durante el smoke test;
- pérdida de logs, backups o ruta de rollback.

Triggers de rollback después de abrir tráfico:

- tasa de errores 5xx superior a 2 por ciento en 10 minutos con al menos 50
  requests;
- tres fallos consecutivos de health o readiness;
- concesión de acceso sin verificación o con Directus no disponible;
- fallo de login, reset o logout reproducido en dos intentos;
- publicación o reautenticación de comentarios después de logout/reset;
- fuga de secreto, token, email o cookie en logs o respuestas;
- corrupción o pérdida de comentarios;
- presión de recursos que afecte un co-tenant.

Orden de rollback:

1. Desactivar registro y comentarios. Mantener landing y posts estáticos cuando
   sea seguro.
2. Retirar el router o DNS nuevo si el error afecta todo el origen.
3. Volver al digest anterior de Astro o Remark42 sin rebuild.
4. Revocar `CONTROL_PLANE_TOKEN`, API key Resend y cliente OAuth solo si existe
   exposición o abuso. No rotar secretos sanos durante un incidente no
   relacionado.
5. No ejecutar downgrade automático de PostgreSQL ni borrar `sp_members`.
6. Restaurar datos solo si existe evidencia de corrupción y una autorización
   humana específica.
7. Exigir health verde y repetir anonymous, verified, fail-closed, comment y
   logout antes de reabrir.

En el primer despliegue no existe un digest anterior de Astro. Su rollback
exacto es detener `sp-astro` y `sp-remark42`, restaurar el registro DNS
`<BEFORE_VALUE>` y desactivar el router nuevo. PostgreSQL y volúmenes quedan
preservados para diagnóstico. La aprobación de publicación es inválida mientras
`<BEFORE_VALUE>` no esté registrado y probado.

## Human Gates

### HG1. Reparación local de idempotencia

- Mutación exacta: corregir el adapter para releer `sp_members` después de un
  conflicto único y añadir una prueba concurrente.
- Acción del owner: autorizar una tarjeta local separada y revisar su diff.
- Evidencia: prueba enfocada roja/verde, `npm run gate` y verificación
  independiente.
- No autoriza: Directus live, secretos, infraestructura, deploy o tráfico.

### HG2. Invalidación local de comentarios

- Mutación exacta: hacer que logout y reset expiren `JWT`/`XSRF-TOKEN` bajo
  `/comentarios`, y exigir sesión Better Auth activa antes de que el proxy
  reenvíe autenticación o escrituras a Remark42.
- Acción del owner: autorizar una tarjeta local separada y revisar handlers,
  proxy y pruebas sin aceptar una espera de cinco minutos como invalidación.
- Evidencia: prueba enfocada con cookie jar real para logout y reset, upstream no
  invocado, expiraciones correctas, SSO 403, lectura pública conservada,
  `npm run gate` y verificación independiente.
- No autoriza: Remark42 live, secretos, infraestructura, deploy o tráfico.

### HG3. Reparación local del provisionador OAuth

- Mutación exacta: quitar `runMigrations()` del provisionador, exigir schema
  aprobado, impedir secretos en stdout y entregar el client secret solo al FIFO
  `REMARK42_OAUTH_SECRET_FIFO`. Fijar productor `10001:10001`, consumidor
  `10002:10002` y grupo suplementario de handoff `10000`. Empaquetar productor
  y consumidor `sp-load-coolify-secret`; el consumidor acepta el
  secreto solo por fd 3 y puede escribir únicamente `AUTH_CUSTOM_CSEC` del
  service ID aprobado mediante el endpoint `PATCH /api/v1/services/{uuid}/envs`.
  Debe emitir `ok`/`fail` por el FIFO de resultado. El Dockerfile copia el script
  y módulos server-side a `/app/ops/` sin exponerlos como endpoint HTTP.
- Acción del owner: autorizar una tarjeta local separada y revisar el diff.
- Evidencia: prueba que falle si intenta DDL, prueba de stdout redactado,
  prueba productor/consumidor con ambos FIFO, fd 3, timeout y cleanup en éxito y
  fallo, permisos/mounts efímeros, allowlist de endpoint/service/variable,
  inspección de imagen, comando de job,
  `npm run gate` y verificación independiente.
- No autoriza: crear clientes live, generar secretos, deploy o tráfico.

### HG4. Pin local de la imagen base Astro

- Mutación exacta: reemplazar ambos `FROM node:22.22.1-alpine3.22` por el digest
  Linux amd64 documentado y reconstruir el candidato.
- Acción del owner: autorizar el cambio local y aprobar el digest resultante de
  Astro.
- Evidencia: Dockerfile, SBOM, digest de imagen y gate local verificado.
- No autoriza: publicar imagen, crear servicios, secretos o tráfico.

### HG5. Promoción inmutable de la imagen Astro

- Mutación exacta: copiar el archivo OCI aprobado a
  `<REGISTRY_REPOSITORY>:<CANDIDATE_ID>` mediante `skopeo copy`, sin rebuild.
  El repositorio y candidate ID deben sustituirse por valores reales al aprobar.
- Acción del owner: autorizar el repositorio existente y la copia exacta.
- Evidencia: digest OCI local, digest remoto idéntico y escaneo del manifiesto.
- No autoriza: crear registry, desplegar la imagen, Coolify, DNS o tráfico.

### HG6. Schema Directus

- Mutación exacta: crear solo `sp_members`, campos, checks, primary key e
  índices únicos definidos en este paquete.
- Acción del owner: aprobar el diff dry-run del schema y ejecutar o supervisar
  su aplicación en AOS.
- Evidencia: snapshot previo, diff aplicado, introspección PostgreSQL y plan
  inverso con colección aún vacía.
- No autoriza: identidad, política, token, otras colecciones, settings globales
  o deploy.

### HG7. Identidad y política Directus

- Mutación exacta: crear `sp_astro_p0` sin token y adjuntar solo las dos filas
  de permiso del payload aprobado.
- Acción del owner: revisar todas las políticas efectivas y aplicar identidad y
  política.
- Evidencia: payload resuelto, fields, presets, validation y matriz de ausencia
  de permisos por cada colección distinta de `sp_members`.
- No autoriza: generar token, cambiar schema, cargar secretos, deploy o tráfico.

### HG8. Servicio PostgreSQL oscuro

- Mutación exacta: crear en Coolify la red privada `sp-p0` y solo `sp-auth-db`
  conectado a ella, con volumen, digest fijado, 1 vCPU, 1 GiB RAM y sin puerto
  publicado.
- Acción del owner: aprobar el límite y ejecutar o supervisar la creación.
- Evidencia: digest, config redactada, `pg_isready`, límites y snapshot del
  volumen vacío.
- No autoriza: database/schema, roles, migración, otros servicios o ingress.

### HG9. Roles, schema y migración Better Auth

- Mutación exacta: ejecutar el DDL de roles/database/schema y el diff Better
  Auth aprobado dentro de `sp-auth-db`.
- Acción del owner: aprobar `after.sql`, `migration.diff`, expiry del migrator y
  operador temporal de restore.
- Evidencia: grants, default privileges, inventario pre/post, backup, restore
  aislado y revocación de logins temporales.
- No autoriza: OAuth client, secretos de aplicación, otros servicios, DNS o
  tráfico.

### HG10. Definiciones Coolify de Astro y Remark42

- Mutación exacta: crear `sp-astro`, `sp-remark42` y los jobs detenidos
  `sp-oauth-provisioner`/`sp-oauth-secret-loader` desde el mismo digest Astro;
  conectarlos a `sp-p0` ya existente y crear volúmenes, límites, healthchecks,
  logs y backups, sin secretos y sin iniciar. Crear `AUTH_CUSTOM_CSEC` vacío en
  la definición detenida de `sp-remark42` para que HG19 use PATCH, no POST.
- Acción del owner: aprobar la configuración redactada y crear los recursos.
- Evidencia: servicios/jobs detenidos, puertos no publicados, red, mounts y
  comandos de productor/consumidor exactos. El diff resuelve
  `COOLIFY_API_BASE_URL`, service UUID, bind source host y target interno común
  en modo read-write para ambos jobs, UIDs/GIDs separados y modos direccionales
  de los FIFO; el preflight de `/version` cumple el predicado del protocolo.
- No autoriza: cargar secretos, iniciar contenedores, Traefik, DNS o tráfico.

### HG11. Dominio de correo Resend

- Mutación exacta: añadir los registros DNS entregados por Resend para
  `correo.sociedadparalela.com` y verificar el dominio.
- Acción del owner: aprobar cada registro y aplicarlo en el proveedor DNS.
- Evidencia: tabla before/after, verificación SPF/DKIM/DMARC y ausencia de
  conflicto con correo existente.
- No autoriza: crear API key, cargar secretos, enviar a usuarios, deploy o
  publicación.

### HG12. Token Directus de Astro

- Mutación exacta: generar el token de `sp_astro_p0` y cargarlo como
  `CONTROL_PLANE_TOKEN` en el secret store detenido de `sp-astro`.
- Acción del owner: custodiar el valor y confirmar que ninguna salida lo
  contiene.
- Evidencia: identidad del token, fecha de rotación, hash redactado y escaneo de
  logs/config exportada sin valor.
- No autoriza: otros secretos, iniciar Astro, deploy, DNS o tráfico.

### HG13. API key Resend

- Mutación exacta: crear una API key restringida al dominio de correo y cargar
  `RESEND_API_KEY` y `EMAIL_FROM` en el secret store detenido de `sp-astro`.
- Acción del owner: crear y custodiar la key.
- Evidencia: metadata de alcance sin valor y escaneo de logs/config exportada.
- No autoriza: enviar mensajes, campañas, contactos, otros secretos, iniciar
  servicios o tráfico.

### HG14. Secretos Better Auth y PostgreSQL

- Mutación exacta: generar `BETTER_AUTH_SECRET`, credenciales de
  `sp_auth_runtime` y cargar `AUTH_DATABASE_URL` en `sp-astro`.
- Acción del owner: custodiar valores y confirmar grants del rol runtime.
- Evidencia: nombres/versions de secretos, prueba de conexión con DML permitido
  y DDL denegado, sin valores en logs.
- No autoriza: secretos Remark42, iniciar servicios, Traefik, DNS o tráfico.

### HG15. Inicio oscuro de Astro

- Mutación exacta: iniciar solo `sp-astro` contra `sp-auth-db`, sin variables
  Remark42 y sin ingress. Los comentarios deben quedar en estado no configurado.
- Acción del owner: ejecutar el start y observar health/readiness.
- Evidencia: health 200, readiness 200, comentarios 503 fail-closed y logs
  redactados.
- No autoriza: crear identidades, enviar email, iniciar Remark42, Traefik, DNS o
  tráfico.

### HG16. Traefik y TLS controlados

- Mutación exacta: crear el router de `sociedadparalela.com` hacia Astro,
  emitir TLS por DNS-01 y aplicar una allowlist con la IP actual del owner. El
  DNS de tráfico general no cambia.
- Acción del owner: aprobar host, IP allowlist, middlewares y certificado.
- Evidencia: config diff, TLS válido desde la IP permitida, 403 desde una IP no
  permitida y redirect HTTPS.
- No autoriza: cambiar DNS, retirar la allowlist, recibir tráfico general ni
  anunciar apertura.

### HG17. Identidad provisionadora OAuth

- Mutación exacta: crear una cuenta dedicada `sp-oauth-owner`, enviarle una sola
  verificación, verificarla, iniciar sesión y guardar user ID y cookie solo en
  tmpfs `0600` durante la ventana de provisioning. Todo el recorrido usa el
  origen HTTPS de HG16 desde la IP allowlisted del owner.
- Acción del owner: nombrar el buzón controlado, autorizar ese único email y
  custodiar la sesión temporal.
- Evidencia: user ID, email verificado, sesión fresca, un ID de entrega redactado
  y tmpfs sin exposición. La cuenta se conserva como owner referenciado del
  cliente, pero al terminar se revocan sesiones y se vacían las variables de
  privilegio.
- No autoriza: crear el cliente OAuth, cargar secretos Remark42, otros emails,
  cambiar Traefik, DNS o tráfico general.

### HG18. Cliente OAuth Remark42

- Mutación exacta: iniciar una vez `sp-oauth-provisioner` en `sp-p0` con el
  digest Astro aprobado, el comando
  `node /app/ops/provision-remark42-oauth-client.mjs`,
  los secretos Better Auth/PostgreSQL ya cargados y la identidad/sesión de
  HG17. Crear un solo cliente con el redirect aprobado, conservar el secreto
  solo en memoria y quedar `waiting-for-reader` sobre el FIFO compartido.
- Acción del owner: aprobar `HANDOFF_ID`, deadline, UIDs/GIDs, mount options,
  `binding-id`, resultado del round-trip, `COOLIFY_API_BASE_URL`, service ID de
  destino, bind source/target y hash del consumidor antes de iniciar el
  productor.
- Evidencia: metadata/client ID/redirect no secretos, stdout redactado,
  `ready.json`, `binding-id`, tipos/ownership/modos y round-trip de ambos FIFO,
  productor vivo en `waiting-for-reader`, acceso a `sp-astro`/`sp-auth-db` y
  variables de job limitadas al manifiesto.
- No autoriza: cargar el client secret, generar SSO secret, iniciar Remark42,
  DNS o tráfico.

Si el productor deja de estar vivo antes de HG19, HG18 falla y se ejecuta el
cleanup del protocolo. Un secreto no se recupera desde logs, stdout o disco.

### HG19. Secretos coordinados Remark42

- Mutación exacta: iniciar el consumidor con el entrypoint `/bin/sh -ceu`
  aprobado, que abre `/run/sp-oauth-handoff/client-secret.pipe` como fd 3 y hace
  exec del loader. El productor entrega una vez el client secret. El loader
  ejecuta solo `PATCH /api/v1/services/{uuid}/envs`, exige `201`, escribe el ack
  en `result.pipe` y carga el valor únicamente como `AUTH_CUSTOM_CSEC` de
  `sp-remark42`; cargar el client ID como
  `AUTH_CUSTOM_CID`. Después generar `REMARK42_SECRET` y cargar el mismo valor
  como `REMARK42_SECRET` de Astro y `SECRET` de Remark42.
- Acción del owner: supervisar el ack `201`, revocación de sesión, salidas de ambos
  procesos, cleanup y desmontaje antes de cerrar el gate.
- Evidencia: service ID, variable, status `201`, productor y consumidor en exit
  0, config exportada redactada, binding y round-trip aprobados, lista de tmpfs
  sin archivo secreto, unmount confirmado y directorio eliminado.
- No autoriza: iniciar servicios, rotar otros secretos, Traefik, DNS o tráfico.

### HG20. Inicio oscuro de Remark42

- Mutación exacta: iniciar `sp-remark42` y reiniciar `sp-astro` para cargar las
  variables Remark42 aprobadas. El ingress sigue limitado a la IP del owner.
- Acción del owner: ejecutar el start y observar co-tenants durante el smoke de
  recursos de 10 minutos.
- Evidencia: health/readiness, límites, logs redactados, backups/restores y
  salud de WordPress, MariaDB y Buzz.
- No autoriza: cambiar Traefik, DNS de tráfico, email de prueba o publicación.

### HG21. Entrega de prueba Resend

- Mutación exacta: enviar verificación y reset a los dos buzones controlados ya
  nombrados, cuatro mensajes en total, desde el runtime controlado.
- Acción del owner: aprobar los destinatarios y observar los resultados.
- Evidencia: IDs/estados redactados, SPF/DKIM/DMARC, links finales, uso único,
  expiración, respuestas genéricas y tracking ausente.
- No autoriza: enviar a miembros, campañas, importar contactos, DNS de tráfico
  o publicación.

### HG22. Prueba fail-closed reversible

- Mutación exacta: crear una nueva versión de `CONTROL_PLANE_TOKEN` con el valor
  no secreto `invalid-for-fail-closed-smoke`, reiniciar solo Astro, ejecutar el
  caso fail-closed, restaurar la versión secreta anterior y reiniciar Astro.
- Acción del owner: aprobar los dos reinicios y observar la restauración.
- Evidencia: IDs de versiones sin valores, 503 o estado unavailable en la ruta
  protegida, landing 200, health posterior y versión anterior restaurada.
- No autoriza: revocar el token Directus real, cambiar políticas, otros secretos,
  DNS, publicación o dejar el sentinel activo.

### HG23. Smoke test protegido

- Mutación exacta: usar una cuenta sintética y los secretos ya cargados para
  ejecutar la matriz de smoke tests contra el origen final controlado.
- Acción del owner: autorizar la cuenta y observar resultados/rollback.
- Evidencia: tabla completa de resultados, logs redactados, métricas de host y
  eliminación de la cuenta sintética cuando corresponda.
- No autoriza: DNS público, importación de miembros, publicación o pagos.

### HG24. Reducción previa de TTL

- Mutación exacta: cambiar solo el TTL de `<DNS_RECORD_ID>` a 300 segundos y
  conservar su target `<BEFORE_VALUE>` sin cambios.
- Acción del owner: sustituir ambos placeholders por valores reales, aprobarlos
  y esperar al menos 24 horas antes de publicación.
- Evidencia: registro before/after con target idéntico, TTL 300 y timestamp.
- No autoriza: cambiar target, router, TLS, publicar ni recibir tráfico nuevo.

### HG25. Apertura controlada del router

- Mutación exacta: retirar solo la allowlist de IP del router ya probado. No
  cambiar DNS, upstream, middlewares restantes ni certificado.
- Acción del owner: aprobar la retirada y mantener listo el rollback que vuelve
  a aplicar la allowlist.
- Evidencia: desde una segunda red, usar resolución explícita de
  `sociedadparalela.com:443` hacia `<NEO4J_INGRESS_VALUE>` y demostrar TLS,
  landing, anonymous, verified, comment, logout y reset sin respuesta 403. El
  DNS público todavía conserva `<BEFORE_VALUE>`.
- No autoriza: cambiar DNS, anunciar apertura, modificar servicios, secretos o
  datos. Cualquier fallo restaura la allowlist.

### HG26. Publicación DNS y tráfico

- Mutación exacta: actualizar solo el target de `<DNS_RECORD_ID>` de
  `<BEFORE_VALUE>` a `<NEO4J_INGRESS_VALUE>`. El TTL ya es 300 por el gate
  anterior. Los tres valores deben estar sustituidos
  por datos reales en el comentario de aprobación. El router no cambia aquí.
- Acción del owner: aprobar esos valores exactos después de HG1 a HG25 y estar
  disponible para revertir al `<BEFORE_VALUE>`.
- Evidencia: before/after del registro, TLS externo, smoke test externo,
  métricas de 10 minutos y digest activo.
- No autoriza: pagos, Hotmart, otras colecciones, campañas, migración de datos,
  nuevos servicios ni cambios posteriores sin otro gate.

### HG27. Rollback de schema Directus

- Mutación exacta: aplicar un diff inverso concreto a `sp_members`. Si contiene
  filas, este gate solo puede desactivar acceso, no borrar colección ni datos.
- Acción del owner: aprobar el diff inverso y su impacto exacto.
- Evidencia: diagnóstico, snapshot previo, dry-run, resultado y matriz de
  permisos posterior.
- No autoriza: restaurar PostgreSQL/Remark42, borrar filas ni reabrir tráfico.

### HG28. Restore PostgreSQL

- Mutación exacta: restaurar un backup identificado por hash en un destino
  PostgreSQL identificado. El destino live debe permanecer detenido.
- Acción del owner: aprobar backup, destino y punto de restauración exactos.
- Evidencia: diagnóstico, hash, restore aislado previo, resultado, login y
  lectura de sesión posteriores.
- No autoriza: restore Remark42, cambios Directus, downgrade o reabrir tráfico.

### HG29. Restore Remark42

- Mutación exacta: restaurar un snapshot identificado por hash sobre el volumen
  Remark42 identificado, con el servicio detenido.
- Acción del owner: aprobar snapshot, volumen e impacto exactos.
- Evidencia: diagnóstico, hash, restore aislado previo, `/ping` y conversación
  de prueba posteriores.
- No autoriza: restore PostgreSQL, cambios Directus, borrar comentarios ni
  reabrir tráfico.

FLOW source=independent-verification project=sociedad-paralela phase=free-community-live-rollout-readiness decision=repair-handoff-mount-and-binding-proof artifact=docs/design/implementation-readiness/free-community-live-rollout-v0.1.md gate=blocked
