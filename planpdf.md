Fase 1: Estructura HTML Semántica (La Clave del Éxito)
Para que el navegador sepa cómo cortar las páginas de tus sesiones de aprendizaje de forma inteligente, debes usar etiquetas HTML estrictas, especialmente para las tablas de competencias o secuencias didácticas (Inicio, Desarrollo, Cierre).

Al usar clases de Tailwind, mantienes tu código limpio, pero la estructura manda:

<div class="max-w-4xl mx-auto p-8 bg-white text-slate-800" id="sesion-documento">
  
  <header class="border-b-2 border-slate-300 pb-4 mb-6">
    <h1 class="text-2xl font-bold uppercase text-center">Sesión de Aprendizaje</h1>
    <div class="flex justify-between mt-4 text-sm">
      <p><strong>Grado:</strong> 4to de Secundaria</p>
      <p><strong>Área:</strong> Matemática</p>
    </div>
  </header>

  <table class="w-full text-left border-collapse mb-8">
    <thead class="bg-slate-100 table-header-group">
      <tr>
        <th class="border p-2">Competencia</th>
        <th class="border p-2">Capacidades</th>
        <th class="border p-2">Propósito</th>
      </tr>
    </thead>
    <tbody class="table-row-group">
      <tr>
        <td class="border p-2">Resuelve problemas de cantidad</td>
        <td class="border p-2">Traduce cantidades a expresiones...</td>
        <td class="border p-2">Aplicar modelos matemáticos...</td>
      </tr>
    </tbody>
  </table>

  <section class="secuencia-bloque mb-6">
    <h2 class="text-xl font-semibold mb-2 bg-slate-800 text-white p-2">I. Inicio (15 min)</h2>
    <p class="p-2 border border-slate-300">Recuperación de saberes previos...</p>
  </section>

</div>

Fase 2: El CSS Mágico (@media print)
Aquí es donde ocurre la magia. Este CSS se encargará de adaptar tu diseño (incluso si está en modo oscuro en la pantalla) a un formato de papel blanco impecable. Debes agregar esto en tu archivo CSS global:


@media print {
  /* 1. Resetear fondos oscuros para ahorrar tinta y asegurar legibilidad */
  body {
    background-color: white !important;
    color: black !important;
    /* Fuerza al navegador a imprimir los colores de fondo de tus celdas/titulos */
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* 2. Ocultar la interfaz web (botones, menús, scrollbars) */
  .no-imprimir, nav, footer, button, .sidebar {
    display: none !important;
  }

  /* 3. Configurar la página física */
  @page {
    size: A4;
    margin: 15mm; /* Márgenes profesionales */
  }

  /* 4. Controlar los saltos de página para que no se corten los bloques a la mitad */
  .secuencia-bloque {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* 5. Asegurar que las tablas repitan la cabecera en cada página nueva */
  thead {
    display: table-header-group;
  }
  
  /* 6. Evitar que una fila de la tabla se parta en dos páginas */
  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}


Fase 3: El Controlador de Acción (JavaScript)
Solo necesitas un botón en tu interfaz de usuario con la clase .no-imprimir (para que desaparezca cuando se genere el PDF) que llame a la función nativa del navegador.

<button onclick="exportarSesion()" class="no-imprimir bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition">
  Exportar a PDF
</button>

<script>
  function exportarSesion() {
    // Si necesitas hacer algún cambio en el DOM justo antes de imprimir, hazlo aquí
    
    // Llamar a la ventana de impresión nativa
    window.print();
    
    // Si cambiaste algo en el DOM, lo restauras aquí abajo
  }
</script>


Fase 4: Experiencia de Usuario (El detalle final)
El único "defecto" de este método es que el usuario debe asegurarse de que en la ventana de impresión (la que sale al darle a Exportar) esté marcada la opción de "Gráficos de fondo" o "Imprimir fondos".