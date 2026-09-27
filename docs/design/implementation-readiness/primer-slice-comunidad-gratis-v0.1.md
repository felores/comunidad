# Paquete de decisión para implementar el primer slice de comunidad gratuita v0.1

Fecha: 2026-09-20

## Estado

- Estado: `approved`.
- Lifecycle: `implementation`.
- Arquitectura base: [`../primer-slice-apertura-comunidad-gratis.md`](../primer-slice-apertura-comunidad-gratis.md).
- Styleframe aprobado: [`../styleframes/primer-slice-comunidad-gratis-v1.html`](../styleframes/primer-slice-comunidad-gratis-v1.html).
- Design-system seed aprobado: [`../design-system/primer-slice-comunidad-gratis-seed-v1.md`](../design-system/primer-slice-comunidad-gratis-seed-v1.md).
- `implementation_authorized: true`.

Este paquete registra las decisiones aprobadas. Vercel no es necesario para el recorrido aprobado. Better Auth reemplaza el diseño de autenticación propia que duplicaba funciones de una biblioteca madura.

Esta actualización no implementa nada. La autorización posterior permite implementación local y acotada en otra tarjeta del Board. No autoriza infraestructura live, schema live, secretos, deploy, DNS, Hotmart, publicación, commit ni push.

## Decisiones y recomendación

| Asunto | Estado | Conclusión |
|---|---|---|
| Control plane | Aprobado por Felo | Reusar el Directus existente de AOS/Markenética con colecciones `sp_*`, identidad de servicio y políticas exclusivas. No crear otro Directus. |
| Contenido | Aprobado previamente | Git y MDX conservan los cuerpos de posts y lecciones. Directus no reemplaza este contrato. |
| Hosting | Aprobado por Felo | `RUNTIME-H1`: Astro y Remark42 como contenedores aislados en el host `neo4j` existente, mediante Coolify y Traefik; Directus y su Postgres permanecen en `dittofeed`. |
| Autenticación | Aprobado por Felo | `AUTH-B1`: Better Auth y un database o schema PostgreSQL aislado para credenciales y sesiones. Directus conserva el registro operacional enlazado del miembro. |
| Email transaccional | Aprobado por Felo | `EMAIL-E1`: Resend llamado por la aplicación. No habilitar el transporte SMTP global de Directus para este slice. |

Felo aprobó `RUNTIME-H1`, `AUTH-B1` y `EMAIL-E1`. Las alternativas permanecen como registro del análisis, no como opciones abiertas.

## Cuatro asuntos que no deben mezclarse

1. **Astro como contenido y router.** Compila MDX, genera páginas públicas estáticas y define rutas de cuenta, comunidad y API.
2. **Svelte opcional.** Un componente Svelte solo se justifica como isla para estado coordinado en el navegador. El recorrido aprobado no lo exige y este paquete no lo aprueba.
3. **Endpoints de servidor.** Registro, sesión, email, autorización y firma SSO de Remark42 necesitan ejecución server-side aunque la mayoría del HTML sea estático.
4. **Renderizado server-side de HTML.** No es un requisito global. Astro puede prerenderizar páginas públicas y ejecutar solo rutas concretas bajo demanda con el adapter de Node.

Astro documenta el renderizado estático por defecto y permite marcar rutas individuales con `prerender = false` cuando existe un adapter. El adapter oficial `@astrojs/node` puede ejecutar esas rutas en modo `standalone`. Esto cubre endpoints y páginas protegidas sin convertir todo el sitio en SSR.

## Decisión de hosting

### `RUNTIME-H1`, aprobado

**Reusar la capacidad existente del host `neo4j` mediante Coolify y Traefik, sin crear otro VPS.**

```text
Internet
  -> sociedadparalela.com
       -> Traefik existente en neo4j
            -> contenedor Astro Node
                 -> páginas prerenderizadas y assets
                 -> rutas de cuenta y comunidad
                 -> endpoints Better Auth
                 -> Resend API
                 -> firma SSO de Remark42
                 -> https://aos.markenetica.com por TLS server-to-server
            -> contenedor Remark42

Internet, endpoint AOS existente
  -> Cloudflare
       -> Traefik en dittofeed
            -> Directus existente
                 -> colecciones sp_*
                 -> Postgres existente
```

