# 📖 Guía de Mira Estudio — cómo funciona tu página y cómo mantenerla

Esta guía está pensada para que puedas trabajar en tu página **con o sin Claude**.
Guardala, y si algún día te trabás, empezá por acá.

---

## 1. Qué es cada archivo

Todo lo importante está en la carpeta `pagina/`:

| Archivo | Qué es |
|---|---|
| `index.html` | La **landing**: lo primero que ve una visita. Hero, cursos, ebooks, turnos, login y registro. |
| `dashboard.html` | El **área de alumnas**: cursos, lecciones, notas, progreso, ebooks, turnos, perfil. |
| `admin.html` | Tu **panel de administración** (solo vos). |
| `shared.js` | El "cerebro": todo el código JavaScript que comparten las tres páginas. |
| `shared.css` | Todos los **estilos** (colores, tipografías, tamaños) compartidos por las tres páginas. |
| `firestore.rules` | Las reglas de seguridad de tu base de datos (ver sección 5 — **pendiente de aplicar**). |

Fuera de `pagina/`:
- `mira-estudio-completo.html` — versión vieja, ya no se usa (se puede borrar cuando quieras).
- `backup-2026-07-06/` — copia de seguridad de la página antes de las mejoras de julio 2026.
- `GUIA.md` — esta guía. `CLAUDE.md` — resumen técnico para Claude.

## 2. Cómo funciona por dentro (en criollo)

- **Firebase** es tu base de datos y sistema de cuentas en la nube (proyecto "mira-estudio" en console.firebase.google.com). Ahí viven: los cursos y textos del sitio (colección `site`), los datos de cada alumna (`users`) y los turnos (`turnos`).
- **Cloudinary** guarda las imágenes que subís desde el panel (portadas, logo, fondo).
- **localStorage** es una memoria local del navegador de cada persona: la página la usa como "cache" para andar rápido y sin internet, pero la verdad siempre está en Firebase.
- **GitHub** guarda los archivos de la página y la publica; tu dominio de **Hostinger** apunta ahí.

El flujo: una alumna abre la página → se baja el contenido desde Firebase → lo que hace (avanzar lecciones, notas, turnos) se guarda en su navegador **y** en Firebase, así no pierde nada si cambia de celular a compu.

## 3. Cambios comunes: casi todo desde el panel admin (sin tocar código)

Entrás al panel haciendo **5 clics seguidos en el logo** + tu contraseña, o con `?admin=1` en la dirección. Desde ahí podés:

