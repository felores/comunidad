# Comunidad - Sociedad Paralela

Sitio web de la comunidad de Sociedad Paralela: economía paralela donde humanos
y agentes transaccionan libremente, sin control corporativo ni gubernamental,
open source y agnóstico al proveedor.

## Aplicación local

El P0 usa Astro 7 con salida estática por defecto y rutas Node bajo demanda.
Better Auth guarda identidad, credenciales y sesiones en un PostgreSQL aislado.
Los cuerpos editoriales siguen en MDX dentro de `site/content/` y `cursos/`.

```bash
npm ci
cp .env.example .env
npm run db:up
npm run auth:migrate
npm run dev
```

Rutas públicas como `/` y `/posts` se prerenderizan. Registro, cuenta,
comunidad, auth y healthchecks se ejecutan en Node. El servidor de desarrollo
queda en `http://127.0.0.1:4321`.

### Verificación local

```bash
npm run test:behavior
npm run gate
```

`test:behavior` levanta PostgreSQL desechable y prueba el ciclo real de Better
Auth. `gate` ejecuta typecheck, build y Playwright con otro PostgreSQL
desechable y un puerto loopback asignado en cada corrida.

### Contenedores

- `Dockerfile` produce el runtime Astro Node sin usuario root.
- `compose.local.yml` levanta PostgreSQL para auth.
- `docker compose -f compose.local.yml --profile comments up -d` añade una
  instancia local fijada de Remark42 en `127.0.0.1:8080`. Astro la publica en
  el mismo origen bajo `/comentarios`. Antes de activar el perfil, registra el
  cliente OAuth de Remark42 con `npm run auth:remark42-client` y coloca los dos
  valores emitidos en tu `.env`. Esa operación requiere una sesión verificada
  y un `REMARK42_OAUTH_PROVISIONER_USER_ID` autorizado de forma explícita.
- `/api/health` prueba el proceso. `/api/readiness` prueba la configuración y
  conexión del PostgreSQL de auth. Directus no retira páginas públicas de
  salud cuando está caído.

## Integraciones preparadas

- `CONTROL_PLANE_MODE=directus` usa exclusivamente
  `https://aos.markenetica.com` desde el servidor y exige un token limitado a
  `sp_*`. El modo `local` solo funciona fuera de producción.
- `EMAIL_TRANSPORT=resend` exige `RESEND_API_KEY` y `EMAIL_FROM`. El transporte
  `file` escribe previews en `.local-email/` y está prohibido en producción.
- Remark42 recibe un JWT corto compatible con v1.16.4. Tanto el claim
  registrado `aud` como `user.aud` usan `REMARK42_SITE_ID`, y
  `auth_provider.name` coincide con el proveedor custom registrado. Ese
  proveedor usa los endpoints OAuth 2.1/OIDC de Better Auth, no otra identidad.
  Astro entrega las cookies bajo `/comentarios` y hace proxy hacia
  `REMARK42_INTERNAL_URL`. El proxy elimina Authorization, cookies de Better
  Auth y cualquier cookie distinta de `JWT` y `XSRF-TOKEN`; también fuerza las
  cookies de respuesta a `Path=/comentarios` sin Domain. Sin cliente OAuth,
  URL, site id, secreto o backend disponible, el flujo falla cerrado.

`npm run test:remark42-integration` levanta PostgreSQL y Remark42 v1.16.4
desechables, registra un cliente real en Better Auth y comprueba que Remark42
reconoce al usuario firmado a través del proxy. No prueba el despliegue live.

No pongas valores reales en `.env.example`, Git, HTML o JavaScript. La
configuración live de Directus, Resend, Remark42, Coolify, Traefik y DNS sigue
fuera de este repositorio y requiere un gate humano.

## Sitio HTML anterior

Las páginas HTML anteriores permanecen en `site/` como archivos históricos y
no son la autoridad visual de la aplicación Astro.

| Página | Qué es |
|---|---|
| `index.html` | Entrada / identidad |
| `waitlist.html` | Captura de correo (la transmisión) |
| `countdown.html` | Apertura de la comunidad 01.09 |
| `landing-centro-operaciones.html` | Narrativa: un solo sistema para toda tu IA |

Para inspeccionarlas, abre el HTML directo. La captura histórica sin backend
guarda `sp_waitlist` en `localStorage`; no crea una cuenta.

## Estrategia

La autoridad de estrategia vive en el vault, no en este repo:
`felo/comunidad/AGENTS.md` (embudo, audiencia, lead magnets).
