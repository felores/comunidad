# Entitlement de Sinapso

Este directorio implementa el contrato aprobado para el compañero temporal de Cerebro Artificial. No distribuye Sinapso ni publica disponibilidad.

## Fuentes de verdad

- Contrato de oferta: `../CONTENIDO.md`.
- Motor de estados: `contract.mjs`.
- Gates locales de entrega: `platform-gates.json`.
- Estado técnico vigente de Sinapso: `${SINAPSO_FEATURES_PATH}` o, en desarrollo local, `../sinapso/.harness/features.json` desde la raíz de este repositorio.

## Integración esperada

El adaptador del proveedor modular de pagos debe convertir eventos verificados a estos eventos internos:

- `purchase.confirmed` con `id`, `occurredAt` y `platform`;
- `refund.validated` con `id` y `occurredAt`;
- `onboarding.completed` con `id`, `occurredAt`, `platform`, `sinapsoVersion` y, si aplica, `mcpCombination`.

`applyEntitlementEvent` conserva identificadores procesados para que el consumidor pueda aplicar webhooks de forma idempotente. La persistencia, autenticación del webhook y almacenamiento auditado pertenecen al futuro backend de entrega y no se simulan en este módulo estático.

## Habilitar una plataforma

Una plataforma solo puede cambiar a `approved` en `platform-gates.json` cuando:

1. el feature correspondiente en Sinapso está `passing` y tiene `verified_at`;
2. existe una aprobación humana de distribución para esa plataforma;
3. se registran `approvedAt`, `artifactVersion` y `evidence`;
4. `npm run check:platform-gates` pasa contra el repositorio vigente de Sinapso.

Compilar, crear un artefacto local o implementar el feature no basta. El estado inicial mantiene macOS y Windows bloqueados por `F100` y `F101`.

## Verificación

```bash
npm test
npm run check:platform-gates
```

La suite cubre corte común, compra tardía, reembolso, continuidad local, idempotencia, gate de plataforma y MCP limitado a búsqueda y lectura en combinaciones verificadas.