- Crear/editar **cursos, módulos y lecciones** (videos de YouTube/Vimeo/Drive, PDFs).
- **Ebooks**: portada, precio, link de pago.
- **Cursos**: el campo **Emoji** ahora dice *«solo lo ves vos»*: te sirve para reconocer el curso de un vistazo acá adentro del panel, pero **las alumnas ya no lo ven**. Ellas ven la foto de portada del curso y, si el curso todavía no tiene foto, la inicial del curso en dorado. Si querés que un curso se vea lindo en la página, subile una **foto de portada**.
- **Textos** de la landing, **colores y logo** (pestaña Estética).
- **Horarios de turnos** disponibles y gestión de solicitudes (confirmar, cancelar, WhatsApp). Cuando atendés a una clienta, cambiá su turno a **«💅 Atendida»**: se abre solita una ficha para anotar **qué le hiciste** (técnica, curvatura, largo, observaciones — eso lo ves solo vos). Con eso se arma la pestaña **«👤 Historial por clienta»** del mismo panel: todos los turnos de cada clienta juntos (aunque haya escrito el teléfono distinto cada vez), con sus notas, un buscador, su botón de WhatsApp y — si al servicio le pusiste el **«se repite cada X días»** en el Catálogo completo — un avisito de **cuándo le tocaría volver**, ideal para escribirle justo a tiempo.
- FAQ, features, recursos.
- **Testimonios** (⭐ en el menú del panel): cargá opiniones reales de tus alumnas y aparece sola una sección de testimonios en la página principal. Sin testimonios cargados, la sección no se muestra.
- **Página de Cursos** (🎓 en el menú del panel): todo lo que ve una visita en la pestaña "Cursos" antes de registrarse — portada, para quién es, qué va a aprender, cómo se estudia, la hoja de ruta y las preguntas frecuentes. **Los cursos, módulos y clases NO se editan ahí**: salen solos de 📚 Cursos. Truco: poné *asteriscos* alrededor de una palabra del título y sale en dorado e itálica.
- **Catálogo completo** (🗂 en el menú del panel — antes se llamaba "Página Servicios"): el catálogo completo de `servicios.html` (link "Servicios" de la portada), cargado con tu Catálogo 2026 — **54 servicios en 8 secciones, cada uno con su ficha «Más info» ya escrita**. Acá se edita **absolutamente todo** lo de esa página:
  - **Encabezado** (etiqueta, título, subtítulo) y **banda de promoción**.
  - **🎨 Colores de la página**: tocás cada cuadradito (fondo, bordó, dorado, títulos, texto) y queda con tu paleta. Si algo queda mal, el botón «↺ Volver a los de fábrica» lo arregla al toque.
  - **Promociones y combos**: juntás varios servicios con precio especial, foto y fecha de vencimiento (las vencidas se ocultan solas).
  - De cada **sección**: nombre, descripción corta, ficha «Más info», foto principal, galería y video.
  - De cada **servicio** (abrís el acordeón "Servicios de esta sección"): nombre, precio, nota, su **ficha propia** (si la dejás vacía usa la de la sección), **video**, **fotos propias**, **reseñas de clientas** (una por línea: `Texto | Nombre` — aparecen en la ficha con comillas) y **«se repite cada X días»** (alimenta el aviso de "le tocaría volver" del historial de turnos).
  - **El orden lo elegís vos**: flechitas ↑ ↓ tanto para las secciones como para cada servicio dentro de su sección.

  ⚠️ **Ojo**: hay DOS editores de servicios y son cosas distintas. **💅 Servicios del inicio** = las tarjetas del carrusel de la portada. **🗂 Catálogo completo** = la pestaña "Servicios" con los 54 servicios. Si no ves alguno de los dos botones en el menú, tu navegador tiene guardada una versión vieja: apretá `Ctrl+F5` para forzar la actualización.
  ⚠️ **Tenés 5 fichas sin completar**: en 💅 Servicios del inicio hay 5 tarjetas que dicen «Nuevo servicio», vacías (salieron de tocar «+ Nuevo servicio» sin llenarlas). Desde agosto de 2026 la página **ya no las publica**, así que las clientas no las ven — pero conviene que las borres con la ✕ para tener el panel prolijo. Regla nueva: una ficha que quedó tal cual la creó el botón (sin nombre propio, sin precio, sin descripción y sin fotos) no sale publicada; apenas le escribís algo, aparece.

- **Servicios** (💅 en el menú del panel): tus servicios con descripción, duración, precio, **varias fotos** (botón "+" para subirlas) y un **video opcional** (pegás un link de YouTube, Vimeo o MP4). En la página principal se ven con un servicio destacado en grande (con su galería de fotos/video) y los demás en una lista al costado, como los videos de YouTube; **el primero de la lista del panel es el que arranca destacado** (ordenalos para elegir tu servicio estrella). Al tocar "Reservar turno" se abre el formulario de reserva con ese servicio ya elegido. Precio vacío = muestra "Consultar".

⚠️ **Importante**: para que tus cambios se guarden en la nube (y no solo en tu compu), tenés que **iniciar sesión en la página con tu cuenta de administradora** antes de abrir el panel (ver sección 5). Si no, la página te avisa con un cartelito.

## 4. Cambios al código y cómo publicarlos

Para cambios que el panel no cubre (estructura, secciones nuevas):

