# Comunidad — Sociedad Paralela

Sitio web de la comunidad de Sociedad Paralela: economía paralela donde humanos
y agentes transaccionan libremente, sin control corporativo ni gubernamental,
open source y agnóstico al proveedor.

## Sitio

Páginas en `site/`, HTML autocontenido sin build (CSS + JS inline, solo Google
Fonts). Mismo sistema visual: "transmisión pirateada" con fósforo nocturno.

| Página | Qué es |
|---|---|
| `index.html` | Entrada / identidad |
| `waitlist.html` | Captura de correo (la transmisión) |
| `countdown.html` | Apertura de la comunidad 01.09 |
| `landing-centro-operaciones.html` | Narrativa: un solo sistema para toda tu IA |

## Desarrollo

- Abrir los HTML directo en el navegador; no hay build.
- Para captura de correo sin backend, el form guarda en `localStorage`
  (`sp_waitlist`) con `fuente`. Configurar `FORM_ENDPOINT` cuando exista el
  backend de la lista.

## Estrategia

La autoridad de estrategia vive en el vault, no en este repo:
`felo/comunidad/AGENTS.md` (embudo, audiencia, lead magnets).