La evidencia read-only del host `neo4j` muestra 4 vCPU, 8 GB de RAM, aproximadamente 5.7 GiB disponibles, 53 GiB libres en disco, Coolify sentinel y Traefik activos. Buzz ya sirve `buzz.sociedadparalela.com`. WordPress y MariaDB son los co-tenants que obligan a limitar recursos. El control plane AOS permanece en `dittofeed`, por lo que una falla de Astro o Remark42 no comparte host con Directus.

#### Deploy y procesos

- Build reproducible con Node LTS y lockfile fijado.
- Una imagen inmutable y etiquetada por digest para Astro. Remark42 también usa una versión fijada, nunca `latest`.
- Coolify despliega Astro y Remark42 como servicios separados. Cada servicio tiene sus propios secretos, healthcheck, logs y política de restart.
- Traefik termina TLS y enruta únicamente los hostnames y paths declarados. Los puertos de los contenedores no se publican directamente en el host.
- Astro y Remark42 viven en una red de aplicación separada de WordPress, MariaDB y Buzz salvo los enlaces explícitos que necesiten.
- Límite inicial de Astro: 1 vCPU y 1 GiB de RAM. Límite inicial de Remark42: 0.5 vCPU y 512 MiB de RAM. Son topes de protección, no estimaciones de capacidad, y deben validarse con una prueba enfocada antes de abrir tráfico.
- Astro expone liveness para proceso y readiness para configuración crítica. La caída de Directus no debe retirar páginas públicas prerenderizadas del balanceador.
- Remark42 usa el healthcheck documentado por la versión fijada. Si esa imagen no ofrece uno, la implementación debe definir una comprobación HTTP mínima antes del deploy.
- Coolify conserva configuración y secretos fuera de la imagen. Development, preview y production no comparten credenciales.
- Astro llama al endpoint existente `https://aos.markenetica.com` por TLS server-to-server. Usa una identidad de servicio limitada a `sp_*`, timeouts acotados y fallo cerrado. El browser no conoce el endpoint como backend de la aplicación y nunca recibe el token.
- Un rate limiter de aplicación protege registro, login, verificación y recuperación. Traefik aplica límites de request y timeouts, pero no reemplaza controles por identidad.

#### Rollback

1. Desactivar registro si existe riesgo de escritura inconsistente.
2. Seleccionar en Coolify el digest inmutable anterior de Astro o Remark42, según el servicio afectado.
3. Ejecutar redeploy sin reconstruir la imagen.
4. Exigir healthcheck verde y probar lectura pública, login de prueba y conversación según el servicio revertido.
5. Si el rollback no recupera salud, retirar solo la ruta afectada en Traefik y conservar contenido público estático cuando sea seguro.
6. No revertir datos automáticamente. Las migraciones deben ser expandibles y compatibles con el release anterior.

Astro y Remark42 se revierten por separado. El rollback de Directus sigue el runbook de AOS en `dittofeed` y no forma parte de una promoción rutinaria de la aplicación.

#### Por qué gana

- El P0 no necesita edge rendering ni HTML server-side para todas las páginas.
- No crea VPS, gasto, provisionamiento ni plano de deploy nuevos.
- Reusa Coolify, Traefik, TLS, logs y redeploy ya operativos para el dominio Sociedad Paralela.
- Los límites de contenedor protegen a WordPress, MariaDB y Buzz de consumo accidental.
- El P0 usa una ruta HTTPS ya probada desde `neo4j` y no crea otro origen, DNS o ingress para Directus.
- Mantiene la aplicación pública fuera de `dittofeed`, que ya concentra Directus y el control plane AOS.

#### Hardening posterior, no requisito del P0

Un origen exclusivo por Tailscale o red privada puede reducir la exposición del tráfico server-to-server, pero hoy no existe una ruta funcional probada. La conexión directa a `100.113.174.89:443` falla TLS y el puerto 8055 no está publicado en el host.

Crear ese origen exige una autorización posterior para configurar un entrypoint exclusivo, SNI y certificado válidos, firewall limitado a `neo4j` y healthcheck desde el contenedor Astro. No forma parte de `RUNTIME-H1`, no bloquea el P0 y no puede describirse como capacidad actual.

