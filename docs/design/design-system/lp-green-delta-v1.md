# Delta del sistema de diseño para la landing v1

Fecha: 2026-09-20

## Estado

- Estado: aprobado e inmutable bajo la política de versionado por ciclo de aprobación.
- Styleframe aprobado: [`../styleframes/lp-green-v1.html`](../styleframes/lp-green-v1.html).
- Hereda la arquitectura aprobada del primer slice, pero no cambia sus recorridos ni contratos.
- Convive con el [seed v1 de la aplicación](primer-slice-comunidad-gratis-seed-v1.md). No lo reemplaza, recolorea ni reinterpreta.
- Solo puede aplicarse a la landing pública después de una autorización de implementación explícita y separada.
- `implementation_authorized: false`.

## Frontera entre landing y aplicación

| Decisión | Landing aprobada v1 | Aplicación aprobada v1 |
|---|---|---|
| Metáfora | Hero editorial con campo atmosférico. | Recibo de acceso térmico. |
| Tipografía principal | Geist Sans o una grotesca compatible. | DotGothic16 en toda la interfaz. |
| Mono | Solo metadata y rótulos breves. | Voz mecánica principal. |
| Forma | Radios modestos y bordes continuos. | Radio `0`, reglas y corte térmico. |
| Profundidad | Transparencia y blur contenido. | Máquina, papel y cavidades físicas. |
| Acento | Verde en cerca del `10%` del cuadro. | Una tinta fósforo como lenguaje dominante. |
| Movimiento | Entrada corta y campo ambiental opcional. | Sin movimiento obligatorio. |

La landing puede preparar el ingreso a la comunidad. Al entrar en registro o en la aplicación, el lenguaje cambia al recibo térmico aprobado. Ese cambio debe sentirse intencional, no como una transición accidental entre dos temas.

## Tokens exclusivos de LP

Los tokens usan el prefijo `sp-lp-*`. No sobrescriben los tokens `sp-*` del seed v1.

```css
:root {
  color-scheme: dark;

  --sp-lp-page: #0b0f0d;
  --sp-lp-surface: #131a16;
  --sp-lp-surface-translucent: rgb(19 26 22 / 0.78);
  --sp-lp-border: #29352e;
  --sp-lp-text: #f0f5f1;
  --sp-lp-muted: #9aa89f;
  --sp-lp-phosphor: #9cff8a;
  --sp-lp-accent-strong: #52e878;
  --sp-lp-action: #173d27;

  --sp-lp-font-sans: "Geist", "Helvetica Neue", Arial, sans-serif;
  --sp-lp-font-mono: "Geist Mono", "SFMono-Regular", Consolas, monospace;

  --sp-lp-size-display: clamp(3rem, 7vw, 6.75rem);
  --sp-lp-size-lede: clamp(1.125rem, 1.8vw, 1.375rem);
  --sp-lp-size-control: 1rem;
  --sp-lp-size-meta: 0.875rem;

  --sp-lp-radius-control: 0.625rem;
  --sp-lp-radius-panel: 1rem;
  --sp-lp-radius-mobile-nav: 1.375rem;
  --sp-lp-control-height: 2.5rem;
  --sp-lp-shell: 76rem;
  --sp-lp-focus: 2px solid var(--sp-lp-phosphor);
  --sp-lp-focus-offset: 3px;
}
```

## Contratos LP

### Navegación flotante

- Fija en la parte superior, dentro del shell.
- Fondo translúcido con blur. Si `backdrop-filter` no existe, usa `--sp-lp-surface` sólido.
- Borde de `1px` y radio de panel.
- En mobile mantiene al menos `16px` de separación lateral.
- No copia enlaces ni rutas de la referencia visual.

### Hero editorial

- Desktop usa una retícula `minmax(0, 1.15fr) minmax(20rem, 0.85fr)`.
- El display limita su línea a unas `10ch` y conserva un interlineado cercano a `0.92`.
- El lede limita su ancho a `38rem`.
- La acción principal mide al menos `40px` de alto y no depende solo del verde para indicar interactividad.

### Campo atmosférico

- Es decorativo y usa `aria-hidden="true"`.
- Mantiene contraste bajo detrás de cualquier borde o rótulo.
- Tiene fallback estático por CSS, visible sin JavaScript.
- Un modo dinámico futuro debe demostrar su equivalencia visual con capturas desktop y mobile antes de aprobarse.

### Acción y foco

- Acción primaria: superficie `--sp-lp-action`, texto `--sp-lp-text`, borde `--sp-lp-border`.
- Hover puede elevar el borde o el fondo. No puede ser el único estado.
- `:focus-visible` usa `--sp-lp-focus` y offset de `3px`.
- Todos los controles conservan `40px` de altura mínima.

### Tipografía

- Sans para texto de lectura y acción.
- Mono solo para metadata, índices y estados de revisión.
- Piso de `18px` para cuerpo principal, `16px` para controles y navegación, `14px` para metadata.
- La variante DotGothic16 del styleframe existe solo para comparar la continuidad con la aplicación. No es la recomendación LP actual.
- El styleframe carga las familias reales mediante [Google Fonts CSS2](https://fonts.googleapis.com/css2?family=DotGothic16&family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600&display=swap), con preconexión a `fonts.googleapis.com` y `fonts.gstatic.com`. La fuente remota es evidencia de revisión, no una decisión de dependencias o producción.

## Movimiento y fallback

```css
.lp-enter {
  animation: lp-enter 700ms cubic-bezier(.2, .7, .2, 1) both;
}

@keyframes lp-enter {
  from { opacity: 0; filter: blur(8px); transform: translateY(12px); }
  to { opacity: 1; filter: blur(0); transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

La abstracción CSS estática es el fallback obligatorio. No se reemplaza por un fondo vacío si falla una mejora dinámica.

## Pruebas del Human Gate

El styleframe debe permitir comparar:

1. Base neutra frente a tinte verde.
2. Geist Sans frente a DotGothic16 como display.
3. Mono restringido a metadata.
4. Abstracción estática frente a campo ambiental suave.
5. Cobertura de acento de `5%`, `10%` y `20%`.
6. Acción, foco y controles de `40px`.
7. Composición desktop y mobile a `390px`.
8. Estado sin movimiento mediante el selector del sistema.

## Condiciones verificadas para aprobar

- La landing conserva la composición y sobriedad de la referencia sin copiar su producto.
- El verde se percibe como tinte de marca, no como tema Matrix o terminal.
- El cuerpo sigue en sans y el mono queda en metadata.
- Desktop y mobile conservan jerarquía, aire y CTA visible.
- El fallback estático funciona sin depender del canvas no capturado.
- La aprobación nombra este delta y el styleframe. No modifica por implicación el seed v1 de la aplicación.

## Estado congelado

Felo aprobó este delta completo y el styleframe asociado el 2026-09-20. Este v1 no se reescribe. Cualquier reemplazo futuro comienza como candidato mutable `v1.x` y solo se congela como v2 tras una nueva aprobación completa. La aprobación visual no autoriza implementación, canvas, WebGL, cambios en `site/`, runtime, dependencias, despliegue, DNS, Hotmart, publicación, commit ni push.
