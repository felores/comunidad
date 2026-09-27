# Seed de diseño del primer slice de comunidad gratuita v1

Fecha: 2026-09-20

## Estado y autoridad

- Fase: `design-system`.
- Estado: aprobado e inmutable bajo la política de versionado por ciclo de aprobación.
- Fuente visual aprobada e inmutable: [`../styleframes/primer-slice-comunidad-gratis-v1.html`](../styleframes/primer-slice-comunidad-gratis-v1.html).
- Arquitectura aprobada: [`../primer-slice-apertura-comunidad-gratis.md`](../primer-slice-apertura-comunidad-gratis.md).
- Referencia anterior: `/Users/felo/Documents/FeloVault/felo/comunidad/sociedad-paralela/DESIGN.md`.
- `implementation_authorized: false`.

El styleframe v1 manda cuando esta semilla difiera de la referencia anterior. En particular, la escala tipográfica legible aprobada reemplaza el cuerpo de `1rem` y los labels de `0.66rem` de la referencia. Esta semilla documenta el sistema para revisión. No es CSS de producción ni autoriza copiar el styleframe a `site/`.

## Dirección visual

**Nombre:** recibo de acceso térmico.

La comunidad se presenta como un documento físico emitido por una máquina: vacío oscuro, papel negro verdoso, una sola tinta fósforo y datos concretos organizados como recibo. La interfaz no representa una terminal, una transmisión, un dashboard ni una colección de cards SaaS.

Principios:

1. Una sola voz tipográfica mecánica.
2. Una sola tinta expresiva, jerarquizada por intensidad.
3. Profundidad reservada para máquina, papel y cavidades físicas.
4. Bordes rectos, reglas punteadas y corte térmico en lugar de radios decorativos.
5. La identidad propia y el acceso gratuito son el centro. Pagos y cursos no condicionan este slice.

## Tokens base

Este bloque es la traducción reusable del styleframe aprobado. Los nombres `sp-*` evitan colisiones durante una implementación futura.

```css
:root {
  color-scheme: dark;

  /* Superficies */
  --sp-color-page: oklch(10.5% 0.010 150);
  --sp-color-paper: oklch(16% 0.016 150);
  --sp-color-paper-raised: oklch(19.5% 0.016 150);
  --sp-color-slot: oklch(7% 0.008 150);
  --sp-color-slot-raised: oklch(20% 0.020 150);

  /* Tinta */
  --sp-color-ink: oklch(87% 0.200 149);
  --sp-color-ink-dim: oklch(74% 0.160 149);
  --sp-color-ink-secondary: oklch(64% 0.130 149);
  --sp-color-rule: oklch(38% 0.070 149);
  --sp-color-error: oklch(68% 0.210 25);

  /* Tipografía */
  --sp-font-family: "DotGothic16", "Courier New", ui-monospace, monospace;
  --sp-font-size-metadata: 0.875rem; /* 14px con raíz de 16px */
  --sp-font-size-support: 1rem;      /* 16px */
  --sp-font-size-body: 1.125rem;    /* 18px */
  --sp-font-size-content-title: 1.15rem;
  --sp-font-size-code: 1.45rem;
  --sp-font-size-section-title: clamp(1.55rem, 2.5vw, 2.15rem);
  --sp-font-size-display: clamp(2rem, 5vw, 3.35rem);
  --sp-line-height-body: 1.55;
  --sp-line-height-heading: 1.08;
  --sp-letter-spacing-label: 0.1em;
  --sp-letter-spacing-metadata: 0.12em;

  /* Forma y profundidad */
  --sp-radius: 0;
  --sp-border-rule: 2px dashed var(--sp-color-rule);
  --sp-border-field: 2px dotted var(--sp-color-rule);
  --sp-shadow-paper: 0 18px 50px rgb(0 0 0 / 0.5);
  --sp-shadow-machine: 0 12px 28px rgb(0 0 0 / 0.65);
  --sp-focus-ring: 2px solid var(--sp-color-ink);
  --sp-focus-offset: 3px;
}
```

### Regla de tipografía legible

| Rol | Tamaño mínimo | Usos permitidos |
|---|---:|---|
| Cuerpo primario | `18px` | Párrafos principales, mensajes, contenido MDX, valores de formulario y composer. |
| Soporte y controles | `16px` | Labels de formulario, ayudas, botones, estados legibles, filas de datos y leyendas. |
| Metadata técnica secundaria | `14px` | Identificadores, número de recibo, pasos, rótulos técnicos y estado del artefacto. |

No existe texto visible menor de `14px`. Un texto no baja a `14px` solo para ahorrar espacio. Debe ser metadata técnica secundaria. Los títulos mantienen la escala aprobada del styleframe v1.

## Jerarquía tipográfica

- **Display:** `clamp(2rem, 5vw, 3.35rem)`, peso `400`, interlineado `1.04`, tracking `0.02em`, mayúsculas.
- **Título de sección:** `clamp(1.55rem, 2.5vw, 2.15rem)`, peso `400`, interlineado `1.08`, mayúsculas.
- **Título dentro de contenido:** `1.15rem`, peso `400`, interlineado `1.2`, mayúsculas.
- **Cuerpo:** `1.125rem`, peso `400`, interlineado `1.55`.
- **Soporte:** `1rem`, peso `400`, interlineado heredado.
- **Metadata:** `0.875rem`, peso `400`, tracking entre `0.12em` y `0.14em`, mayúsculas cuando el contenido es técnico.