### `RUNTIME-D1`, alternativa no recomendada

**Astro y Remark42 en el host `dittofeed` junto a Directus.**

Reduce un salto privado y usa el mismo host del control plane, pero concentra aplicación pública, comentarios, Directus y datos operativos en un dominio de falla. También aumenta la superficie expuesta alrededor de una instancia con 24 roles y permisos compartidos. No existe evidencia de capacidad y co-tenancy de `dittofeed` equivalente a la inspección de `neo4j`. Solo debe reconsiderarse si una medición posterior demuestra que `neo4j` no puede sostener los límites acordados y una revisión operativa confirma aislamiento suficiente.

### `RUNTIME-V1`, alternativa

**Astro en Vercel; Directus y Postgres en Hetzner.**

Es técnicamente válida. El adapter oficial soporta rutas bajo demanda. Su ventaja sería el mecanismo administrado de deploy y rollback web. No resuelve una necesidad del P0 que `RUNTIME-H1` no cubra y obliga a exponer un origen HTTPS de Directus o construir otro gateway accesible desde Vercel. También reparte secretos, logs y fallos entre dos proveedores.

Vercel solo debe reconsiderarse si aparece un requisito medido de distribución global, preview administrado o escalado automático que compense esa división operativa.

### Opciones descartadas

- **Astro estático sin backend:** no puede completar identidad, sesión, email ni SSO de Remark42.
- **SSR global:** no aporta valor a páginas públicas o MDX que pueden prerenderizarse.
- **VPS nuevo:** no fue aprobado y la capacidad existente de `neo4j` debe evaluarse primero.
- **Cloudflare Workers:** añade un runtime distinto de Node y no resuelve un requisito aprobado.

## Auditoría de Directus y autenticación

Directus sí es necesario para el objetivo cercano de cursos, pero no como editor de lecciones ni como dueño obligatorio de passwords.

### Trabajos P0 y cercanos

| Componente | Trabajo real |
|---|---|
| Astro | Experiencia, router, prerender, endpoints y única frontera pública. |
| MDX en Git | Cuerpos canónicos de posts y lecciones. |
| Better Auth propuesto | Password hashing, verificación, reset, sesiones y cookies. |
| Directus existente | Miembros operacionales, metadata de cursos y módulos, releases, entitlements, eventos de pago, cohorts y overrides. |
| Remark42 | Conversación contextual con SSO firmado. |
| Resend propuesto | Transporte de email de verificación y reset. |
| Svelte | Ninguno en P0. Solo se añade ante una interacción que no resuelva HTML o JavaScript pequeño. |

### Comparación exigida

#### A. Astro + MDX + Directus para identidad y datos

Directus soporta registro público, verificación, login por cookie o token y reset de password. Usarlo evita una biblioteca de auth adicional. Sin embargo, en la instancia compartida esas funciones operan sobre `directus_users`, roles, políticas y configuración global.

La evidencia live indica 24 roles, cero tablas `sp_*` y ausencia de configuración `EMAIL_*`, `USER_REGISTER_*`, `PASSWORD_RESET_*`, `CORS_*` y `AUTH_*`. Habilitar registro público abre el endpoint para toda la instancia y asigna un rol global configurado. Configurar SMTP y plantillas también cambia el servicio compartido. Las políticas de Directus son aditivas, por lo que una política heredada puede ampliar acceso y no puede usarse para restarlo.

Esta opción solo sería aceptable con todas estas salvaguardas:

- Rol de miembros sin App Access ni Admin Access.
- Política nueva, sin parent role ni políticas AOS heredadas.
- Cero permisos sobre CRM, AOS y system collections.
- Permisos de item y campo limitados a `sp_*`.
- Browser detrás de Astro. La aplicación no expone el token, no entrega URLs operacionales de Directus ni emite llamadas client-side a `aos.markenetica.com`.
- Registro, login y reset con rate limit, respuestas genéricas y auditoría en Astro.
- Allowlist exacta para URLs de verificación y reset.
- Pruebas negativas automatizadas contra colecciones CRM, roles, policies, settings y users.
- Revisión de las 24 asignaciones existentes antes de activar usuarios públicos.

