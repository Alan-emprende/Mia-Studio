# Backend de pagos digitales

Entrada de Cloudflare: worker.mjs. Para pegar en el editor del dashboard, worker-cloudflare.txt es una copia idéntica.

Este servidor usa el contrato de la web vigente: /quote, /checkout, /access, /my-access, /order, /orders, /verify-order, /catalog, /settings y endpoints de administración. Confirma pagos firmados por /webhooks/mercadopago y acredita documentos planos en entitlements, compatibles con las reglas y las reseñas.

Las credenciales se cargan en Cloudflare, nunca en archivos públicos:

Variables: SITE_ORIGIN, EXTRA_ORIGIN, WORKER_ORIGIN, FIREBASE_PROJECT_ID, FIREBASE_API_KEY, MP_ENV.

Secretos: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.

La autenticación administrativa usa el email verificado estudiosmira@gmail.com. Los roles del perfil y localStorage no autorizan pagos ni contenido.

MP_ENV acepta test o production. Checkout Pro actual usa init_point con una cuenta vendedora de prueba para probar. El servidor comprueba la etiqueta test_user de la cuenta consultada en /users/me antes de crear un checkout en test.

No se implementan cobros de turnos ni envío de emails. Se conserva la lectura de la agenda existente y la edición de notas de atención.

La configuración habilitada/deshabilitada se guarda separada por ambiente en paymentConfig/digital_test y paymentConfig/digital_production. Comienza deshabilitada.

Sigue ../PUBLICAR-PAGOS.md para publicar y comprobar una compra completa. Ejecutá node --test backend-pagos/worker.test.mjs backend-pagos/client.test.mjs desde la raíz para las pruebas locales.

No desplegar las reglas antiguas del historial de GitHub. firestore.rules en esta actualización replica las reglas que ya estaban publicadas y fueron proporcionadas por la dueña el 13/11/2026.

## Límites actuales

El historial devuelve hasta 100 órdenes de una consulta acotada a 500 por cuenta (o 500 globales para administración). Los permisos por usuaria y la agenda también se consultan con límite 500. Ante una cuenta que supere ese volumen se debe agregar paginación.

La verificación manual consulta hasta tres pagos por orden. El webhook procesa cada pago por su identificador y guarda con precondiciones para evitar actualizaciones atrasadas.

Los accesos digitales confirmados se devuelven solo por la API autenticada. Las reglas de lectura directa de digitalContent continúan habilitando exclusivamente a administradora o alumnas con autorización manual. Las reglas no deben abrirse para el Worker.

Los enlaces de archivos y videos autorizados son visibles para quien compró; este cambio no añade DRM ni alojamiento de archivos con firma temporal.