Toda la interfaz usa `DotGothic16` con los fallbacks declarados. No se incorporan Anton, JetBrains Mono ni una segunda familia display.

## Contratos de componentes

### Cabezal de máquina

- Altura mínima de `3.5rem`.
- Fondo `slot-raised`, borde inferior de una línea y `shadow-machine`.
- La ranura es una cavidad estructural, no un input ni un separador decorativo.
- Labels técnicos a `14px`. En viewport estrecho se oculta la ranura, no la identificación del sistema.

### Superficie de papel

- Fondo `paper`, tinta principal y `shadow-paper`.
- Radio `0`.
- El borde inferior puede usar el corte térmico repetido de `14px` del styleframe.
- El papel representa un documento o paso del flujo. No se usa como card genérica para cualquier bloque.

### Campo

- Label a `16px`, mayúsculas, `ink-secondary` y tracking `0.1em`.
- Valor o texto introducido a `18px`.
- Fondo transparente y borde inferior `2px dotted`.
- Foco futuro: `focus-ring`, offset `2px` o `3px`, fondo `paper-raised`.
- Error: tinta y borde `error`, acompañado de texto, nunca solo color.

### Acción primaria

- Elemento semántico `button` o enlace según la acción real. El `div.cta` del styleframe es solo representación estática.
- Fondo `ink`, texto `slot`, radio `0`, ancho completo y padding mínimo `0.7rem 1ch`.
- Texto a `16px`, peso `700`, tracking `0.05em`, mayúsculas.
- Foco siempre visible. Hover y active no pueden ser el único indicador de estado.
- En este slice las acciones hablan de identidad, verificación, lectura o conversación. No hablan de pago.

### Rótulo invertido

- Fondo `ink`, texto `slot`.
- Reservado para estado funcional importante o acción primaria.
- No se usa como acento decorativo repetido.

### Ticket de identidad, contenido o mensaje

- Fondo `paper-raised`, borde `2px dashed rule`, radio `0`.
- Padding base `0.85rem`.
- El rótulo técnico puede usar `14px`; el contenido legible usa `18px`; ayudas y estado usan `16px`.
- El email se enmascara o se describe como oculto. Nunca funciona como nombre público.

### Fila de datos

- Distribución flexible entre nombre y valor, gap mínimo `1rem`.
- Texto a `16px`, borde inferior punteado y tinta tenue.
- Debe permitir wrap en anchos estrechos sin superponer nombre y valor.

## Composición responsive

- El contenido usa padding lateral fluido y conserva un mínimo operativo de `20rem` para el artefacto de revisión.
- A `52rem` o menos, el cabezal y la cabecera pasan a una composición simple; las notas se alinean a la izquierda.
- El carrusel horizontal de cuatro frames pertenece al styleframe comparativo. No obliga a que la app de producción sea un carrusel.
- Cada pantalla futura debe mantener una columna legible, evitar recorte de controles y conservar los pisos tipográficos a `390px`.
- Si se usa scroll horizontal en un comparador o recorrido, debe tener affordance visible, orden de foco coherente y alternativa usable por teclado.

## Accesibilidad y movimiento

- Usar HTML semántico para formularios, botones, navegación, estados y mensajes.
- Mantener labels asociados a cada campo y errores vinculados mediante texto.
- Probar contraste con la fuente y el render final. Los tokens aprobados no sustituyen la verificación de contraste en producción.
- El foco visible usa tinta fósforo y no depende de box-shadow luminoso.
- No existe movimiento obligatorio en la semilla. Cualquier impresión o auto-scroll futuro debe detenerse con `prefers-reduced-motion: reduce` y mostrar el contenido completo de inmediato.
- El orden visual y el orden DOM deben coincidir.
- No ocultar información necesaria en hover.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Reglas de uso

### Sí

- Usar papel, tinta, ranura, reglas, perforaciones y datos reales para expresar el sistema.
- Crear jerarquía con tamaño, intensidad, espaciado y composición.
- Reservar el bloque invertido para una acción o estado funcional importante.
- Mantener visible la continuidad del mismo `user_id` entre registro, contenido y conversación.
- Mantener el acceso gratuito independiente de pagos y cursos.

### No

- No reutilizar el lenguaje de transmisión pirateada, Matrix o terminal de las landings antiguas.
- No añadir radios, gradientes de marca, neón, glassmorphism ni sombras sin función física.
- No convertir cada bloque en una card SaaS.
- No reducir cuerpo, labels o controles para acomodar contenido.
- No introducir integración, copy o estados de Hotmart en este slice.
- No tratar este documento como autorización de implementación.

## Criterios para aprobar esta semilla

1. Los tokens reproducen la dirección visual del styleframe v1.
2. Cuerpo y formulario respetan `18px`; soporte y controles, `16px`; metadata técnica, `14px`; nada visible baja de `14px`.
3. Los componentes separan claramente documento, acción, identidad, contenido y conversación.
4. Responsive, foco, semántica y reduced motion tienen contratos explícitos.
5. La semilla no prescribe runtime, dependencias, hosting ni integración de pagos.
6. `implementation_authorized` permanece en `false` hasta una aprobación humana posterior y explícita.

## Estado congelado

Felo aprobó esta semilla completa el 2026-09-20. Este v1 no se reescribe. Cualquier reemplazo futuro comienza como candidato mutable `v1.x` y solo se congela como v2 tras una nueva aprobación completa. La aprobación de esta semilla no autoriza implementación. Las decisiones de runtime y proveedor de email, junto con una autorización explícita que cambie `implementation_authorized` a `true`, permanecen separadas.