Aun así, el cambio global y la condición de system user hacen que no sea la opción recomendada.

#### B. Astro + Directus como CMS, identidad y datos

Se descarta. Directus es un headless CMS y BaaS completo. Usarlo como CMS no lo "conecta a otro CMS"; reemplaza la autoridad editorial de Git o la duplica. Eso contradice el contrato aprobado de MDX para posts y lecciones y exigiría una enmienda de producto, migración editorial y reglas de sincronización.

#### C. Astro + MDX + Postgres con autenticación propia

Se descarta. El paquete anterior proponía `IdentityRepository`, `PasswordHasher`, repositorios de tokens y sesiones propios. Esa capa vuelve a construir seguridad que Directus o Better Auth ya ofrecen. Aumenta código sensible sin aportar un trabajo diferencial.

#### D. Astro + MDX + Better Auth + Directus compartido, aprobado

Better Auth usa una base o schema PostgreSQL aislado y un rol SQL dedicado para users, accounts, sessions y verification records. La instancia Directus existente conserva solo el control plane `sp_*` y un `sp_members.auth_subject` inmutable que enlaza al UUID de Better Auth.

Ventajas concretas:

- Passwords, tokens y sesiones quedan en una biblioteca mantenida con soporte oficial para Astro y PostgreSQL.
- No se habilita registro público ni email global en Directus.
- La identidad de servicio de Astro no necesita permisos sobre `directus_users`.
- Un miembro público no es un usuario de Data Studio.
- La aplicación controla rate limiting, respuestas genéricas y Resend sin cambiar correo global de AOS.
- Directus conserva el trabajo para el que fue aprobado: operación de membresía, cursos y entitlements.

### Enmienda formal requerida

La arquitectura aprobada dice "persona y credencial persistentes en Directus/Postgres". `AUTH-B1` cambia ese punto de forma limitada:

> Persona, credencial y sesión persisten en Better Auth sobre un database o schema PostgreSQL aislado. Directus mantiene un registro operacional `sp_members` enlazado por `auth_subject` y conserva permisos, entitlements y operaciones de cursos. La identidad sigue perteneciendo a Sociedad Paralela.

No cambia Astro + MDX, el recorrido, el email como conector, Remark42 SSO ni el uso del Directus existente. Felo aprobó esta enmienda como `AUTH-B1`.

## Forma segura del Directus compartido

### Colecciones

- `sp_members`
- `sp_courses`
- `sp_modules`
- `sp_releases`
- `sp_entitlements`
- `sp_payment_events`
- `sp_cohorts`
- `sp_cohort_members`
- `sp_operational_overrides`

Los cuerpos de lección y post no se copian. Directus guarda slug, release, orden, links live, recording, cohort, entitlement y excepciones operativas.

### Identidades y permisos

- Una identidad de servicio dedicada a Astro, sin token AOS amplio.
- Esa identidad solo puede leer o escribir las acciones y campos necesarios de `sp_*`.
- Una identidad separada, si se justifica, para ingestión futura de webhooks de pago.
- Personal interno usa Data Studio con políticas `sp_*` explícitas.
- Miembros públicos no reciben App Access, roles AOS ni tokens Directus.
- No hay permisos públicos sobre `sp_members`, `sp_entitlements` o eventos de pago.
- Las políticas no heredan roles CRM. Como Directus combina permisos de forma aditiva, cualquier política extra invalida el aislamiento y debe fallar el gate.
- Pruebas negativas demuestran que el servicio no puede leer ni mutar colecciones no `sp_*`, system collections, roles, policies o settings.

### Frontera Astro

- El browser solo llama a `sociedadparalela.com`.
- Astro valida sesión y autorización en cada request.
- Astro consulta `https://aos.markenetica.com` server-to-server por TLS y devuelve DTOs mínimos.
- El token Directus nunca entra en HTML, JavaScript, cookies ni logs.
- La caída de Directus falla cerrado para entitlements y escritura operacional. El contenido público prerenderizado sigue disponible.

## Email transaccional

Se mantiene `EMAIL-E1`, Resend mediante API desde Astro y callbacks de Better Auth.

