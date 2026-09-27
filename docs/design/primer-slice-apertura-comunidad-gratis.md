# Primer slice para abrir la comunidad gratis

Fecha de reconciliación: 2026-09-20

## Estado y límite del lifecycle

- Track: `established-system`.
- Fase vigente: `discovery`.
- `implementation_authorized: false`.
- Este documento es un artefacto de arquitectura dentro de `docs/design/**`, ruta permitida antes de implementación.
- No autoriza cambios en `site/`, dependencias, runtime, despliegues ni servicios externos.
- Las landings existentes y el recibo térmico son evidencia candidata. Ninguna es todavía autoridad visual aprobada.

## Decisión reconciliada

Sociedad Paralela debe abrir como una comunidad gratuita en dominio propio, con identidad propia y sin depender de la cuenta de un proveedor de pagos.

La arquitectura objetivo es:

```text
sociedadparalela.com
  -> Astro como aplicación y router
  -> MDX como contenido editorial versionado en este repositorio
  -> login propio con identidad persistente en Directus/Postgres
  -> sesión propia para comunidad y SSO de Remark42
  -> Remark42 para conversación, sin una segunda cuenta visible
  -> adaptador curso payments provider
       -> proveedor actual: Hotmart
       -> compra verificada por email, Sales API y webhooks
```

Whop deja de ser una decisión de plataforma. Permanece únicamente como historia y research antiguo. No define comunidad, identidad, hosting, membresía ni acceso. Hotmart tampoco se convierte en la plataforma de comunidad: es el proveedor modular actual para cobrar cursos y confirmar derechos de acceso pagos.

## Documentos autoridad

La precedencia para este slice es:

1. `/Users/felo/Documents/FeloVault/felo/comunidad/AGENTS.md`: estrategia, embudo, comunidad gratuita, audiencia y objetivo comercial.
2. `/Users/felo/Documents/FeloVault/felo/comunidad/sociedad-paralela/PRODUCT.md`: producto y restricciones de la experiencia pública. Su contrato de HTML autocontenido se interpreta como alcance de la landing documentada, no como prohibición permanente para la aplicación de comunidad ya decidida.
3. `/Users/felo/Documents/FeloVault/felo/comunidad/sociedad-paralela/DESIGN.md`: sistema visual candidato del recibo térmico. Sigue sin aprobación según el lifecycle.
4. `AGENTS.md` del repositorio: contrato de implementación y contenido desplegado, incluido Astro + MDX, login propio y Remark42.
5. `docs/design/status.yaml`: autoridad exclusiva de fase, aprobaciones, rutas mutables y autorización de implementación.
6. `/Users/felo/Documents/FeloVault/.docs/hotmart-api-reference.md`: contrato técnico vigente del proveedor de pagos de cursos.

Cuando dos documentos choquen, `docs/design/status.yaml` manda sobre si se puede implementar, la estrategia vigente manda sobre el modelo de comunidad y este repositorio no reemplaza decisiones de producto del vault.

## Inventario del estado real

### Git y propiedad de cambios

Estado observado antes de crear este documento:

```text
## main...origin/main
 M AGENTS.md
?? cursos/
?? docs/
?? package.json
```

Estos cambios y archivos ya existían. No se deben atribuir a este trabajo, limpiar, formatear ni incorporar de forma accidental. En particular:

- `AGENTS.md` ya estaba modificado.
- `cursos/` ya estaba sin seguimiento.
- `docs/design/status.yaml` ya estaba sin seguimiento como parte de `docs/`.
- `package.json` ya estaba sin seguimiento.

### Implementación desplegable observada

> Fotografía histórica del discovery del 2026-09-20. Para el estado implementado
> actual usa `docs/design/status.yaml` y
> `docs/design/implementation-evidence/free-community-p0-local-v0.1.md`.

