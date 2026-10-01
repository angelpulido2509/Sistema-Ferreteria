# Acceso remoto seguro a FerrePro

> Contexto: hallazgo **S1** de `AUDITORIA-SISTEMAS-FERREPRO.md`. El antiguo script `pnpm tunnel`
> publicaba Vite (y por el proxy, toda la API) en una URL pública de `trycloudflare.com` **sin
> ningún login**. Se eliminó en la Fase 0.

## Configuración por defecto (segura)

- **Vite** escucha solo en `localhost:5173` (`apps/web/vite.config.ts`). Sin `allowedHosts: true`.
- **API** acepta solo los orígenes listados en `CORS_ORIGIN` (separados por comas). Cualquier otro
  origen de navegador recibe `403 Origen no permitido`.

## Usar el sistema desde otro equipo de la misma red (LAN)

Solo si es necesario (p. ej. la PWA en un teléfono del local):

1. En el `.env` raíz, agregar el origen exacto a `CORS_ORIGIN`:
   `CORS_ORIGIN=http://localhost:5173,http://192.168.1.50:5173`
2. Arrancar el frontend con la variable explícita:
   ```powershell
   $env:VITE_DEV_HOST = "0.0.0.0"; pnpm dev:web
   ```
3. Permitir el puerto 5173 en el firewall de Windows **solo para la red privada**.

## Acceso desde fuera del local (dueño)

No usar el quick-tunnel anónimo de cloudflared (`cloudflared tunnel --url ...`): cualquiera que
obtenga la URL llega a la pantalla de login y a la API.

Alternativas recomendadas, de más simple a más compleja:

### Opción A — Tailscale (recomendada)
1. Instalar Tailscale en la PC de la ferretería y en el teléfono/PC del dueño, con la misma cuenta.
2. Acceder por la IP privada de Tailscale (`100.x.y.z:5173`), siguiendo los pasos de LAN de arriba
   con esa IP en `CORS_ORIGIN`.
3. Nada queda expuesto a Internet; solo los dispositivos autorizados en la red Tailscale ven el sistema.

### Opción B — Cloudflare Tunnel con Cloudflare Access
1. Crear un túnel **con nombre** (no quick-tunnel) asociado a un dominio propio.
2. En Cloudflare Zero Trust → Access, crear una aplicación para ese hostname con política
   "solo estos correos" (login por código al correo o Google).
3. Agregar `https://<hostname>` a `CORS_ORIGIN`.
4. Verificar que, sin iniciar sesión en Access, la URL **no** muestra la app.

En ambos casos siguen aplicando el rate-limit de login, contraseñas fuertes y la rotación de secretos
de la Fase 0.