- Alcance: verificación y recuperación.
- Subdominio propuesto: `correo.sociedadparalela.com`.
- API key server-only.
- Templates HTML y texto versionados con la aplicación.
- Tracking de apertura y clic desactivado para identidad.
- Respuestas de registro y recuperación genéricas.
- Rate limit por IP y por identificador derivado sin guardar el email crudo en el contador.

Resend también ofrece SMTP, pero conectarlo como transporte de Directus cambia la configuración global de la instancia compartida. `AUTH-B1` evita ese acoplamiento y deja intacto el correo de AOS.

## Contratos de integración

```ts
interface AuthSubject {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

interface MembershipControlPlane {
  ensureMember(input: {
    authSubject: string;
    emailNormalized: string;
    displayName: string;
    attribution?: Attribution;
  }): Promise<{ memberId: string }>;
  getAccess(input: {
    authSubject: string;
    resource: string;
  }): Promise<{ allowed: boolean; reason: string }>;
}

interface TransactionalEmailProvider {
  sendVerification(input: { to: string; url: string; idempotencyKey: string }): Promise<void>;
  sendPasswordReset(input: { to: string; url: string; idempotencyKey: string }): Promise<void>;
}
```

Better Auth es dueño de hashing, tokens, sesiones y cookies. La aplicación no reemplaza esas funciones. `MembershipControlPlane` es el único adapter que conoce Directus. Remark42 recibe un ID público derivado o estable, nombre visible y expiración, nunca email.

La creación del `sp_member` debe ser idempotente por `auth_subject`. Si Directus está caído después de verificar una cuenta, la sesión puede existir pero el acceso comunitario y los entitlements fallan cerrado hasta reconciliar el registro operacional.

## Secretos y datos

| Secreto o dato | Custodia | Restricción |
|---|---|---|
| Better Auth secret | Secret store de Coolify para Astro en `neo4j` | Solo contenedor Astro. |
| Conexión PostgreSQL de auth | Secret store de Coolify para Astro en `neo4j` | Rol limitado al database o schema de auth. |
| Token de servicio `sp_*` | Secret store de Coolify para Astro en `neo4j` | Solo outbound HTTPS a `aos.markenetica.com`; sin acceso a users, roles, policies, settings ni colecciones AOS; nunca cliente. |
| Resend API key | Secret store de Coolify para Astro en `neo4j` | Solo email transaccional de SP. |
| Remark42 SSO secret | Astro y Remark42 | Rotación coordinada. |
| Passwords y tokens | Better Auth | Nunca logs, Directus ni analytics. |
| MDX | Git | Cuerpo canónico de contenido. |

## Criterios de aceptación

### Hosting

1. Páginas públicas salen prerenderizadas.
2. Solo rutas de cuenta, comunidad protegida y API se ejecutan bajo demanda.
3. Traefik sigue siendo el único ingreso público para Astro y Remark42. Ningún puerto de contenedor queda publicado directamente.
4. Astro y Remark42 son servicios separados en Coolify, con imágenes fijadas, healthchecks y restart independiente.
5. Astro no supera 1 vCPU o 1 GiB y Remark42 no supera 0.5 vCPU o 512 MiB bajo la configuración inicial.
6. WordPress, MariaDB y Buzz mantienen salud durante la prueba de carga enfocada.
7. Desde el contenedor Astro, `https://aos.markenetica.com/server/health` valida TLS y responde 200 antes de habilitar rutas dependientes.
8. No se crea otro hostname, ingress o puerto para Directus.
9. Un digest anterior puede restaurarse mediante redeploy de Coolify sin rebuild ni rollback de datos.

### Autenticación

1. Registro, verificación, login, persistencia de sesión, logout y reset pasan en el runtime Node real.
2. Better Auth exige email verificado antes de crear acceso comunitario efectivo.
3. Reset revoca sesiones existentes según la política aprobada.
4. Registro y reset no revelan si un email existe.
5. Ningún endpoint propio implementa hashing o comparación de passwords.
6. Cookies son `HttpOnly`, `Secure` y `SameSite=Lax` como mínimo.

### Directus compartido