- `site/` contiene HTML autocontenido, sin build: `index.html`, `waitlist.html`, `countdown.html` y `landing-centro-operaciones.html`.
- `site/content/posts/` contiene dos posts MDX, pero no existe una aplicación Astro que los renderice.
- Las landings con captura usan `FORM_ENDPOINT = ""`; por tanto, hoy guardan email y fuente en `localStorage` bajo `sp_waitlist` cuando no hay endpoint.
- No existe login propio implementado en el código rastreado.
- No existe integración de Remark42 implementada.
- No existe backend de captura, identidad o sesión implementado en el código rastreado.
- No existe integración de Hotmart implementada en el sitio rastreado.

### Trabajo local no integrado

- `package.json` declara `node --test` y una auditoría de gates de plataforma.
- `cursos/cerebro-artificial/entitlement/` contiene un contrato local de derechos, pruebas y gates bloqueados para Sinapso.
- Ese trabajo no equivale a login, persistencia, validación de webhooks ni integración con Hotmart.
- Como está sin seguimiento y su propiedad precede este documento, el primer slice no depende de modificarlo.

## Contradicciones y resolución

| Contradicción | Resolución vigente |
|---|---|
| El inventario superior del vault todavía etiqueta Sociedad Paralela como Whop. | Es drift histórico. Whop no participa en la arquitectura objetivo. |
| Research antiguo describe monetización, membresía y acceso administrados por Whop. | No es autoridad de producto. La comunidad es gratuita y vive en dominio propio. |
| `PRODUCT.md` define una landing en un HTML autocontenido, mientras `AGENTS.md` define una futura app Astro + MDX. | Son capas distintas. El HTML describe el artefacto de landing existente; Astro + MDX describe la aplicación de comunidad objetivo. La migración solo ocurre tras autorización. |
| El README y landings existentes usan el mundo de “transmisión pirateada”, mientras `PRODUCT.md` pide no reutilizarlo y `DESIGN.md` propone un recibo térmico. | No se elige ninguno por implementación. El lifecycle marca styleframes pendientes y design system en draft. |
| `docs/design/status.yaml` todavía nombra `community-waitlist-landing` como artefacto actual, pero la necesidad inmediata es abrir la comunidad gratuita. | Este documento prepara el siguiente artefacto. El status solo puede cambiar tras aprobación humana explícita. |
| La estrategia pide nombre + email, mientras las landings actuales capturan solo email. | El registro de la comunidad tendrá nombre y email. La captura histórica de waitlist no se considera una cuenta. |
| Hotmart puede gestionar compradores, pero no ofrece login de comprador para este stack. | El sitio mantiene identidad y sesión propias. Hotmart solo confirma derechos pagos mediante integración servidor a servidor. |
| El contrato de curso local puede evaluar derechos, pero no autentica compras. | Se conserva como dominio interno candidato. Un adaptador Hotmart verificado deberá producir sus eventos; nunca se toma como prueba de compra por sí solo. |

## Primer vertical slice implementable

### Resultado

Una persona puede crear una cuenta gratuita en `sociedadparalela.com`, verificar su email, iniciar sesión, abrir una página de bienvenida escrita en MDX y participar en su conversación mediante Remark42 con la misma identidad. No compra nada y no entra todavía a contenido pago.

### Recorrido completo

```text
landing pública
  -> registro con nombre, email y password
  -> verificación de email
  -> sesión propia mediante cookie segura
  -> bienvenida protegida renderizada desde MDX
  -> comentario en Remark42 mediante SSO
  -> cierre de sesión
```

### Componentes del slice

1. **Astro híbrido**
   - Páginas públicas prerenderizables.
   - Rutas de cuenta y comunidad ejecutadas en servidor.
   - MDX como fuente del contenido editorial.

2. **Identidad propia**
   - Persona y credencial persistentes en Directus/Postgres.
   - Verificación de email antes de permitir publicar comentarios.
   - Sesión en cookie `HttpOnly`, `Secure` y `SameSite=Lax` como mínimo.
   - Password almacenado solo mediante hash resistente y nunca reversible.
   - Recuperación de password incluida en la frontera del login propio.

