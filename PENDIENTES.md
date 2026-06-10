# Pendientes / Roadmap — Areben Producción

> Bitácora de trabajo para no perder el avance ni el rumbo entre sesiones.
> **Actualizar este archivo al cerrar cada sesión de trabajo.**

_Última actualización: 2026-06-10_

---

## 🎯 A dónde se quiere llegar (objetivo actual)

Cerrar el módulo **Capital de Producción + Ficha de Corte** (rama `feature/produccion-ficha-corte`)
y llevarlo a producción vía merge a `main`.

---

## 🔴 Pendiente

- [ ] **Mergear `feature/produccion-ficha-corte` → `main`**
  - 13 commits acumulados sin pasar a producción (deploy es autodeploy desde `main`).
  - PR va por la web de GitHub (`gh` CLI no está instalado).
  - Repo: `brunoarevalo-arbn/areben-produccion`.
- [ ] **Retomar `/tiempos` del worktree `sad-khorana-04cf1d`** (rama `claude/sad-khorana-04cf1d`)
  - Cambios SIN commitear: `Cronometro.tsx` y `LogRegistros.tsx` (nuevos) + edits en
    `app/api/tiempos/route.ts`, `app/tiempos/page.tsx`, `hooks/useTiempos.ts`.
  - OJO: ese worktree está sobre una base distinta (parece experimento/sandbox). Decidir si se
    integra o se descarta.

## 🟡 En progreso

- _(nada activo ahora mismo)_

## ✅ Hecho (referencia)

- Cortadores y motivos de descarte como tablas
- Costo de corte (total o por unidad) + pagos masivos a cortadores
- Revertir/editar corte ya cargado (admin + diseñadora)
- Ficha + consumo unificados en "Registrar corte" con desglose por talle
- Rinde por insumo + consumo de tela en metros
- Estados granulares de OP (Fase 2)
- Modelo InsumoColor + gestión de colores
- Módulo Capital de Producción base (Fase 1): insumos, compras, rollos, lotes

---

## 📝 Notas / decisiones abiertas

- _(agregar acá dudas o decisiones que queden por resolver)_
