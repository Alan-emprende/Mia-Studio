# Pagos y reservas de Mira Estudio

Worker único de Cloudflare, compatible con la web estática de GitHub Pages. Se conservan Firebase Auth, Firestore y los avisos por Resend.

- Cursos y ebooks: precios obtenidos en el servidor, órdenes verificadas contra Mercado Pago y permisos separados entre pruebas y producción.
- Reservas: seña inicial del 30% editable desde el panel; horarios apartados durante 20 minutos; confirmación del turno y saldo tras verificar el pago.
- Agenda: validación de duración y escrituras con precondición para impedir superposiciones. Pagos tardíos que encuentran un horario ocupado quedan en revisión.
- Archivos: autorización del curso antes de abrir o descargar; el administrador puede cargar los enlaces que faltan.
- Avisos: cola persistente de Resend, destino de administración fijo y cron cada diez minutos. Los fallos de correo no impiden acreditar el pago.

## Publicación

Seguir [PUBLICAR-CORRECCIONES.md](../PUBLICAR-CORRECCIONES.md). Actualizar primero Cloudflare con worker-cloudflare.txt y después incorporar los cambios de la web.

La revisión esperada de /health es `20261124-access-bookings`. El valor ready comprueba la presencia de configuración; las conexiones reales se revisan desde el panel.

Se conservan los secretos existentes: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY y RESEND_API_KEY. Nunca deben incluirse en GitHub.

Las reglas actuales de Firestore mantienen las órdenes, pagos, reservas y la agenda privada con escritura exclusiva del backend. No hace falta abrir permisos del navegador.

## Validación

    node --test backend-pagos/worker.test.mjs backend-pagos/client.test.mjs backend-pagos/resources.test.mjs

Las pruebas usan servicios simulados y no crean cobros ni correos reales. Después de publicar se debe comprobar la cuenta afectada, un recurso real y el flujo de reserva con un ambiente de prueba o una operación real expresamente acordada.

