# Publicación de la revisión de Mira Estudio

## Orden recomendado

1. Actualizá el Worker mira-pagos con backend-pagos/worker-cloudflare.txt en Cloudflare. Conservá ambiente de producción, secretos, variables y disparador de reintentos. En /health debe verse la revisión 20261124-defensive-hardening.
2. Publicá la web desde GitHub Pages y recargá las páginas con Ctrl+F5. El chat nuevo envía la fecha del servidor.
3. Publicá firestore.rules en Firebase Console → mira-estudio → Firestore Database → Reglas. Compará las reglas de consola con la versión anterior antes de reemplazarlas: conservá cualquier cambio hecho en consola que no esté en el repositorio. Las reglas nuevas dejan las fichas de atención en el panel de administración y restringen el chat a las salas comunes con correo verificado. Si un navegador sigue con la web anterior, recargalo para volver a enviar mensajes.

## Revisiones desde las cuentas reales

- Como alumna, en Mi perfil, actualizá una contraseña diferente y verificá que permita iniciar sesión. Si tu sesión es antigua, usá Olvidé mi contraseña.
- Abrí un curso con acceso y uno sin acceso, probá un archivo con enlace real y comprobá que el historial propio muestre la reserva o compra correspondiente.
- Comprobá desde administración que puedas ver las fichas de atención y registrar una nota. Los cobros reales se comprueban solo con una operación expresamente acordada o en un ambiente separado de prueba.
- Revisá Firebase Authentication y los permisos del proveedor de archivos. Los enlaces de terceros entregados a una cuenta autorizada pueden compartirse si el archivo está publicado con acceso por enlace. Para restringirlos por cuenta se necesita alojamiento privado con entrega autorizada.
- Revisá el preset de carga de imágenes en Cloudinary. El sitio usa un preset en el navegador. Si el preset es de carga sin firma, limitá formatos y tamaño en Cloudinary; la solución completa es pasar a cargas firmadas antes de desactivarlo.
- Revisá las claves de cuentas de servicio en Google Cloud. Si hay copias locales obsoletas, verificá el identificador de la clave y deshabilitala/retirala si ya no está en uso. Si una clave activa se compartió, reemplazala en Cloudflare, comprobá que el Worker sigue conectado y revocá la anterior.

Las pruebas locales no usan contraseñas, datos de clientas, crawlers de seguridad ni cobros reales. No validan las reglas que están activas en Firebase ni los permisos de archivos externos.

```sh
node --test backend-pagos/worker.test.mjs backend-pagos/client.test.mjs backend-pagos/resources.test.mjs backend-pagos/browser-privacy.test.mjs
```
