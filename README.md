# Space Lab — Sesiones Educativas 🚀

¡Bienvenido a **Space Lab — Sesiones Educativas**! Esta es una aplicación web estática diseñada para automatizar la creación de sesiones de aprendizaje de acuerdo con los lineamientos del **MINEDU** (Ministerio de Educación del Perú). 

El sistema permite configurar competencias, desempeños y capacidades por área/grado, rellenar información complementaria, generar la sesión estructurada mediante Inteligencia Artificial (con OpenRouter/DeepSeek), editarla directamente sobre el diseño en formato A4 y exportarla/imprimirla de forma óptima.

---

## 🌐 Despliegue en GitHub Pages

La aplicación está configurada para desplegarse automáticamente en GitHub Pages usando un subdominio personalizado:

* **URL Personalizada:** `https://sesiones.sypablitodp.site`


## 🎯 Objetivo

Automatizar y optimizar la creación, personalización y exportación de sesiones de aprendizaje alineadas al Currículo Nacional de Educación Básica (CNEB) del MINEDU, reduciendo tiempos administrativos para los docentes mediante asistencia de IA.

---

## 🛠️ Instrucciones de Uso

El flujo de trabajo principal es el siguiente:
1. **Llenar Formulario:** Selecciona el área, grado, competencias y llena la información de la sesión (nombre, propósito, duración, etc.).
2. **Clic en Generar:** Haz clic en el botón de generación para procesar con IA o usar una plantilla base.
3. **Editar en Hoja:** Toda la sesión generada en la hoja A4 interactiva es editable (`contenteditable`). Puedes modificar cualquier texto, tabla o sección directamente en pantalla.
4. **Guardar / Exportar:** Las sesiones se guardan automáticamente en tu navegador (`LocalStorage`). Puedes presionar `Ctrl + P` o hacer clic en "Imprimir / Guardar PDF" para exportarla a formato A4 físico o digital de forma impecable.

---

## 📁 Estructura del Proyecto

* **[index.html](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/index.html):** Interfaz de usuario principal. Contiene el formulario lateral y la hoja A4 de vista previa interactiva.
* **[CNAME](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/CNAME):** Configuración del subdominio personalizado para GitHub Pages.
* **[.nojekyll](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/.nojekyll):** Evita el procesamiento Jekyll en GitHub Pages para una carga más rápida.
* **`css/`**
  * **[style.css](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/css/style.css):** Hoja de estilos principal con diseño premium, efectos de glassmorphism y tema oscuro.
  * **[print.css](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/css/print.css):** Estilos especializados para impresión A4, aplicando saltos de página inteligentes (`break-inside: avoid;`).
* **`js/`**
  * **[app.js](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/js/app.js):** Controlador principal de la aplicación, maneja eventos, renderizado y flujos de usuario.
  * **[ai-copilot.js](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/js/ai-copilot.js):** Integración con la API de IA (OpenRouter/DeepSeek) y generación de prompts estructurados.
  * **[storage.js](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/js/storage.js):** Gestión de persistencia local en `LocalStorage` (guardado automático, carga y exportación JSON).
  * **[templates.js](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/js/templates.js):** Plantillas de sesión MINEDU (Estándar, Laboratorio y Refuerzo).
  * **`components/`**
    * **[toast.js](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/js/components/toast.js):** Sistema de notificaciones flotantes premium.
    * **[confirm-dialog.js](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/js/components/confirm-dialog.js):** Ventanas emergentes de confirmación personalizadas.
    * **[loader.js](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/js/components/loader.js):** Spinner de carga interactivo para la generación por IA.
* **`data/`**
  * **[competencias.json](file:///d:/zzzzzzzzzzzzzzzzzzzzzzzz/data/competencias.json):** Base de datos estructurada con las competencias, capacidades y desempeños del Currículo Nacional.

---

## 📌 Características Pro

* **Edición Directa en Pantalla:** Toda la hoja A4 utiliza el atributo `contenteditable` nativo, permitiendo modificar libremente el texto generado.
* **Persistencia Local:** Tus sesiones se guardan de forma automática cada vez que editas un campo. No perderás tu trabajo si recargas la página.
* **Modo Impresión Impecable:** Oculta controles de edición y ajusta márgenes, fuentes y elementos para que quepan exactamente en páginas A4 sin desbordamientos raros.
* **Selector de Plantillas:** Elige entre sesión Estándar, Laboratorio de Ciencias o Refuerzo Pedagógico para adaptar la estructura a la clase del día.
* **Limpiador de Formato Inteligente:** Si copias texto desde Word u otras páginas, la aplicación limpia automáticamente los estilos para mantener el diseño impecable y consistente.

---

## 🐛 Known Issues (Cosas Pendientes)

1. **Tablas Extensas:** Si una tabla de secuencia didáctica tiene demasiadas filas y texto largo, puede desbordar el espacio A4. Se recomienda usar la división manual de páginas si esto ocurre.
2. **Límites de LocalStorage:** El navegador limita el almacenamiento a ~5MB. Si guardas cientos de sesiones con imágenes incrustadas en base64, podrías alcanzar el límite. Usa la opción "Exportar a archivo" para respaldar.
