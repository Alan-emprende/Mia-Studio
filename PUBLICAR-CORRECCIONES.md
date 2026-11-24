# Publicar correcciones de acceso, archivos y señas — 24/11/2026

Esta actualización conserva los pagos digitales, sus avisos por Resend y la configuración de producción.

## 1. Actualizar el servidor

Abrí con el Bloc de notas:

    C:\workspace\mira-correcciones-20261124\backend-pagos\worker-cloudflare.txt

Copiá todo y reemplazá el código de Cloudflare → Workers y Pages → mira-pagos → Editar código → Implementar.

Conservá las variables y secretos actuales, MP_ENV=production y el cron existente */10 * * * *.
No hace falta cambiar las reglas actuales de Firestore.

Abrí https://mira-pagos.estudiosmira.workers.dev/health.
La revisión nueva es 20261124-access-bookings, apiVersion digital-v2 y scope digital-bookings.
ready verifica los campos de configuración; no comprueba una compra ni la agenda completa.

## 2. Publicar la web

La propuesta de GitHub incluye los archivos actualizados. Al incorporar la propuesta a main, GitHub Pages publica la web.
Si preferís subir archivos manualmente, usá los archivos de subir-web-corregida.zip, respetando sus carpetas.
Las copias worker-cloudflare.txt se incluyen para facilitar la publicación manual, pero GitHub Pages no actualiza Cloudflare.

Cuando termine la publicación, abrí la web con Ctrl+F5.

## 3. Revisar el acceso denunciado

En Cobros y señas → Comprobar acceso de una alumna, ingresá el email de la cuenta con la que detectaste el problema.
El informe indica si cada curso está habilitado por compra, por permiso manual, o porque está configurado como gratuito.
Las compras de prueba se indican y no habilitan cursos en producción.

Se corrigió un caso reproducido en pruebas: priceArs=0 de una versión antigua podía tratar como gratuito un curso cuyo precio visible era positivo.
Ahora ese cero no concede acceso y, al guardar el curso, el editor elimina el valor numérico anterior.
El caso concreto de esta cuenta debe confirmarse en el panel: no se consultaron ni modificaron sus permisos reales durante estas pruebas locales.

Si el informe dice Autorización manual del estudio, revisá Usuarios → Accesos antes de quitarla.
Una autorización manual puede ser válida aunque no haya compra. Quitarla no cancela pagos válidos independientes.

## 4. Completar los archivos de las clases

En Cursos → Editar → Módulo → Clase, cada recurso ahora tiene un campo para su enlace HTTPS.
Pegá el enlace real y guardá el módulo o el curso. También podés adjuntar un archivo como antes.

Los recursos que solo tenían un nombre, sin archivo ni enlace, aparecen como Archivo pendiente de carga.
La actualización no inventa PDFs ni recupera archivos que nunca fueron cargados.
Los adjuntos se descargan mediante un archivo real, y los enlaces se abren en una pestaña después de verificar el acceso.
Nombres con comillas ya no rompen los botones. Se conserva la protección de sesión y de curso.

## 5. Habilitar señas

En Cobros y señas → Reservas con seña:
1. Revisá Duraciones de los servicios. Cargá los minutos reales de cada servicio reservable.
2. Revisá que los precios del catálogo sean concretos y correctos. Consultar o rangos de precio requieren coordinación.
3. Dejá Seña (%) en 30. Podés editarlo cuando quieras; se aplica a reservas nuevas.
4. Marcá Habilitar reservas con seña y tocá Guardar señas.

No se activó automáticamente la opción en la base real: primero se deben comprobar precios y duraciones.
Los servicios sin duración y precio concretos no se pueden cobrar automáticamente.
Los nombres duplicados con precios diferentes requieren corregir el catálogo para evitar cobrar un importe ambiguo.

El horario queda apartado durante 20 minutos mientras se paga.
El turno se confirma solo después de validar el pago de la seña; el resto figura como saldo a pagar en el estudio.
Una reserva de servicio no concede acceso a cursos ni ebooks.
Los horarios superpuestos se validan por duración con escrituras condicionales en Firestore.
Los turnos anteriores se respetan. Si no tienen duración, se usa la duración configurada del servicio; si tampoco existe, se bloquea conservadoramente el resto de ese día desde su inicio.

Si un pago tardío llega cuando el horario ya no está disponible, queda En revisión. La clienta no debe volver a pagar: el estudio debe coordinar o devolver el pago desde Mercado Pago.
Cancelar un turno libera el horario y conserva el historial; no devuelve dinero automáticamente.
Las devoluciones notificadas por Mercado Pago actualizan el pago y liberan la reserva correspondiente.

## 6. Comprobación final

- Cuenta sin compra ni permiso manual: no debe reproducir un curso pago ni abrir sus archivos.
- Cuenta con permiso válido: debe abrir el curso y un PDF/enlace real.
- Correo de prueba: debe seguir llegando desde el panel de avisos.
- Para una prueba de reserva, utilizar un ambiente separado de prueba o acordar una reserva real. MP_ENV=production cobra dinero real.
- Las pruebas automáticas usan servicios simulados: no crearon compras, turnos ni mensajes reales.

Validación:

    node --test backend-pagos/worker.test.mjs backend-pagos/client.test.mjs backend-pagos/resources.test.mjs

Referencias:
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-settings/payment-methods
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-settings/term-of-preference
- https://firebase.google.com/docs/firestore/reference/rest/v1/Precondition