1. **Editor**: instalá [Visual Studio Code](https://code.visualstudio.com/) (gratis). Abrí la carpeta `C:\Cosas\Mira studio`.
2. **Probar en tu compu**: hacé doble clic en `pagina/index.html` y se abre en el navegador. Refrescá con `Ctrl+F5` después de cada cambio.
3. **Publicar**: subí los archivos modificados a tu repositorio de GitHub (podés arrastrarlos en la web de GitHub: botón "Add file → Upload files" y confirmar con "Commit"). En unos minutos el cambio aparece en tu dominio.

**Regla de oro**: antes de un cambio grande, copiá la carpeta `pagina` a una carpeta `backup-FECHA`. Si algo se rompe, volvés atrás copiando los archivos de vuelta.

**Dónde está cada cosa en el código**:
- Colores y tipografías: en `shared.css`, al principio, en el bloque `:root{...}` (variables como `--gold`, `--c1`). **Se cambian una sola vez ahí y aplican a las tres páginas.** El panel admin tiene además sus propias variables `--adm-*` en un bloque chico dentro de `admin.html`.
- Textos fijos de la landing: buscá el texto en `index.html` con `Ctrl+F`.
- Lógica (botones, login, turnos, progreso): `shared.js`, está dividido con títulos tipo `// ═══ TURNO ═══`.

⚠️ Desde julio 2026, los tres HTML **necesitan** `shared.css` y `shared.js` para verse y funcionar. Cuando subas cambios a GitHub, subí siempre la carpeta completa (los 4 archivos + firestore.rules).

## 5. ⚠️ Pendientes de seguridad (hacelos cuando puedas, en este orden)

Estos tres pasos completan las mejoras de julio 2026. Sin ellos la página funciona, pero tu base de datos queda abierta.

**Paso 1 — Creá tu cuenta de administradora en la página:**
1. En tu página, registrate como una alumna más con el email **estudiosmira@gmail.com** y una contraseña segura.
2. Verificá el email (te llega un correo de Firebase).

**Paso 2 — Marcá tu cuenta como admin:**
1. Entrá a [console.firebase.google.com](https://console.firebase.google.com) → proyecto **mira-estudio** → Firestore Database.
2. En la colección `users`, buscá el documento con tu email.
3. Editá el campo `role` y ponele `admin` (en vez de `student`).
4. Desde entonces, al iniciar sesión en la página con esa cuenta vas directo al panel, ya con la nube habilitada.

**Paso 3 — Aplicá las reglas de seguridad:**
1. En la misma consola: Firestore Database → pestaña **Reglas** (Rules).
2. Abrí el archivo `pagina/firestore.rules` con el Bloc de notas, copiá todo.
3. Pegalo en la consola (borrando lo anterior) y tocá **Publicar**.

**Además**: cambiá la contraseña del panel si todavía es la que viene por defecto (panel admin → Config). Ojo: esa contraseña es solo una "cortina"; la protección real es tu cuenta de Firebase + las reglas.

## 6. Qué se arregló en julio 2026 (para que sepas qué esperar)

- **Turnos**: antes, cuando una clienta reservaba, podía *borrar* los turnos de las demás en la nube, y a tu panel solo llegaban los turnos hechos en tu propia compu. Ahora cada turno se guarda por separado en la nube y tu panel los baja todos al abrir la pestaña Turnos.
- **Horarios ocupados**: ahora todas las visitas ven los horarios ya tomados (antes solo veían los suyos).
- **Progreso y notas de las alumnas**: ahora se guardan en la nube por usuaria; pueden cambiar de dispositivo sin perder nada.
- **Aviso en el panel** cuando no iniciaste sesión y los cambios no van a la nube.
- **Avisos de turnos**: cada reserva te llega **por email a estudiosmira@gmail.com** (servicio gratuito FormSubmit — la primera vez te llega un correo "Activate Form" que tenés que aceptar una única vez). Además, al abrir tu panel te avisa cuántos turnos pendientes tenés.
- **Certificados**: al completar un curso, la alumna ve su certificado con su nombre y puede descargarlo (estaba roto desde mayo). El curso además reanuda en la última clase incompleta, las notas ya no se pierden al cambiar rápido de clase, y los avisos flotantes de todo el sitio volvieron a funcionar.

**Comunidad**: el chat ahora es real — los mensajes se comparten entre todas las alumnas en tiempo real (van a tu base de Firebase, colección `chat`). Solo pueden escribir alumnas con cuenta; nadie puede editar mensajes ajenos; vos podés borrar cualquier mensaje desde la consola de Firebase (colección chat → sala → msgs). **Requiere haber re-pegado las reglas de seguridad actualizadas** (mismo procedimiento de siempre: copiar `pagina/firestore.rules` → consola Firebase → Reglas → Publicar).

## 7. Cómo pedirle ayuda a Claude en el futuro

- Abrí Claude Code en la carpeta `C:\Cosas\Mira studio` — el archivo `CLAUDE.md` le explica todo el proyecto automáticamente.
- Sé concreta: *"quiero que la sección de ebooks muestre 4 por fila"* funciona mejor que *"mejorá los ebooks"*.
- Pedile siempre que **pruebe la página** antes de dar por terminado, y que te explique qué tocó.
- Si algo se rompió: contale qué hiciste, qué esperabas y qué pasó (una captura de pantalla ayuda muchísimo).

## 8. Diccionario mínimo

- **HTML** = el contenido y estructura de la página. **CSS** = los estilos (colores, tamaños). **JavaScript (JS)** = el comportamiento (qué pasa al hacer clic).
- **Firestore** = la base de datos de Firebase. **Colección** = como una carpeta de datos; **documento** = una ficha dentro de ella.
- **Repositorio (repo)** = la carpeta de tu proyecto en GitHub. **Commit** = guardar una versión. **Deploy/publicar** = poner la página online.
- **Consola del navegador** = apretá `F12` en Chrome → pestaña "Console": ahí aparecen los errores si algo falla (copiáselos a Claude).
