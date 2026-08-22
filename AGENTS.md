# AGENTS.md — Comunidad (Sociedad Paralela)

Repo del sitio web y la comunidad **Sociedad Paralela**.
Remote: `felores/comunidad`.

## Qué es

Sociedad Paralela es un movimiento por la soberanía tecnológica y económica en
el mundo hispanohablante: una economía paralela donde humanos y agentes
transaccionan libremente, sin control corporativo ni gubernamental, open source
y agnóstico al proveedor.

La estrategia de comunidad y el embudo viven en el vault, no aquí:
`felo/comunidad/AGENTS.md` es la autoridad de estrategia. Este repo es la
verdad desplegada: sitio, posts y catálogo de cursos.

## Estructura

```text
comunidad/
├── site/                     # Sitio desplegable
│   ├── *.html                # Landings autocontenidas (sin build hoy)
│   └── content/
│       └── posts/            # Posts de la comunidad (MDX con frontmatter)
├── cursos/                   # Catálogo de cursos educativos
│   ├── cerebro-artificial/
│   │   ├── CONTENIDO.md      # Índice: módulos, orden, gating (derivado del PRD del vault)
│   │   └── modulos/          # Lecciones listas para distribuir
│   ├── interfaces-agenticas/
│   │   ├── CONTENIDO.md
│   │   └── modulos/
│   └── _plantilla/           # Shape que todo curso nuevo copia
├── README.md
└── AGENTS.md
```

## Posts (contenido de la comunidad)

Los posts NACEN en este repo, no en el vault. El vault conserva el research y
las ideas (`felo/wiki/ideas/`); el post terminado se escribe aquí en **MDX**
(permiten componentes de Astro: embeds, cards de la transmisión) y se publica
con commit + deploy.
## Posts (contenido de la comunidad)

Los posts NACEN en este repo, no en el vault. El vault conserva el research y
las ideas (`felo/wiki/ideas/`); el post terminado se escribe aquí en **MDX**
(permiten componentes de Astro: embeds, cards de la transmisión) y se publica
con commit + deploy.

### Publicaciones de la comunidad vs publicaciones propias (NO mezclar)

- Este repo es SOLO para publicaciones de la comunidad (contenido que consume
  Sociedad Paralela): `site/content/posts/`.
- Las publicaciones propias de Felo (X, LinkedIn, YouTube, Instagram) NO van
  aquí: viven en el vault `felo/contenido/[canal]/`.
- Un post de comunidad se escribe en este repo en MDX. Un script o guión
  personal se escribe en el vault en markdown. Si no es seguro a qué tipo
  pertenece, preguntar antes de crear el archivo.

Frontmatter mínimo por post:

```yaml
---
title: Título
publishDate: YYYY-MM-DD
status: draft | publicado
tags: [tag1, tag2]
---
```

Flujo: idea nace en `felo/wiki/ideas/` → post en `site/content/posts/*.mdx`
→ commit → deploy al sitio.

## Cursos (catálogo)

El catálogo de cursos vive en `cursos/`. Cada curso: `CONTENIDO.md` (promesa,
precio, acceso, módulos, derivado del PRD que vive en el vault `edtech/*/prd/`)
+ `modulos/` (lecciones listas). La planeación y el marketing de cada curso
viven en el vault `edtech/*`. El sistema de entrega (login, gating de pagos,
navegación) trata a todos los cursos con el mismo contrato.

## Stack (contrato)

- **Landings**: HTML autocontenido (CSS + JS inline), sin build; solo Google
  Fonts (Anton + JetBrains Mono). Sistema visual único: "transmisión
  pirateada" (status bar + scanlines + marquee + form), fósforo nocturno sobre
  papel oscuro (OKLCH ~149-150).
- **Posts**: MDX con frontmatter (ver arriba).
- **Futura app** (login, comentarios, lecciones): Astro + MDX + HTMX/Tailwind.
  Sin frameworks pesados. Login propio (email + password); comentarios
  Remark42 + SSO.
- Las piezas nuevas siguen ese mismo mundo visual; no se introducen marcos.

## Captura de correo (contrato)

- Cada landing lleva `FORM_ENDPOINT = ""` vacío: hoy cae a `localStorage`
  (`sp_waitlist`) con `fuente: <nombre-pieza>` para atribución.
- Cuando exista backend de captura (lista de correo / Dittofeed / Reach), se
  configura solo `FORM_ENDPOINT`; el JS ya hace POST JSON `{ email }`.
- No registrar teléfono durante el piloto. Email = conector de identidad.

## Pagos (contrato)

- **Cursos**: proveedor modular `curso payments provider` (actual: Hotmart).
  Modelo: login propio + verificación de compra por email contra Sales API +
  webhooks. Detalle en el vault `.docs/hotmart-api-reference.md`.
- **SaaS**: `SaaS payments provider` (actual: Polar.sh).
- Nunca nombrar el proveedor como parte del sistema; es un dato anotado y
  reemplazable.

## Hosting

Objetivo: dominio `sociedadparalela.com` en Vercel o Cloudflare Pages
(estático, sin build). El deploy final está pendiente de decidir proveedor.

## Reglas

- No meter frameworks ni build steps en `site/` sin aprobación.
- No inventar claims sobre herramientas de la comunidad; las descripciones de
  los módulos (Narrate, Picnode, KIE, Sinapso) deben rastrear a la realidad
  de cada repo.
- El vault sigue siendo el origen de la estrategia; el repo despliega.
- Los posts no se escriben en el vault: nacen aquí en `site/content/posts/`.
- Nunca em-dash. Español neutro.

## Relación con el vault

| Capa | Dónde vive |
|---|---|
| Estrategia, embudo, decisiones | `felo/comunidad/AGENTS.md` + `felo/wiki/` |
| Manifiesto y narrativa | `felo/comunidad/manifesto.md` |
| Research e ideas de posts | `felo/wiki/ideas/`, `felo/comunidad/docs/research/` |
| Planeación de cursos (PRD, marketing) | `edtech/*/prd/` |
| Posts y contenido terminado | **este repo** (`site/content/posts/`) |
| Sitio desplegable | **este repo** (`site/`) |
| Catálogo de cursos (contenido) | **este repo** (`cursos/`) |