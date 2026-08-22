# AGENTS.md — Comunidad (Sociedad Paralela)

Repo del sitio web y aterrizaje de la comunidad **Sociedad Paralela**.
Remote: `felores/comunidad`.

## Qué es

Sociedad Paralela es un movimiento por la soberanía tecnológica y económica en
el mundo hispanohablante: una economía paralela donde humanos y agentes
transaccionan libremente, sin control corporativo ni gubernamental, open source
y agnóstico al proveedor.

La estrategia de comunidad y el embudo viven en el vault, no aquí:
`felo/comunidad/AGENTS.md` es la autoridad de estrategia. Este repo es la
verdad del sitio (HTML desplegado y futura app).

## Estructura

```text
comunidad/
├── site/       # HTML autocontenido desplegable (sin build, sin deps)
│   ├── index.html                   # Entrada / identidad
│   ├── waitlist.html                # Captura de correo (transmisión)
│   ├── countdown.html               # Apertura de la comunidad 01.09
│   └── landing-centro-operaciones.html  # Narrativa: centro de operaciones IA
├── README.md
└── AGENTS.md
```

## Stack (contrato)

- **HTML autocontenido**: cada página es un archivo HTML con CSS + JS inline.
- Sin build, sin dependencias salvo Google Fonts (Anton + JetBrains Mono).
- Sistema visual único: "transmisión pirateada" (status bar + scanlines +
  marquee + form), fósforo nocturno sobre papel oscuro (OKLCH ~149-150).
- Las landings nuevas siguen ese mismo mundo visual; no se introducen marcos.

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
- Nunca em-dash. Español neutro.

## Relación con el vault

| Capa | Dónde vive |
|---|---|
| Estrategia, embudo, decisiones | `felo/comunidad/AGENTS.md` + `felo/wiki/` |
| Manifiesto y narrativa | `felo/comunidad/manifesto.md` |
| Sitio desplegable | **este repo** (`site/`) |
| Research externo | `felo/comunidad/docs/research/` (inmutable) |