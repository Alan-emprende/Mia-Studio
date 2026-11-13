# Activar Mercado Pago para cursos y ebooks

Actualizado: 13 de noviembre de 2026. Repositorio: https://github.com/Alan-emprende/Mia-Studio

La copia actual está en C:\Cosas\Mira studio\repositorio-actual. Esta es la versión que coincide con mirastudiotb.com. Para esta actualización usá esta carpeta; la carpeta pagina anterior pertenece a una versión distinta.

## 1. Actualizar el Worker en Cloudflare

1. Entrá a Cloudflare → Workers y Pages → mira-pagos → Editar código.
2. Abrí backend-pagos/worker-cloudflare.txt con el Bloc de notas.
3. Copiá TODO su contenido.
4. Dentro del editor de Cloudflare, hacé clic en el código, Ctrl+A y pegá el nuevo código completo.
5. Tocá Implementar.
6. Conservá las variables y los secretos ya cargados. MP_ENV debe seguir en test.
7. Abrí https://mira-pagos.estudiosmira.workers.dev/health

El resultado debe incluir:

    {"service":"mira-pagos","ready":true,"mode":"test","apiVersion":"digital-v2","scope":"digital"}

La presencia de apiVersion digital-v2 confirma que se publicó la versión nueva. ready indica que están los valores de configuración; la conexión real se comprueba en el paso 3.

## 2. Actualizar los archivos de la web en GitHub

El archivo subir-a-github.zip contiene únicamente esta actualización, sin claves privadas.

1. Hacé clic derecho sobre subir-a-github.zip → Extraer todo.
2. Entrá a https://github.com/Alan-emprende/Mia-Studio
3. En la carpeta principal del repositorio, elegí Add file → Upload files.
4. Arrastrá los archivos y la carpeta backend-pagos que están DENTRO de la carpeta extraída. No subas el ZIP ni una carpeta contenedora llamada subir-a-github.
5. Elegí Commit changes para guardar la actualización.
6. Esperá a que termine la publicación de GitHub Pages. Después abrí https://mirastudiotb.com y presioná Ctrl+F5.

Los ocho archivos que cambian la página son index.html, admin.html, cursos.html, dashboard.html, servicios.html, pagos.html, payments.js y payment-config.js. El paquete incluye también la documentación, el código del servidor y la copia de las reglas vigentes.

firestore.rules es una copia de las reglas que ya tenés publicadas y nos pasaste. NO hace falta volver a pegarlas en Firebase para este cambio. El Worker accede a Firestore con la cuenta de servicio; las alumnas siguen sujetas a las reglas.

## 3. Comprobar la conexión

1. Iniciá sesión en la web con estudiosmira@gmail.com. El email debe estar verificado.
2. Abrí el panel de administración → Pagos.
3. Confirmá que diga Ambiente: Pruebas.
4. Tocá Comprobar conexión.
5. El resultado esperado es Conexión correcta con Firebase y Mercado Pago. Catálogo protegido.

Si falta proteger el catálogo, andá a Alumnas → Accesos → Mantenimiento del catálogo y usá la opción de protegerlo. Esta operación conserva el contenido en privado y publica solo sus fichas; no da accesos automáticos a alumnas.

Si falla Firebase, revisá FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY y el permiso Usuario de Cloud Datastore (roles/datastore.user) de la cuenta de servicio.

Si Mercado Pago indica que la cuenta no es de prueba, obtené el Access Token de la sección Prueba de tu aplicación Checkout Pro. En el esquema actual puede empezar con APP_USR: el prefijo por sí solo no define si es una cuenta real o de prueba. El servidor consulta la cuenta antes de crear un checkout.

## 4. Preparar los productos

1. En Cursos, abrí un curso disponible para la venta y guardá su precio en pesos argentinos. Ejemplos: $19.900 o $19.900,50.
2. Confirmá que el curso tenga sus clases y enlaces completos, y que no esté marcado como bloqueado.
3. En Ebooks, elegí de pago, completá el precio en pesos y el enlace de descarga HTTPS.
4. Guardá los cambios. Esperá el aviso Contenido publicado.
5. Para productos gratuitos, usá Gratis como precio. En ebooks, elegí gratuito.
6. Volvé a Pagos, marcá Habilitar compras de cursos y ebooks y guardá la configuración.

Los textos USD 29, Consultar, precios con rangos o precios vacíos no se cobran automáticamente. Se conserva el acceso manual para las alumnas autorizadas.

La cuenta administradora tiene acceso al contenido: usá otra cuenta de alumna para probar una compra.

## 5. Hacer la compra de prueba

