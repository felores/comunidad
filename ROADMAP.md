---
name: Sociedad Paralela
last_updated: 2026-09-27
strategy_ref: /Users/felo/Documents/FeloVault/felo/comunidad/AGENTS.md
product_ref: PRODUCT.md
---

# Roadmap

## Ciclo de vida

| ID | Horizon | Outcome | Status | Depends on | Success signal | Next artifact |
|----|---------|---------|--------|------------|----------------|---------------|
| RM001 | Now | Abrir la comunidad gratuita en producción con el P0 verificado, ejecutando los Human Gates HG5 a HG26 del paquete de rollout | blocked | Autorización humana de cada gate; placeholders `<DNS_RECORD_ID>`, `<BEFORE_VALUE>`, `<NEO4J_INGRESS_VALUE>` y FQDN de Coolify | `https://sociedadparalela.com` sirve registro, login, comunidad y comentarios con smoke tests completos | docs/design/implementation-readiness/free-community-live-rollout-v0.1.md |
| RM002 | Now | Producir el Starter Brain Kit, único paquete de captura aprobado (`H1-A`), con su entrega inmediata tras el registro | committed | RM001 para entrega live | Registro gratuito recibe el kit confirmado y entra a la comunidad con atribución | /edtech/cerebro-artificial/producto/operador-de-conocimiento/decisions.md |
| RM003 | Now | Reescribir el bloque de regalos del embudo y el agente de referencia del currículo alrededor de Pi, con el bloque expandible y agnóstico de modelo | committed | Decisión de stack Pi registrada 2026-09-27 | Regalo 3 y bono usan Pi; contrato curricular y estrategia sin referencias a OpenCode como referencia | /felo/comunidad/embudo-cerebro-artificial.md |
| RM004 | Next | Configurar captura y atribución diferenciada por canal con entrega inmediata del recurso | committed | RM001 | `FORM_ENDPOINT` activo, ManyChat y landing de YouTube con fuente por pieza | ROADMAP.md (Fase 2) |
| RM005 | Next | Ejecutar el piloto de 30 días de contenido comparando lead magnets por compras atribuidas | committed | RM002, RM004 | Cada pieza registra su combinación y al menos una compra se atribuye a una fuente | /felo/comunidad/AGENTS.md |
| RM006 | Next | Diseñar e implementar el sistema de puntos, referidos y bonos sin competir con la promesa de la cohorte | exploring | Decisión de plataforma pendiente | Plataforma, acciones, puntajes, premios y reglas antifraude aprobados | /felo/comunidad/AGENTS.md |
| RM007 | Next | Abrir la preventa de la cohorte fundadora con precio, calendario y landing dentro de sus gates | blocked | Precio exacto en `USD 47-79`; rebase del calendario vencido; gate E2E compra-login-M1 | Preventa abierta con precio decidido y calendario rebasado | cursos/cerebro-artificial/CONTENIDO.md |
| RM008 | Later | Ejecutar la cohorte y decidir LMS propio, membresía paga y siguiente producto | exploring | RM007, ejecución de la cohorte | Primera compra educativa atribuible completada y medida | /felo/comunidad/AGENTS.md |

## Autoridad

Este documento es el plan de producto. No reemplaza a las fuentes citadas; en
conflicto manda la fuente citada.

| Capa | Fuente |
|---|---|
| Estrategia, embudo, lead magnets | `/Users/felo/Documents/FeloVault/felo/comunidad/AGENTS.md` |
| Producto | `PRODUCT.md` (raíz de este repo) |
| Diseño | `/Users/felo/Documents/FeloVault/felo/comunidad/sociedad-paralela/DESIGN.md` |
| Currículo de la cohorte | `/Users/felo/Documents/FeloVault/edtech/cerebro-artificial/producto/operador-de-conocimiento/curriculum-contract.md` |
| Apertura live del sitio | `docs/design/implementation-readiness/free-community-live-rollout-v0.1.md` |
| Entregables duraderos | GitHub Issues en `felores/comunidad` |

## Estado al 2026-09-27

- P0 local del sitio verificado y verde; la apertura live está bloqueada en
  los Human Gates HG5 a HG26 del paquete de rollout (RM001).
- Lead magnets: catálogo definido en tres fuentes (ver Fase 1); producción de
  contenido pendiente en su totalidad.
- Currículo: contrato aprobado 2026-09-20, paquete de M1 aprobado; M2 y M3 no
  tienen handoff al repo.
- Calendario de preventa desfasado: las fechas aprobadas
  (`apertura 2026-09-23`, `cierre 2026-10-07`, vivos `10-08 / 10-15 / 10-22`)
  vencieron o están por vencer sin sitio live. Requieren rebase explícito.
