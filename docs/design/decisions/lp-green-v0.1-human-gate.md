# Human Gate para la landing verde v0.1

Fecha: 2026-09-20

## Decisión solicitada

Revisar como un solo paquete:

1. [Referencia visual de la landing v0.1](../references/lp-vercel-visual-dna-v0.1.md)
2. [Styleframe LP verde v1](../styleframes/lp-green-v1.html), congelado desde v0.1.
3. [Delta del sistema de diseño para la landing v1](../design-system/lp-green-delta-v1.md), congelado desde v0.1.

## Recomendación

Aprobar la variante inicial del styleframe:

- Tinte: verde.
- Cobertura de acento: `10%`.
- Display: sans grotesca.
- Mono: solo metadata.
- Campo: abstracción estática como base obligatoria.
- Movimiento: entrada breve, con eliminación completa bajo `prefers-reduced-motion`.

La variante de campo suave puede seguir como mejora opcional. No debe aprobarse como reproducción del canvas de referencia porque no existe captura runtime que permita comprobarla.

## Qué aprueba este gate

Si Felo aprueba el paquete completo, se puede:

- Congelar el styleframe LP v0.1 como `lp-green-v1`.
- Congelar el delta LP v0.1 como `lp-green-delta-v1`.
- Registrar ambos como autoridad visual exclusiva de la landing pública.
- Preparar una fase de implementación de landing separada, todavía sujeta a autorización explícita.

## Qué no aprueba

La aprobación visual no autoriza:

- Cambiar `site/`, rutas, runtime, componentes, estilos de producción o dependencias.
- Copiar el contenido, claims, arquitectura, tecnología o comportamiento del deployment de referencia.
- Recolorear o modificar el styleframe v1 y el seed v1 de la aplicación de comunidad.
- Implementar canvas, WebGL o movimiento dinámico.
- Cambiar Vercel, Hotmart, hosting, DNS, secretos o despliegues.
- Hacer commit, push, merge o publicación.

## Preguntas de revisión

1. ¿El tinte verde al `10%` conserva la sobriedad de la referencia?
2. ¿La grotesca sans debe ser la voz de la landing mientras DotGothic16 sigue siendo la voz de la aplicación?
3. ¿La abstracción estática funciona como base o debe cambiar su geometría antes de congelar v1?
4. ¿La composición mobile conserva suficiente aire sin perder la acción principal?

## Respuestas válidas

### Aprobar

> Apruebo el paquete LP verde v0.1 completo con tinte verde al 10%, display sans, mono solo en metadata y abstracción estática como base. Autoriza congelarlo como v1. No autorizo implementación.

### Pedir cambios

Indicar el control y el valor deseado. Ejemplo: `Acento 5%`, `Display App v1` o un cambio concreto de geometría del campo. Los cambios continúan en el mismo candidato v0.1 hasta el siguiente checkpoint humano significativo.

## Gate vigente

`approved`. Felo aprobó el paquete completo el 2026-09-20 con tinte verde al `10%`, Geist Sans para display y cuerpo, Geist Mono solo para metadata y abstracción estática como base obligatoria. El styleframe y el delta quedaron congelados como v1. La aplicación aprobada permanece intacta y `implementation_authorized` continúa en `false`.