3. **Comunidad mínima**
   - Una ruta protegida de bienvenida.
   - Un post o hilo inicial en MDX.
   - Remark42 embebido con SSO firmado por el backend propio.
   - El identificador enviado a Remark42 es estable e interno. El email no se expone públicamente.

4. **Atribución mínima**
   - Guardar `source`, `campaign`, `content` y `lead_magnet` cuando estén presentes.
   - Asociarlos a la identidad desde el registro, sin convertir parámetros no confiables en permisos.

5. **Frontera de cursos**
   - Definir el puerto interno `CourseEntitlementProvider` sin integrar cobro en este slice.
   - Toda ruta paga falla cerrada mientras no exista un derecho verificado.
   - La caída de Hotmart no bloquea registro, login, lectura ni conversación de la comunidad gratuita.

### Fuera del primer slice

- Checkout, preventa o activación de Cerebro Artificial.
- Sincronización real con Hotmart.
- Grupo privado de compradores.
- Puntos, referidos, premios y antifraude.
- LMS propio, progreso de curso y catálogo completo.
- Sinapso, sus gates de plataforma y distribución.
- Migración visual de las landings existentes.
- Importación automática de los registros guardados en `localStorage`.
- Deploy a producción.

## Contrato de identidad y email

### Identidad canónica

- La identidad pertenece a Sociedad Paralela, no a Hotmart, Remark42 ni al proveedor de email.
- Cada persona tiene un identificador interno inmutable.
- El email verificado es el conector entre adquisición, comunidad y futuras compras.
- Para comparación se guarda una forma normalizada, con espacios externos eliminados y dominio en minúsculas. El valor mostrado conserva una forma apta para contacto.
- Un email normalizado solo puede pertenecer a una identidad activa.
- Cambiar email exige verificar el nuevo correo y no transfiere derechos pagos automáticamente.

### Datos mínimos

| Dato | Uso |
|---|---|
| `user_id` | Identidad interna estable. |
| `name` | Nombre visible y trato dentro de la comunidad. |
| `email` | Contacto y vínculo futuro con compra. |
| `email_normalized` | Unicidad y comparación con el proveedor de cursos. |
| `email_verified_at` | Habilitación de participación. |
| `password_hash` | Autenticación propia. Nunca texto plano. |
| `source`, `campaign`, `content`, `lead_magnet` | Atribución de adquisición. |
| `created_at`, `updated_at` | Auditoría básica. |

No se captura teléfono durante el piloto. No se guardan credenciales de Hotmart en la identidad. Los secretos operativos solo existen como variables de entorno del servidor.

### Casos de borde

- Registro repetido con el mismo email: no crea otra identidad y no revela más información de la necesaria.
- Compra futura con otro email: el acceso queda pendiente de una vinculación asistida y verificada. No se fusionan cuentas por similitud.
- Cambio de email: conserva el `user_id`; el derecho de curso debe volver a resolverse contra el proveedor.
- Email no verificado: puede completar el flujo de verificación, pero no comentar ni recibir un derecho pago.
- Eliminación o bloqueo de cuenta: invalida sesiones propias y el SSO de Remark42; no altera registros legales del proveedor de pagos.

## Frontera con Hotmart

### Responsabilidad de Sociedad Paralela

- Crear cuentas, autenticar, mantener sesiones y perfilar la experiencia.
- Guardar comportamiento y atribución de la comunidad.
- Emitir SSO para Remark42.
- Consultar derechos de curso mediante una interfaz interna independiente del proveedor.
- Guardar solo el estado derivado mínimo y la evidencia operacional necesaria para responder rápido y auditar eventos.

### Responsabilidad del curso payments provider

- Cobrar el producto educativo.
- Ser fuente del hecho comercial de compra, reembolso o cancelación.
- Exponer Sales API y enviar webhooks firmados.

### Adaptador actual: Hotmart

