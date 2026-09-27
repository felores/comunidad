# Evidencia local del P0 de comunidad gratuita v0.1

Fecha: 2026-09-20

## Resultado

Las cuatro precondiciones locales encontradas durante las revisiones del rollout
fueron reparadas el 2026-09-26 y cuentan con pruebas enfocadas, gate local e
imagen `linux/amd64`. Una revisión independiente inicial de ese diff devolvió
FAIL y encontró brechas adicionales en invalidación, ejecutabilidad y deadline;
esas brechas también fueron reparadas. El resultado queda pendiente de un nuevo
pase independiente. No está desplegado ni habilitado contra servicios live.

La implementación incluye:

- Landing pública prerenderizada con el delta visual `lp-green-v1`.
- Aplicación de cuenta y comunidad con el seed térmico v1.
- Astro 7 estático por defecto y rutas Node bajo demanda.
- Better Auth 1.7.5 con PostgreSQL aislado para usuarios, cuentas, sesiones y
  verificaciones.
- Registro, verificación, login, sesión, logout y reset con revocación de
  sesiones Better Auth e invalidación inmediata de cookies y escrituras
  Remark42.
- Adapter server-only para `sp_members` y `sp_entitlements` en el origen AOS
  aprobado, timeout acotado, DTOs mínimos y fallo cerrado.
- Transporte Resend para producción y spool de archivos solo para desarrollo y
  pruebas.
- Firma server-only compatible con Remark42 v1.16.4, incluido `user.aud`, y
  handoff mediante cookies de mismo origen bajo `/comentarios`.
- Proxy local `/comentarios/**` desde Astro hacia Remark42 fijado en el puerto
  loopback 8080. La UI no afirma que el servicio esté activo si falta
  configuración.
- Proveedor custom real de Remark42 respaldado por OAuth 2.1/OIDC de Better
  Auth. El cliente se registra mediante una sesión verificada y autorizada; no
  habilita anonymous/dev ni crea una identidad visible adicional.
- Cuerpo de bienvenida canónico en
  `site/content/community/bienvenida.mdx`; los posts públicos siguen saliendo
  de `site/content/posts/*.mdx`.
- Dockerfile de Astro, PostgreSQL local y perfil opcional de Remark42 con
  versiones fijadas.

## Fronteras comprobadas

- `AGENTS.md` y `cursos/` ya estaban modificados o sin seguimiento antes de
  esta tarjeta. No se editaron durante la implementación.
- `package.json` y `docs/` también preexistían sin seguimiento. Esta tarjeta
  extendió `package.json`, `docs/design/status.yaml` y añadió este documento
  porque pertenecen al alcance autorizado.
- No hubo llamadas al Directus live ni mutaciones de colecciones, políticas,
  usuarios o tokens.
- No hubo configuración de Resend, Remark42, Coolify, Traefik, DNS o servidores.
- No hubo trabajo de pagos, commit, push, deploy ni publicación.

## Evidencia automática

### Reparación enfocada de Remark42

Comando:

```text
npx vitest run tests/behavior/remark42.test.ts
```

