# Despliegue

Mad Office corre en el VPS en `/opt/mad-office`, **detrás del Traefik de Coolify**, como Olfateo
y Preventa (docker compose propio).

- URL: <https://mad-office.alvarosolis.dev> (registro A en Cloudflare → `167.235.244.168`, nube
  **gris** para que Traefik saque el certificado de Let's Encrypt).
- **Puerta:** la contraseña común de los paneles `*.alvarosolis.dev`, que pone
  `~/projects/bin/clave-paneles madoffice`. Sin ella no se entra.
- **La IA no corre en el VPS:** los turnos los resuelve tu despertador con tu suscripción:
  `./despertador/arrancar.sh --prod` (token en `~/.config/mad-office/produccion.env`, 600).
- Claves del servidor: `/opt/mad-office/.env` (600). **Nunca en el repo ni por el chat.**
- Datos: volumen `mad-office_datos`. Copia diaria cifrada a B2 (`copia-madoffice.sh`, 03:57) y
  un `pg_dump` en `/opt/mad-office/copias/` antes de cada publicación.

## Publicar una versión nueva

```sh
./deploy/publicar.sh     # tests → imágenes en el portátil → copia de la base → subir → reiniciar
```

Las migraciones se aplican solas al arrancar el backend.