- Precio con drift: estrategia aprueba rango `USD 47-79`; `cursos/cerebro-artificial/CONTENIDO.md`
  dice preventa `USD 37` y normal `USD 57`.

## Decisión de stack: Pi (2026-09-27)

El stack de referencia del kit y de la enseñanza es **Pi**. Razón registrada
por Felo: OpenCode está enfocado en código, mientras Pi es modular y fácilmente
extensible, lo que lo hace apto para enseñar expandibilidad y trabajar con
cualquier modelo de lenguaje.

Impacto pendiente de ejecución:

- `felo/comunidad/AGENTS.md` ya refleja Pi como stack de referencia.
- `/felo/comunidad/embudo-cerebro-artificial.md`: el Regalo 3 y el bono de
  integración siguen especificados sobre OpenCode; reescribirlos a Pi (RM003).
- `curriculum-contract.md` de Cerebro Artificial: agente de referencia sigue
  siendo OpenCode con Pi como alternativa; actualizar con su gate (RM003).
- OpenCode queda como alternativa mostrada cuando sea pertinente.

## Principio del kit

La promesa central de adquisición es un kit de código abierto del tipo Pi que
la persona puede usar y extender con cualquier modelo de lenguaje, con lead
magnets que lo completan: interacción por voz, generación y edición de imagen
y video, y su integración con el resto. Los primeros módulos de contenido
explican la expandibilidad de estos sistemas y por qué el open source es una
ventaja frente a las corporaciones.

## Fase 0. Abrir la comunidad (RM001, bloqueante de todo lo demás)

La captura, la entrega inmediata del recurso y el acceso gratuito exigen el
sitio live.

- Ejecutar el cutover HG5 a HG26: imagen, Directus `sp_members`, PostgreSQL de
  auth, Resend, Remark42, Coolify/Traefik, DNS.
- Registrar los placeholders pendientes: `<DNS_RECORD_ID>`, `<BEFORE_VALUE>`,
  `<NEO4J_INGRESS_VALUE>` y el FQDN de la API de Coolify.
- Cada gate exige autorización humana explícita de Felo.
- `cursos/` está sin trackear en el repo; commitearlo antes de depender de él.

## Fase 1. Kit y lead magnets (RM002, RM003)

### Catálogo unificado

Dos catálogos existen y deben fusionarse sin perder decisiones.

| Lead magnet | Tier | Promesa | Fuente | Estado |
|---|---|---|---|---|
| Kit harness Pi | Adquisición amplia | Sistema propio, modular, agnóstico de modelo | Decisión Felo 2026-09-27 | Decidido, sin producir |
| OpenRouter: todos los modelos | Regalo 1 del embudo | Nunca más se case con un proveedor | `felo/comunidad/embudo-cerebro-artificial.md` | Definido, sin producir |
| Kie CLI/MCP: imagen, video, música, voz | Regalo 2 / adquisición amplia | Generación sin suscripciones | embudo + `felo/comunidad/AGENTS.md` | Definido, sin producir |
| Pi: sistema agéntico abierto y expandible | Regalo 3 / adquisición amplia | Agente abierto en su carpeta, cualquier modelo | Decisión 2026-09-27; spec pendiente de reescribir desde OpenCode | Definido, spec en RM003 |
| Bono: integración del kit en un solo harness | Remate del bloque | Un solo lugar, sin saltar de tab | `felo/comunidad/embudo-cerebro-artificial.md` | Definido, spec en RM003 |
| Narrate: interacción por voz | Adquisición amplia | Voz portable y agnóstica al proveedor | `felo/comunidad/AGENTS.md` | Definido, sin producir |
| Infinite Canvas: canvas infinito upstream | Adquisición amplia | Creación visual con agentes sobre open source con tracción | `felo/comunidad/AGENTS.md` | Definido, sin producir |
| Starter Brain Kit | Alta intención | Primera versión utilizable del sistema | `felo/comunidad/AGENTS.md`; aprobado `H1-A` | Definido, sin diseñar |
| Auditoría de contexto | Alta intención | Diagnóstico de dispersión y madurez | `felo/comunidad/AGENTS.md` | Definido, sin diseñar |
| Skill instalable | Alta intención | Propone arquitectura sin reescribir en silencio | `felo/comunidad/AGENTS.md` | Definido, sin diseñar |

### Orden de producción