1. En Mercado Pago Developers → Tu aplicación → Cuentas de prueba, buscá o creá una cuenta COMPRADORA de Argentina, distinta de la cuenta vendedora.
2. Abrí una ventana de incógnito.
3. Entrá a mirastudiotb.com e iniciá sesión con una cuenta de alumna cuyo email puedas verificar. Esta cuenta de la web es distinta de la cuenta compradora de prueba de Mercado Pago.
4. Elegí el curso o ebook preparado.
5. Revisá el precio y tocá Pagar con Mercado Pago.
6. En Mercado Pago, iniciá sesión con la cuenta COMPRADORA de prueba. Usá los datos de tarjetas de prueba de la documentación oficial, nunca una tarjeta real durante esta etapa.
7. Simulá un resultado aprobado. Volvé al sitio y comprobá el acceso al curso o la descarga del ebook.
8. Probá también un pago rechazado: no debe habilitar contenido.
9. Para comprobar que llega el webhook, revisá las notificaciones de prueba de Mercado Pago. La URL debe seguir siendo https://mira-pagos.estudiosmira.workers.dev/webhooks/mercadopago y el evento Pagos (legacy).
10. Si el pago no aparece actualizado, tocá Actualizar estado desde Mis compras. El sitio consulta a Mercado Pago; un texto aprobado en la dirección del navegador no acredita nada.

Un webhook simulado con un ID inventado no sustituye una compra de prueba: el servidor consulta el pago real en la API de Mercado Pago.

Las compras de prueba están identificadas como tales. No habilitan contenido cuando se cambia a producción y no sirven como prueba de compra real para reseñas.

## 6. Habilitar cobros reales después de la prueba completa

1. En el panel Pagos, desmarcá la habilitación de compras y guardá.
2. En Mercado Pago, abrí el ambiente Producción de la misma aplicación. Configurá la misma URL de webhook, el evento Pagos (legacy) y obtené su firma secreta.
3. En Cloudflare reemplazá MP_ACCESS_TOKEN por el token de tu cuenta real y MP_WEBHOOK_SECRET por la firma de producción.
4. Cambiá MP_ENV a production e implementá.
5. La configuración de compras de producción comienza deshabilitada, separada de la de prueba.
6. Volvé a la web con Ctrl+F5 → Pagos. Debe decir Producción.
7. Tocá Comprobar conexión y, si está correcto, habilitá las compras y guardá.

No hace falta cambiar Firebase al plan de pago para ejecutar este servidor: usa Cloudflare Workers y la cuenta de servicio. El funcionamiento queda sujeto a las cuotas de los servicios y a las condiciones de cobro de Mercado Pago.

## Alcance y comportamiento

- Esta actualización permite cobrar cursos y ebooks con Checkout Pro.
- El precio se obtiene del contenido privado guardado por la administradora.
- Se verifica la cuenta de Firebase, el email, el importe, la moneda, el vendedor, el ambiente y la asociación entre pago y orden.
- Las notificaciones llevan firma. Repetir una notificación no duplica el acceso.
- Una devolución o contracargo revoca el permiso de ese pago. Una devolución parcial también lo revoca.
- Otro pago válido o una autorización manual del mismo producto se conserva.
- El contenido de clases y los enlaces de descarga no se publican en las fichas del catálogo.
- Las reseñas y accesos manuales existentes conservan sus archivos y sus reglas.
- Las señas, nuevas reservas y avisos por correo no forman parte de esta actualización. La agenda existente y las notas de atención siguen disponibles.
- Si una referencia de checkout venció o falló antes de abrir Mercado Pago, revisá Mis compras antes de elegir nuevamente el producto. No vuelvas a pagar una operación pendiente.
- Las pruebas locales usan servicios simulados: falta completar la compra real en el ambiente de prueba y verificar la recepción del webhook con las credenciales de esta cuenta.

## Volver atrás

Si necesitás desconectar los cobros, entrá a Pagos y desmarcá Habilitar compras. Para conservar solo el acceso manual anterior, podés dejar window.MIRA_PAYMENTS_API = ''; en payment-config.js y volver a publicarlo.

La versión previa de los archivos está en el historial de GitHub. Las reglas vigentes de Firebase no necesitan cambiar para desconectar este servidor.

## Validación técnica

Desde la carpeta del repositorio:

    node --test backend-pagos/worker.test.mjs backend-pagos/client.test.mjs

Las pruebas comprueban precios, propiedad de compras, firmas, pagos pendientes y aprobados, devoluciones, ambientes, acceso al contenido, publicación del catálogo, sesiones y el recorrido del cliente. No despliegan reglas ni realizan pagos.

Referencias oficiales consultadas:

- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/test-accounts
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases
- https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/runQuery
