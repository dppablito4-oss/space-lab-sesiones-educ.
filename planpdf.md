# `implementacion.md` — Optimización Estética de Exportación PDF (`window.print`)

Este módulo contiene el parche de CSS avanzado para inyectar en el stylesheet de impresión (`@media print`). Resuelve el problema de los recuadros abiertos en los saltos de página, limpia los artefactos del navegador y asegura un acabado de documento oficial de escritorio.

---

## 🛠️ 1. Código CSS de Impresión Premium

Agrega este bloque al final de tu archivo CSS global o dentro de tus etiquetas `<style>` en la vista de la sesión de aprendizaje.

```css
@media print {
  /* ==========================================
     1. CONFIGURACIÓN DE PÁGINA Y LIENZO A4
     ========================================== */
  @page {
    size: A4;
    margin: 2cm 1.5cm 2cm 1.5cm; /* Márgenes estándar para documentos oficiales */
  }

  body {
    background: white !important;
    color: #1e293b !important; /* Gris oscuro profesional, cansa menos la vista que el negro puro */
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
  }

  /* Ocultar elementos de la interfaz web que consumen tinta/espacio */
  .no-print, 
  button, 
  nav, 
  footer, 
  .sidebar, 
  .theme-toggle {
    display: none !important;
  }

  /* ==========================================
     2. FIX MAESTRO: CLAUSURA DE RECUADROS (Saltos de Página)
     ========================================== */
  .recuadro-sesion, 
  .bloque-didactico, 
  .card-anexo {
    page-break-inside: auto; /* Permite que el bloque se divida si es muy largo */
    
    /* LA MAGIA: Clona los bordes, paddings y fondos en cada fragmento de página */
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    
    border: 1.5px solid #0f172a !important; /* Cierra el recuadro abajo en pág 1 y lo abre arriba en pág 2 */
    padding: 15px;
    margin-bottom: 20px;
    border-radius: 4px;
    background-color: transparent !important;
  }

  /* ==========================================
     3. OPTIMIZACIÓN DE TABLAS (Formato UNHEVAL)
     ========================================== */
  table {
    /* IMPORTANTE: 'separate' permite al navegador redibujar bordes en los saltos */
    border-collapse: separate !important;
    border-spacing: 0;
    width: 100%;
    page-break-inside: auto;
  }

  /* Evita que una fila (ej. datos de un alumno o un criterio) se mutile a la mitad */
  tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  th, td {
    border-bottom: 1px solid #0f172a;
    border-right: 1px solid #0f172a;
    padding: 8px;
    font-size: 10pt;
  }

  /* Reconstrucción de bordes externos de la tabla dañados por el 'separate' */
  table {
    border-top: 1px solid #0f172a;
    border-left: 1px solid #0f172a;
  }

  /* ==========================================
     4. CONTROL DE FLUJO Y TEXTO HUÉRFANO
     ========================================== */
  /* Evita que un título se quede solo al final de la página (fuerza el salto con su contenido) */
  h1, h2, h3, h4, .titulo-momento {
    page-break-after: avoid !important;
    break-after: avoid !important;
    color: #0f172a !important;
    margin-top: 15px;
  }

  /* Forzar salto de página obligatorio para secciones mayores (Sectores, Fichas, Lista de Cotejo) */
  .break-page-before {
    page-break-before: always !important;
    break-before: always !important;
  }

  /* Evita que párrafos queden con una sola línea suelta */
  p {
    orphans: 3;
    widows: 3;
  }
}

📂 2. Estructuración en el HTML (Template)
Para que el CSS aplique el parche de clonación de bordes de forma correcta, asegúrate de envolver los bloques de tu sesión usando las clases mapeadas:

<!-- Bloque Principal de la Sesión -->
<div class="recuadro-sesion">
    <h2 class="titulo-momento">INICIO (10 min)</h2>
    <p><strong>Motivación / Asamblea:</strong> La docente presenta al títere...</p>
</div>

<!-- Estructura de Tabla para Procesos o Lista de Cotejo -->
<table class="tabla-unheval">
    <thead>
        <tr>
            <th>N°</th>
            <th>Apellidos y Nombres</th>
            <th>Criterio de Evaluación</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>ACOSTA MURGA, CLIFEER AMELEX</td>
            <td></td>
        </tr>
    </tbody>
</table>

<!-- Forzar que el anexo de Sectores o Fichas empiece en una página limpia -->
<div class="recuadro-sesion break-page-before">
    <h2 class="titulo-momento">ANEXO: PLANIFICACIÓN DE JUEGO LIBRE EN LOS SECTORES</h2>
    <!-- Contenido del sector -->
</div>

Logs de Verificación (Checklist Técnico)
Antes de pasarle el link al usuario final, haz un Ctrl + P en tu navegador y verifica:

[ ] Bordes Sellados: Las cajas que se parten entre la página 1 y 2 muestran una línea horizontal de cierre en el borde inferior de la pág 1.

[ ] Filas Intactas: Ninguna fila de la lista de cotejo se corta horizontalmente a la mitad del texto del alumno.

[ ] Limpieza de Headers: No se visualizan URLs de localhost/servidor ni la fecha por defecto del navegador en las esquinas (controlado por los márgenes del @page).