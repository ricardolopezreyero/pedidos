# Ranitas · Pedidos 🐸

App para armar pedidos familiares de **Gorditas Ranitas** (Torreón) sin drama. Cada anfitrión crea su tablero con su propia liga permanente, las familias entran, ponen a cada quien con sus gorditas (harina/maíz), chilaquiles, bebida y postre, y el anfitrión manda **un solo mensaje de WhatsApp** a la sucursal elegida, con resumen para cocina.

- **Home:** https://ranita.capitaltorreon.com/ — crear tablero de anfitrión o entrar con una liga.
- **Tablero:** `https://ranita.capitaltorreon.com/<liga>` (ej. `/familia-lopez-acosta`). La liga se conserva para siempre con su historial.
- Tablero tipo Kanban: **Armando → Pedido → Entregado → Historial**; repetir pedidos anteriores con un toque.
- Sincronizado en vivo entre todos los que abran la liga (Firebase Realtime Database, ruta `ranitas/tableros/<liga>`).
- Modo anfitrión por tablero (se confirma con el celular del anfitrión).

## Estructura
- `app/` — la app (un solo `index.html` + imágenes + `_redirects` para rutas SPA). Se publica en Cloudflare Pages (proyecto `ranita`): `npx wrangler pages deploy app --project-name ranita --branch main`.
- `index.html` (raíz) — redirección desde la liga vieja de GitHub Pages al nuevo dominio.