- Autenticación servidor a servidor con OAuth 2.0 `client_credentials`.
- Nunca se presenta “Sign in with Hotmart”.
- Resolución de compra por email normalizado y producto esperado.
- Webhooks validados antes de producir eventos internos.
- Procesamiento idempotente por identificador de evento o transacción.
- Reembolsos y cancelaciones revocan el derecho pago, no la cuenta gratuita.
- Credenciales, tokens y firmas nunca llegan al navegador ni al repositorio.

### Interfaz interna mínima

```ts
interface CourseEntitlementProvider {
  getEntitlement(input: {
    userId: string;
    emailNormalized: string;
    productKey: string;
  }): Promise<{
    state: "active" | "inactive" | "pending";
    provider: "hotmart";
    checkedAt: string;
  }>;
}
```

El nombre `hotmart` es metadata interna intercambiable. La UI habla de compra o acceso al curso, no de membresía Hotmart.

## Pruebas de aceptación

### Lifecycle y alcance

1. Antes de autorización, el diff solo contiene documentos permitidos bajo `docs/design/**`.
2. `site/`, `package.json`, `cursos/`, dependencias y runtime permanecen sin cambios atribuibles a este slice.
3. No se despliega, publica, hace commit ni push.

### Cuenta gratuita

1. Una persona registra nombre, email válido y password en el dominio propio.
2. El sistema crea una sola identidad para el email normalizado y envía verificación sin revelar si una cuenta preexistía.
3. Antes de verificar, no puede comentar.
4. Después de verificar, puede iniciar sesión, recargar la página y conservar una sesión segura.
5. Puede cerrar sesión y la ruta protegida vuelve a exigir autenticación.
6. Puede solicitar recuperación de password sin filtrar si el email existe.
7. No se pide teléfono ni pago.

### Contenido y conversación

1. La bienvenida se renderiza desde un archivo MDX versionado.
2. Un usuario autenticado y verificado entra a Remark42 sin crear otra cuenta.
3. El comentario muestra nombre o alias, nunca email.
4. Un usuario anónimo no obtiene una identidad SSO válida.
5. `prefers-reduced-motion`, navegación por teclado y foco visible siguen siendo criterios obligatorios de la UI posterior.

### Atribución

1. Una visita con parámetros de campaña conserva su fuente hasta el registro.
2. La atribución queda asociada al `user_id` y no controla permisos.
3. Una visita sin parámetros puede registrarse normalmente.

### Frontera de curso

1. La comunidad gratuita funciona si Hotmart está caído o no está configurado.
2. Ninguna ruta paga concede acceso sin derecho `active` verificado.
3. Un webhook inválido, repetido o de otro producto no concede acceso.
4. Un reembolso válido revoca solo el derecho de curso.
5. Cambiar el adaptador de pagos no exige migrar la identidad ni el SSO de Remark42.

## Decisiones humanas mínimas

### Para avanzar de discovery a styleframes

Una sola aprobación:

> Apruebo `docs/design/primer-slice-apertura-comunidad-gratis.md` como arquitectura del primer slice y autorizo actualizar el lifecycle de `discovery` a `styleframes`. No autorizo implementación todavía.

Esta aprobación permite actualizar `docs/design/status.yaml` y producir styleframes. No permite tocar producción.

### Antes de autorizar implementación

Quedan tres decisiones concretas:

1. Aprobar el styleframe y el design-system seed que heredará la app. Debe resolver recibo térmico frente a cualquier alternativa, sin reutilizar por defecto la transmisión antigua.
2. Elegir el objetivo de runtime compatible con Astro SSR y la ubicación operativa de Directus/Postgres y Remark42. Las opciones de hosting siguen sin cerrar.
3. Elegir el proveedor de email transaccional para verificación y recuperación. La interfaz puede ser modular, pero el slice no abre sin entrega real de correo.

Después debe existir una aprobación explícita que deje `design_system.status: approved` e `implementation_authorized: true`. Hasta entonces este documento sigue siendo preparación, no permiso de implementación.