Resultado observado:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
```

La prueba verifica la firma HS256 con `iss=remark42`, `aud` registrado,
`user.aud`, `iat`, expiración a cinco minutos y `jti`. También comprueba que el
payload no contiene email, que ambas cookies usan `Path=/comentarios`, que el
redirect entra a `/comentarios/web`, que el proxy elimina headers reenviados no
confiables, traduce el path público 4321 al backend loopback 8080 y responde 503
si falta configuración. El mismo check fija la imagen v1.16.4 y el
`REMARK_URL` público del Compose.

El contrato negativo también demuestra que `Authorization`, la cookie de
Better Auth y cookies de analytics no llegan a Remark42. Solo pasan `JWT` y
`XSRF-TOKEN`. Las cookies de refresh que devuelve Remark42 se limitan a esos
dos nombres, pierden cualquier `Domain` y salen con `Path=/comentarios`.

### Integración contra Remark42 fijado

Comando:

```text
npm run test:remark42-integration
```

Resultado observado:

```text
Pinned Remark42 accepted the corrected JWT through /comentarios/api/v1/user.
Remark42 custom provider sociedad-paralela points to live disposable Better Auth OAuth endpoints.
Better Auth and Authorization sentinels were removed by the same-origin proxy.
```

La prueba usa PostgreSQL y Remark42 v1.16.4 desechables. Migra Better Auth con
el plugin `@better-auth/oauth-provider`, crea y verifica una identidad local,
registra un cliente OAuth confidencial real, comprueba que el authorize endpoint
continúa hacia el login propio y arranca Remark42 con esos endpoints y ese
cliente. Finalmente envía el JWT corregido por el proxy y exige que
`/api/v1/user` devuelva `sp_integration-user` y `Integration Member`. Ambos
contenedores y el volumen temporal se eliminan al terminar.

### Prueba base anterior

Comando:

```text
npm run test:behavior
```

Resultado observado:

```text
Test Files  4 passed (4)
Tests       6 passed (6)
```

La prueba usa PostgreSQL 17.6 desechable. Ejercita el handler real de Better
Auth, el hash de password provisto por la biblioteca, verificación de email,
login, cookie de sesión, reset, revocación, los cinco estados de autorización,
fallo del control plane y el contrato de email.

### Gate final

Comando:

```text
npm run gate
```

Resultado observado:

```text
astro check: 0 errors, 0 warnings, 0 hints sobre 49 archivos
astro build: páginas públicas prerenderizadas y entrypoint Node generado
browser-output y compose: passed
Remark42 v1.16.4 + Better Auth OAuth provider: passed
playwright: 2 passed
```

El recorrido Playwright registra una cuenta mediante la UI, consume el email
local, verifica la cuenta, inicia sesión, abre `/comunidad`, renderiza el MDX,
cierra sesión y confirma que la ruta vuelve a exigir autenticación. La prueba
también cubre recuperación genérica, foco por teclado, piso tipográfico,
`prefers-reduced-motion`, diagnósticos del navegador y ausencia de marcadores
server-only en el HTML.

`test-results/browser-diagnostics.json` terminó con `failures: []`. Una
inspección separada de `dist/client` y las páginas estáticas no encontró
`CONTROL_PLANE_TOKEN`, `RESEND_API_KEY`, `REMARK42_SECRET`, el token sentinel ni
el origen AOS.

### Verificación independiente

El primer pase independiente del 2026-09-20 devolvió `FAIL`. Detectó que el JWT no
incluía `user.aud` y que no existía un proxy local de mismo origen entre Astro
y el contenedor Remark42. Ese dictamen reemplaza la afirmación anterior de
PASS.

Después de la reparación, el pase independiente de la tarjeta 23 devolvió
`OK`. Reprodujo `npx vitest run tests/behavior/remark42.test.ts` y
`npm run gate`, incluido PostgreSQL desechable, Remark42 v1.16.4 fijado y
Playwright 2/2. Confirmó el payload SSO, el proxy de mismo origen, la frontera
de cookies y la ausencia de contenedores o volúmenes desechables restantes.
Ese resultado cerró la fase local en ese momento. No demostró readiness live y
queda reemplazado para rollout por el hallazgo siguiente.

### Hallazgo posterior de rollout

La revisión independiente del paquete de rollout detectó que
`src/server/control-plane.ts` hace una lectura y luego una creación, pero trata
un `409` de la unique constraint como indisponibilidad. Dos autorizaciones
concurrentes pueden producir una denegación transitoria aunque exista una sola
fila correcta. Antes de confiar en esta evidencia para rollout se requiere una
reparación local, una prueba concurrente enfocada, el gate local y otro pase de
verificación independiente.

La Verificación independiente de la tarjeta 25 devolvió `FAIL` después de la
primera revisión documental. Confirmó dos bloqueos adicionales:

1. Logout y reset revocan Better Auth, pero el proxy de comentarios no exige una
   sesión Better Auth activa para cada escritura. `JWT` y `XSRF-TOKEN` pueden
   seguir utilizándose durante su ventana de cinco minutos.
2. El handoff OAuth propuesto asumía que un archivo en el tmpfs privado del job
   sobrevivía a su terminación. Ese mecanismo no era ejecutable.

El paquete de rollout ahora trata la invalidación inmediata como reparación
local obligatoria y reemplaza el archivo por un productor vivo más un FIFO en
tmpfs host compartido con un consumidor separado. Estas son especificaciones,
no evidencia de implementación. Requieren tarjetas locales, pruebas enfocadas,
gate completo y nueva Verificación independiente.

La segunda Verificación de la tarjeta 25, run 178, también devolvió `FAIL`. El
productor y el consumidor usaban rutas internas distintas, no existía un
entrypoint que abriera el FIFO como fd 3 y faltaba la base URL no secreta de la
API Coolify. El paquete reparado usa un único bind source host y
`/run/sp-oauth-handoff` en ambos jobs, fija el entrypoint con fd 3, añade un FIFO
de resultado para cerrar el ciclo de vida y define
`PATCH /api/v1/services/{uuid}/envs` con éxito exclusivo `201`. También exige que
HG10 resuelva y valide el `COOLIFY_API_BASE_URL`. Este contrato aún no está
implementado ni verificado.

La Verificación independiente de la tarjeta 27, run 183, devolvió `FAIL` por una
contradicción ejecutable restante: la tabla declaraba read-only el mount del
consumidor aunque este debe escribir `result.pipe`. También rechazó comparar
mount IDs entre namespaces como prueba de binding. El paquete reparado define un
único bind read-write del tmpfs host para ambos jobs, UIDs separados y permisos
direccionales por FIFO. La prueba de binding usa un `binding-id` aleatorio no
secreto, checks exactos de tipo/ownership/modo y un round-trip `probe`/`ack` por
los dos FIFO. No usa igualdad de mount IDs. Esto sigue siendo especificación,
no evidencia de implementación o mutación live.

### Reparaciones locales posteriores

El 2026-09-26 se observó:

- `ensureMember` relee `sp_members` por `auth_subject` después de un `409`; dos
  llamadas concurrentes convergen en el mismo member ID.
- Un recorrido real con PostgreSQL desechable y Better Auth verifica registro,
  handoff, escritura controlada, logout, reset, rechazo del cookie jar anterior,
  SSO `403`, upstream no invocado y lectura pública conservada.
- El proxy exige sesión activa para autenticación bajo `/comentarios/auth/**` y
  para POST, PUT, PATCH y DELETE bajo `/comentarios/api/**`.
- Productor y consumidor OAuth se empaquetan como JavaScript ejecutable bajo
  `/app/ops/`; la imagen final no necesita `tsx` ni fuentes TypeScript.
- El consumidor limita la request a Coolify mediante el deadline aprobado,
  acepta solo `201`, no sigue redirects y reporta `ok` o `fail` por FIFO.
- Los fallos de eliminación del cliente o revocación de sesión ya no se ignoran;
  el error conserva el client ID no secreto para remediación.
- Logout devuelve `503` y no redirige cuando Better Auth no confirma la
  revocación; aun así expira los cookies Remark42 del browser.
- La definición de ambos jobs incluye FIFO de resultado, deadline, grupo
  compartido, token protegido y pares operativos/aprobados para URL y service ID.
- `ready.json` queda `0640 10001:10000`, legible por el grupo suplementario
  compartido sin conceder acceso al secreto OAuth.
- El launcher abre el FIFO como fd 3 con `O_NONBLOCK`; productor y consumidor
  comparten un tmpfs host y el mismo deadline limita lectura, request y salida.
- El productor y consumidor empaquetados se ejecutan contra Better Auth y
  PostgreSQL desechables más un receptor Coolify HTTPS con CA efímera. La rama
  `201` conserva el cliente y revoca la sesión; la rama `500` elimina el cliente
  nuevo y revoca la sesión sin exponer el secreto.
- Ambos `FROM` usan el digest Linux amd64
  `sha256:764fa18a0649c8682db1a580ce075d8662b6fb0eb2f05221af2d13f2ff43c383`.
- La imagen local `sociedad-paralela:p0-local` se construyó con ID
  `sha256:4cb827a5a1972426ebbbd08e9afd354467c97564010875074f09e849b695ab3d`,
  arquitectura `amd64`, usuario `astro` y tamaño 136623639 bytes.
- Syft `sha256:500e2d872ac019436926e8322b4fc1f39441d94d21f6f4046c6ff29b30e8cb02`
  produjo un SBOM SPDX 2.3 local con 519 paquetes y 1148 relaciones.

Comandos y resultados:

```text
npm test
7 archivos, 20 pruebas pasadas

npm run gate
PASS: Astro check 0/0/0, build Astro y ops, browser output, compose,
Remark42 v1.16.4 real y Playwright 2/2

docker build --platform linux/amd64 --tag sociedad-paralela:p0-local .
PASS: imagen 4cb827a5a197

npm run test:oauth-handoff-runtime
PASS: UIDs/GIDs, modos FIFO, tmpfs compartido, ready.json y apertura acotada

npm run test:oauth-provisioning-integration
PASS: productor y consumidor reales, Better Auth/PostgreSQL, receptor Coolify
HTTPS, cleanup de éxito y fallo, y revocación de sesiones
```

La primera revisión independiente posterior a la reparación devolvió FAIL por
jobs no ejecutables, falta de recorrido real, `/comentarios/auth/**` sin gate,
deadline ausente y cleanup silencioso. Todos esos hallazgos tienen corrección y
prueba local. La segunda revisión devolvió FAIL por logout no confirmado,
manifiesto incompleto, GID de `ready.json`, apertura bloqueante y allowlist no
comparada. Esos hallazgos también tienen corrección y prueba local. La tercera
revisión no encontró fallas en esos puntos, pero exigió el recorrido real de
cleanup de HG3; ese recorrido ahora pasa en éxito y fallo. El cuarto pase
independiente aceptó las
cuatro precondiciones locales sin hallazgos P0 o P1.

## Límites de esta evidencia

Los adapters locales prueban contratos y recorridos, no disponibilidad externa.
Esta evidencia no demuestra políticas live de Directus, entrega real de Resend,
compatibilidad live de cookies con Remark42, límites de contenedor en el host,
TLS, routing de Traefik ni rollback de Coolify.

## Human Gate pendiente

Se requiere aprobación humana separada antes de:

1. Crear o revisar colecciones `sp_*`, identidad de servicio y políticas
   negativas en Directus.
2. Cargar secretos y configurar el dominio de Resend.
3. Configurar Remark42 y validar su handoff SSO en el origen final.
4. Configurar Coolify, Traefik, DNS, límites, backup, restore y rollback.
5. Autorizar deploy o tráfico externo.

El resultado correcto es "precondiciones locales reparadas y aceptadas por la
Verificación independiente; mutaciones live aún bloqueadas por gates humanos
separados". No es correcto afirmar "producción lista".