1. Existen solo las colecciones `sp_*` aprobadas para este dominio.
2. La identidad de servicio no puede acceder a ninguna colección CRM/AOS ni system collection.
3. Miembros públicos no son usuarios de Data Studio con `AUTH-B1`.
4. No se activa registro público, SMTP ni CORS global para este slice.
5. Entitlements fallan cerrado cuando Directus no responde.
6. MDX sigue siendo la fuente de cuerpos editoriales.
7. Pruebas negativas con el token `sp_*` reciben rechazo al leer o mutar colecciones no `sp_*`, `directus_users`, roles, policies y settings.
8. Inspección de HTML, JavaScript, cookies, respuestas y logs confirma que el token y sus headers no salen del servidor Astro.

### Experiencia

1. La implementación hereda styleframe v1 y design-system seed v1.
2. El contenido público sigue disponible si Remark42 o Directus fallan.
3. El email nunca aparece en comentarios ni payload público.
4. Foco, teclado, errores textuales y reduced motion tienen pruebas enfocadas.

## Riesgos residuales

- El endpoint AOS es público y atraviesa Cloudflare y Traefik. El aislamiento del P0 depende de TLS, del token `sp_*`, de políticas negativas correctas y de que Astro sea la única frontera usada por el browser.
- La ruta HTTPS fue probada con `/server/health`, pero las operaciones reales con `sp_*`, sus timeouts y el comportamiento bajo caída deben probarse durante una implementación autorizada.
- El origen Tailscale-only no funciona hoy. Tratarlo como hardening posterior evita bloquear el P0, pero deja el salto server-to-server sujeto a la disponibilidad del endpoint público existente.
- Los límites de contenedor son topes iniciales. Falta probar carga junto a WordPress, MariaDB y Buzz.
- Persistencia, backup y restore de Remark42, healthcheck de su imagen fijada y rollback real de Coolify siguen sin prueba.

## Resultado de los gates

### Arquitectura aprobada

Felo aprobó `RUNTIME-H1`, `AUTH-B1` y `EMAIL-E1`. También permanece aprobada la decisión anterior de un solo Directus compartido con aislamiento `sp_*`. No quedan decisiones de arquitectura abiertas para comenzar el P0 local.

### Implementación local autorizada

Felo autorizó el cambio de lifecycle a `phase: implementation` e `implementation_authorized: true`. La ejecución debe comenzar en una tarjeta separada del Board.

La autorización permite:

- Implementación local de producto, runtime y dependencias en este repositorio.
- UI aprobada de landing y aplicación.
- Astro, Better Auth y PostgreSQL local o de prueba.
- Adapters server-side para el control plane `sp_*`.
- Integraciones preparadas de Resend y Remark42 mediante variables placeholder.
- Pruebas locales enfocadas.

La autorización no permite:

- Mutar schema o políticas del Directus live.
- Crear, leer, copiar, rotar o cargar secretos reales.
- Configurar dominio o API de Resend.
- Cambiar Coolify, DNS, hosts, redes o infraestructura.
- Deploy, publicación o tráfico externo.
- Pagos, Hotmart o derechos pagos.
- Commit, push, merge o release.

Readiness queda cerrado. La siguiente acción legal es abrir una tarjeta separada para la implementación local del P0 dentro de estos límites.

## Fuentes oficiales consultadas

Consultadas el 2026-09-20:

1. [Astro, on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
2. [Astro, `@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/)
3. [Astro, endpoints](https://docs.astro.build/en/guides/endpoints/)
4. [Directus, creating users](https://directus.io/docs/guides/auth/creating-users)
5. [Directus, email login](https://directus.io/docs/guides/auth/email-login)
6. [Directus, access control](https://directus.io/docs/guides/auth/access-control)
7. [Directus, security best practices](https://directus.io/docs/guides/security/best-practices)
8. [Directus, email configuration](https://directus.io/docs/configuration/email)
9. [Better Auth, Astro integration](https://www.better-auth.com/docs/integrations/astro)
10. [Better Auth, PostgreSQL](https://better-auth.com/docs/adapters/postgresql)
11. [Better Auth, email and password](https://better-auth.com/docs/authentication/email-password)
12. [Resend, SMTP](https://resend.com/docs/send-with-smtp)
