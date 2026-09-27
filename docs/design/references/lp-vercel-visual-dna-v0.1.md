# Referencia visual de la landing v0.1

Fecha: 2026-09-20

## Estado y límite

- Estado: referencia visual aprobada del paquete LP v1 congelado.
- Alcance: landing pública de Sociedad Paralela.
- Fuente visual: [deployment de referencia](https://v0-sociedad-paralela.vercel.app/) y su [CSS publicado](https://v0-sociedad-paralela.vercel.app/_next/static/chunks/66cff8ce3c50a649.css).
- Dirección humana aprobada: conservar composición y lenguaje visual, explorados con un tinte verde de Sociedad Paralela.
- Confianza: alta para composición, tipografía, color, espaciado, bordes y responsive. Media para el campo dinámico, porque el scout no capturó frames de su canvas en ejecución.
- `implementation_authorized: false`.

Esta referencia toma solo DNA visual. No toma contenido del evento, arquitectura de información, claims, rutas, tecnología, comportamiento de registro ni implementación. Tampoco reemplaza el styleframe v1 ni el seed v1 de la aplicación de comunidad.

## Qué conservar

### Composición

- Hero oscuro de altura completa, con navegación fija y translúcida.
- Shell centrado y ancho máximo contenido.
- Dos columnas en desktop. La columna editorial domina y el campo visual equilibra el lado derecho.
- Una sola acción primaria compacta. Los controles tienen una altura objetivo de `40px`.
- Mucho espacio negativo alrededor del titular. La densidad queda en metadata y navegación, no en el cuerpo.
- En mobile, el hero pasa a una columna centrada y el campo visual queda debajo del mensaje.
- La navegación móvil se presenta como un panel redondeado, compacto y separado de los bordes del viewport.

### Tipografía

- Sans grotesca para navegación, titular, cuerpo y acciones. La referencia usa Geist Sans.
- Mono solo para metadata, índices, estados y rótulos breves. La referencia usa Geist Mono.
- El titular depende de escala, ancho y ritmo. No depende de mayúsculas, efectos o una fuente mono.
- El styleframe aislado carga Geist, Geist Mono y DotGothic16 desde [Google Fonts CSS2](https://fonts.googleapis.com/css2?family=DotGothic16&family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600&display=swap). La comparación requiere conexión durante la revisión local por HTTP.
- Jerarquía LP propuesta:

| Rol | Tamaño propuesto | Piso |
|---|---:|---:|
| Display | `clamp(3rem, 7vw, 6.75rem)` | `48px` |
| Lede | `clamp(1.125rem, 1.8vw, 1.375rem)` | `18px` |
| Navegación y acción | `1rem` | `16px` |
| Metadata | `0.875rem` | `14px` |

Nada visible baja de `14px`. Mono no se usa para párrafos, botones completos ni titulares.

### Color

La referencia original es casi neutra. La propuesta desplaza las superficies hacia verde sin convertir toda la página en fósforo.

| Token LP | Valor | Uso |
|---|---|---|
| `--lp-page` | `#0B0F0D` | Fondo principal. |
| `--lp-surface` | `#131A16` | Navegación, paneles y superficies elevadas. |
| `--lp-border` | `#29352E` | Bordes finos y divisores. |
| `--lp-text` | `#F0F5F1` | Texto principal. |
| `--lp-muted` | `#9AA89F` | Cuerpo secundario y metadata. |
| `--lp-phosphor` | `#9CFF8A` | Foco, indicadores y acentos breves. |
| `--lp-accent-strong` | `#52E878` | Señales activas y detalle visual. |
| `--lp-action` | `#173D27` | Superficie de la acción primaria. |

El acento verde debe ocupar cerca del `10%` del cuadro. Los extremos de `5%` y `20%` existen solo como prueba de revisión. El fondo, el texto y la mayor parte de la composición siguen siendo neutros.

### Forma y bordes

- Bordes de `1px`, bajos en contraste, para navegación, controles y campo visual.
- Radios modestos. Propuesta base: `10px` para controles, `16px` para paneles y `22px` para el contenedor móvil.
- No hay perforaciones, cortes de papel, líneas punteadas ni metáforas de máquina. Esas formas pertenecen a la aplicación aprobada.
- No hay glow de neón. El verde aparece como tinta sólida, halo atmosférico de baja opacidad o anillo de foco.

### Imagen y campo atmosférico

- Un campo abstracto ocupa la segunda columna. Debe leerse como atmósfera, no como ilustración literal.
- La versión aprobable ahora es una abstracción estática hecha con gradientes suaves, masas desenfocadas y una línea orbital tenue.
- Un campo generativo futuro debe conservar la misma densidad, posición y contraste. No puede introducir partículas rápidas, lluvia de caracteres, retículas hacker ni símbolos de terminal.
- Si canvas, WebGL o JavaScript fallan, la abstracción estática permanece visible. El mensaje y la acción nunca dependen del campo.

### Movimiento

- Entrada permitida: opacidad, desenfoque leve y desplazamiento vertical corto.
- Duración orientativa: `500ms` a `800ms`. Una sola ejecución.
- El campo puede tener respiración lenta y casi imperceptible. No debe competir con el titular.
- Con `prefers-reduced-motion: reduce`, no hay transición, blur animado, parallax ni respiración. La composición aparece completa en su estado final.

### Responsive observado

| Ancho | Contrato visual |
|---|---|
| `>= 900px` | Hero en dos columnas, contenido alineado a la izquierda, campo a la derecha. |
| `< 900px` | Una columna, texto centrado, acción accesible sin scroll horizontal. |
| `390px` | Navegación en panel redondeado, display mínimo de `48px`, márgenes laterales de `16px`, campo debajo del CTA. |

No se reduce la tipografía por debajo de sus pisos para conservar la composición. Se apilan los elementos y se acorta el ancho de línea.

## Qué excluir

- Contenido, agenda, ponentes, fechas o registro del deployment de referencia.
- Arquitectura de información, rutas, navegación o comportamiento de formularios de esa fuente.
- Next.js, React, canvas u otra decisión técnica inferida del deployment.
- Matrix rain, scanlines, grids hacker, cursores parpadeantes, prompts o cuerpo monoespaciado.
- Claims de producto no aprobados.
- Cualquier recolor o modificación del styleframe v1 de la aplicación.

## Evidencia que falta

El aspecto exacto del canvas dinámico sigue sin una captura runtime. La propuesta no intenta reconstruirlo de memoria. Usa una abstracción estática deliberada y marca cualquier campo dinámico futuro como decisión separada.

## Artefactos relacionados

- Styleframe LP aprobado: [`../styleframes/lp-green-v1.html`](../styleframes/lp-green-v1.html)
- Delta LP aprobado: [`../design-system/lp-green-delta-v1.md`](../design-system/lp-green-delta-v1.md)
- Paquete de decisión: [`../decisions/lp-green-v0.1-human-gate.md`](../decisions/lp-green-v0.1-human-gate.md)
- Aplicación aprobada, sin cambios: [`../styleframes/primer-slice-comunidad-gratis-v1.html`](../styleframes/primer-slice-comunidad-gratis-v1.html)
