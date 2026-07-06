# 📄 PLAN DE ARQUITECTURA: PAGINACIÓN A4 Y ESTRUCTURACIÓN ANTI-CORTES

## 🎯 Objetivo Principal
Garantizar que lo que el usuario ve en el editor web (WYSIWYG) sea 100% idéntico al PDF final, eliminando recuadros cortados, saltos de página imprevistos y desbordamientos de texto.

---

## 🛠️ FASE 1: Domando a la IA (Ingeniería de Prompts)
El problema principal es que la IA devuelve la información en bloques masivos. Si manda 3000 caracteres en una sola cadena, el HTML lo mete en un solo `<td>` y Chromium colapsa al intentar cortarlo[cite: 4].

### Regla de Oro para el Prompt: Fragmentación Obligatoria
Debes exigirle a la IA que devuelva la estructura en formato JSON, dividiendo los textos largos en fragmentos o "párrafos" cortos.

**Ejemplo de Prompt System para la IA:**
> "Eres un experto en pedagogía. Genera la sesión de aprendizaje y devuelve la respuesta ESTRICTAMENTE en formato JSON. Para secciones largas como 'Desarrollo' o 'Ficha de Trabajo', NO devuelvas un solo bloque de texto. Devuelve un array de objetos donde cada elemento sea un párrafo o actividad corta (máximo 400 caracteres por bloque). Esto es vital para la paginación física."

**Lo que esperas recibir (JSON):**
```json
{
  "desarrollo": [
    {"tipo": "actividad", "texto": "El docente presenta el tema..."},
    {"tipo": "pregunta", "texto": "¿Qué entendemos por anécdota?"},
    {"tipo": "dinamica", "texto": "Los alumnos forman grupos..."}
  ]
}

Por qué esto es magia: Al renderizar este JSON en tu web, en lugar de crear un solo <tr> gigante de 35 cm, crearás tres <tr> pequeños. Chromium podrá meter el corte entre un <tr> y otro, salvando el diseño.
🖥️ FASE 2: El Clon de Google Docs (Frontend)
Para que el editor web luzca como páginas A4 reales y maneje los bordes correctamente.

Opción A: La Ruta "Paged.js" (Recomendada y más rápida)
Paged.js es una librería open-source que hace exactamente lo que quieres: intercepta tu HTML y lo divide visualmente en hojas A4 en el navegador antes de imprimir.

Instalación en la web: Añades el script de Paged.js a tu editor.

Estructura base: Tu web tendrá un contenedor principal <div id="documento">.

Comportamiento: Cuando inyectas el HTML de la sesión en ese div, Paged.js calcula matemáticamente la altura. Si detecta que el "Desarrollo" sobrepasa los 29.7cm (o los ~1123 píxeles), clona la tabla, cierra los bordes de la celda en la página 1, y abre la continuación en la página 2.

Exportación: Le envías ese HTML (ya procesado y paginado por Paged.js) a tu motor Python.
Opción B: Script Interno Custom (JavaScript Puro)
Si no quieres usar librerías de terceros y quieres control absoluto.

Lógica del Algoritmo (Splitter):

Define tu clase de página en CSS:

.hoja-a4 {
    width: 210mm;
    height: 297mm;
    padding: 20mm 15mm;
    overflow: hidden; /* Oculta lo que sobra para forzar el cálculo */
}
Crea un observador en JS (MutationObserver) o una función calcularPaginacion().

El script mide cada nodo hijo (<p>, <tr>, <h1>) usando element.offsetHeight.

Si la suma de las alturas dentro de la hoja-a4 actual supera los 257mm (297mm - márgenes):

El script remueve ese último nodo que causó el desborde.

Crea un nuevo <div> con la clase .hoja-a4 (la página 2).

Si el elemento era una fila de tabla (<tr>), el script debe clonar la cabecera de la tabla (<thead>) en la nueva página y pegar el <tr> debajo para que el cuadro tenga sentido.

🐍 FASE 3: El Puente Limpio (Backend Python)
Una vez que solucionas la geometría en el frontend, tu servidor local en Python se vuelve a prueba de balas.

Como el HTML que le manda la web ya tiene la medida y estructura de hojas A4 separadas por <div class="hoja-a4">, Playwright en Python solo tiene que tomar la foto.

El código en tu main.py se simplifica drásticamente a esto:
# Ya no dependes de trucos sucios de CSS, porque el frontend ya hizo el trabajo pesado.
documento_completo = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ margin: 0; background: #ccc; }}
        /* Le decimos a Chromium que cada div de hoja es un salto de página forzado */
        .hoja-a4 {{
            width: 210mm;
            height: 297mm;
            background: white;
            page-break-after: always;
            box-sizing: border-box;
            /* Aquí pones los bordes y padding que ya calculaste en el JS */
        }}
    </style>
</head>
<body>
    {payload.html_content_ya_paginado_por_el_frontend}
</body>
</html>
"""

pdf_bytes = await page.pdf(
    print_background=True,
    prefer_css_page_size=True, # Magia: Obliga a Chromium a respetar la medida exacta del div .hoja-a4
    margin={"top": "0", "bottom": "0", "left": "0", "right": "0"} # Los márgenes ya están en el div
)

🏁 Resumen de la Estrategia a Seguir
Modifica la petición a la IA para que devuelva párrafos fragmentados (cero bloques masivos).

Integra Paged.js (o arma tu propio JS) en tu interfaz web para simular las hojas de papel.

Envía el HTML resultante a tu pablitopyhost.exe, usando prefer_css_page_size=True para que simplemente "calque" lo que JS ya acomodó.