1. Starter Brain Kit (RM002): único paquete aprobado para captura (`H1-A`).
2. Regalos del embudo reescritos a Pi (RM003): 5 videos + 5 docs + bono.
3. Narrate (voz) y Kie CLI/MCP (imagen/video) como entradas amplias.
4. Auditoría de contexto y skill instalable.
5. Infinite Canvas.

### Contenido del kit

Primeras piezas de adquisición:

- Expandibilidad de los harness abiertos: cómo se extiende Pi y cómo cualquier
  modelo de lenguaje entra y sale sin cambiar el sistema.
- Open source como ventaja estructural frente a productos corporativos.
- Integración del kit completo: voz, imagen/video y archivos en un mismo harness.

Estas piezas son adquisición, no módulos de la cohorte. La estrategia vigente
sigue excluyendo Narrate, Infinite Canvas y Kie como módulos obligatorios del
curso.

## Fase 2. Entrega, captura y atribución (RM004)

Depende de RM001.

- Backend de captura: configurar `FORM_ENDPOINT` en las landings del repo.
- Captura diferenciada ManyChat (Instagram/Facebook) y landing atribuible
  (YouTube) con código o UTM por pieza.
- Entrega inmediata: recurso + acceso a la comunidad + founder pricing de
  Sinapso mientras la ventana esté abierta.
- Plataforma de email y automatización de entrega (decisión pendiente).

## Fase 3. Piloto de 30 días de contenido (RM005)

- Unidad de experimento por pieza: audiencia, problema, promesa, formato,
  lead magnet, CTA, fuente, hipótesis.
- Cada pieza apunta a un lead magnet de la Fase 1; la comparación se hace por
  compras atribuidas, no por registros.
- Gates de activación de Meta y YouTube antes de cualquier pago.

## Fase 4. Puntos y referidos (RM006)

- Plataforma, acciones, puntajes, premios y reglas antifraude (pendientes).
- Los puntos solo desbloquean valor adicional; nunca plazas de la cohorte.

## Fase 5. Cohorte Cerebro Artificial (RM007)

- Resolver precio dentro de `USD 47-79` y re-sincronizar `cursos/cerebro-artificial/CONTENIDO.md`.
- Rebasar el calendario de preventa y vivos (fechas aprobadas vencidas).
- Landing de preventa con los 6 gates humanos de la estrategia.
- Handoff de M2 y M3 al repo y assets de M1 a
  `cursos/cerebro-artificial/modulos/01-boveda-operacional/`.
- Gate E2E compra → login → acceso a M1 antes de abrir preventa.
- Grabación de M2 y M3, sesiones vivas y medición por fuente.

## Fase 6. Post-cohorte (RM008, fuera de alcance por ahora)

LMS propio, membresía paga y siguiente producto solo después de ejecutar la
cohorte, según la secuencia de ejecución de `felo/comunidad/AGENTS.md`.

## Decisiones pendientes que bloquean

| Decisión | Bloquea | Fuente del conflicto |
|---|---|---|
| Precio exacto de la cohorte | RM007 | Rango `USD 47-79` vs `37/57` del repo |
| Rebase del calendario de preventa y vivos | RM007 | Fechas aprobadas vencidas |
| Plataforma de email y entrega | RM004 | Decisiones pendientes de `felo/comunidad/AGENTS.md` |
| Plataforma de puntos y referidos | RM006 | Decisiones pendientes de `felo/comunidad/AGENTS.md` |
| Cupos y criterios de la cohorte | RM007 | Decisiones pendientes de `felo/comunidad/AGENTS.md` |
| Fuente de verdad de métricas y atribución | RM005, RM007 | Decisiones pendientes de `felo/comunidad/AGENTS.md` |
| Formato del pitch ex-Beat 7 (módulo, email o vivo) | RM003 | embudo, decisiones aún por tomar |

## Fuera de alcance por ahora

Ver "Fuera de alcance por ahora" en `/Users/felo/Documents/FeloVault/felo/comunidad/AGENTS.md`:
SEO, paid fuera de Meta y YouTube, teléfono o WhatsApp, membresías pagas,
LMS propio, Interfaces Agénticas en este piloto.

## Conexiones

- `/Users/felo/Documents/FeloVault/felo/comunidad/AGENTS.md` — estrategia y secuencia de ejecución
- `/Users/felo/Documents/FeloVault/felo/comunidad/embudo-cerebro-artificial.md` — 3 regalos y pitch
- `PRODUCT.md` — promesa de producto
- `/Users/felo/Documents/FeloVault/edtech/cerebro-artificial/PRODUCT.md` — lead magnets decididos de Cerebro Artificial
- `docs/design/implementation-readiness/free-community-live-rollout-v0.1.md` — apertura live
