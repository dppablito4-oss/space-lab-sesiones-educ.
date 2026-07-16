1. La Teoría: ¿Por qué esto soluciona tu vida?
Aislamiento de CSS (El problema del Tema Oscuro): Tu SaaS Space Lab tiene un diseño espacial hermoso con fondo oscuro. Pero las sesiones de la UNHEVAL tienen que imprimirse en hojas A4 blancas. Si renderizas la tabla directamente en tu frontend con JS, el CSS de tu app se puede cruzar con el CSS de impresión. Al usar un <iframe>, creas un "universo paralelo" dentro de la web donde solo corre el HTML/CSS limpio de la hoja A4 que te manda Python.

Zero-Lag de Sincronización: Si agregas un campo nuevo al formato oficial (como el anexo de "Juego libre en los sectores"), solo modificas la plantilla en tu backend de Python. El frontend no necesita actualizarse porque simplemente recibe el HTML ya masticado y lo dibuja.

Reutilización de Lógica: Usas el mismo diccionario/JSON limpio en Python para meterlo a Jinja2 (para la vista previa e impresión de PDF) y a docxtpl (para la descarga en Word).

2. Implementación en el Backend (Python)
Este sería el código en tu servidor local de Python (usando FastAPI o Flask). Su único trabajo es recibir el JSON de la web, limpiarlo para evitar que falten datos, inyectarlo en un template HTML usando Jinja2, y devolver el HTML como texto.

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jinja2 import Template
import json

app = FastAPI()

# Permitimos que tu web se comunique con el puerto local sin problemas de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # O tu dominio https://sesiones.sypablitodp.site
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. EL TRADUCTOR / ADAPTADOR SEGURO
def normalizar_datos(raw_data: dict) -> dict:
    """
    Toma el JSON que mande la IA o el frontend y asegura que las llaves 
    coincidan EXACTAMENTE con lo que espera la plantilla, sin eñes ni tildes.
    """
    return {
        "institucion_educativa": raw_data.get("institucion_educativa") or raw_data.get("I.E.") or "No especificado",
        "docente": raw_data.get("docente") or raw_data.get("practicante") or "Saly beatriz",
        "edad_ninos": raw_data.get("edad_ninos") or raw_data.get("grado_seccion") or "5 años",
        "fecha": raw_data.get("fecha") or "2026-07-16",
        "nombre_actividad": raw_data.get("nombre_actividad") or raw_data.get("titulo") or "Actividad sin título",
        "tiempo_aprox": raw_data.get("tiempo_aprox") or "45 min",
        "proposito_aprendizaje": raw_data.get("proposito_aprendizaje") or "Que los niños exploren...",
        "competencia": raw_data.get("competencia") or "Se desenvuelve de manera autónoma...",
        "estandar": raw_data.get("estandar") or "No especificado",
        # Fallback inteligente para el desempeño que tanto fallaba:
        "desempeno_grado": raw_data.get("desempeno_grado") or raw_data.get("desempeño") or "Desempeño no especificado",
        "evidencia": raw_data.get("evidencia") or raw_data.get("producto") or "No especificado",
        "instrumento": raw_data.get("instrumento") or "Lista de Cotejo"
    }

# 2. TU PLANTILLA HTML ÚNICA (La que hereda el formato UNHEVAL)
HTML_TEMPLATE_UNHEVAL = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Arial', sans-serif; color: #333; margin: 0; padding: 20px; background-color: #fff; }
        .hoja-a4 { width: 210mm; min-height: 297mm; margin: auto; }
        .cabecera { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .titulo-tabla { background-color: #f2f2f2; font-weight: bold; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
        .competencia-box { font-weight: bold; color: #d9534f; }
    </style>
</head>
<body>
    <div class="hoja-a4">
        <div class="cabecera">
            <h3>UNIVERSIDAD NACIONAL HERMILIO VALDIZAN</h3>
            <h4>ANEXO 01: PLANIFICACIÓN DE LA ACTIVIDAD DE APRENDIZAJE</h4>
        </div>
        
        <table>
            <tr>
                <td width="50%"><strong>INSTITUCIÓN EDUCATIVA:</strong> {{ institucion_educativa }}</td>
                <td width="50%"><strong>EDAD DE LOS NIÑOS:</strong> {{ edad_ninos }}</td>
            </tr>
            <tr>
                <td><strong>PRACTICANTE / DOCENTE:</strong> {{ docente }}</td>
                <td><strong>FECHA:</strong> {{ fecha }}</td>
            </tr>
            <tr>
                <td><strong>NOMBRE DE ACTIVIDAD:</strong> "{{ nombre_actividad }}"</td>
                <td><strong>TIEMPO APROX:</strong> {{ tiempo_aprox }} min</td>
            </tr>
        </table>

        <table>
            <tr class="titulo-tabla">
                <td width="20%">ÁREA / COMPETENCIA</td>
                <td width="30%">ESTÁNDAR DE APRENDIZAJE</td>
                <td width="20%">DESEMPEÑO DEL GRADO</td>
                <td width="15%">CRITERIO</td>
                <td width="15%">EVIDENCIA</td>
            </tr>
            <tr>
                <td class="competencia-box">{{ competencia }}</td>
                <td>{{ estandar }}</td>
                <td>{{ desempeno_grado }}</td>
                <td>{{ criterio_evaluacion }}</td>
                <td>{{ evidencia }}</td>
            </tr>
        </table>
    </div>
</body>
</html>
"""

@app.post("/api/render-preview")
async def render_preview(payload: dict):
    try:
        # Normalizamos el JSON ruidoso que viene del front
        datos_limpios = normalizar_datos(payload)
        
        # Compilamos con Jinja2
        template = Template(HTML_TEMPLATE_UNHEVAL)
        html_final = template.render(datos_limpios)
        
        # Devolvemos el HTML crudo listo para pintar
        return {"success": True, "html": html_final}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


        3. Implementación en el Frontend (HTML / JS)
En tu frontend de la web, quitas todos los divs y tablas complejas de la vista previa de la hoja de Word. En su lugar, metes un simple <iframe> y mandas el JSON a Python cada vez que cambie algo en el formulario o cuando el usuario pulse "Vista Previa".

<div class="preview-container" style="width: 100%; height: 100vh; background: #111; padding: 10px;">
    <iframe id="space-preview-frame" style="width: 100%; height: 100%; border: none; background: #fff; border-radius: 8px;"></iframe>
</div>

// Función para actualizar la vista previa mandando los datos a Python
async function actualizarVistaPrevia() {
    // 1. Recolectas los datos de tus inputs en el Front
    const datosSesion = {
        "I.E.": document.getElementById("input-ie").value, // Manda lo que sea, Python lo traduce
        "docente": document.getElementById("input-docente").value,
        "grado_seccion": "5 años",
        "titulo": "Nos movemos al ritmo de michilala",
        "desempeño": document.getElementById("textarea-desempeno").value, // El que editó el usuario
        "competencia": "Se desenvuelve de manera autónoma a través de su motricidad",
        "estandar": "Reconoce las posibilidades de movimiento de su cuerpo..."
    };

    try {
        // 2. Le pegas a tu backend local de Python (el .exe que corre de fondo)
        const response = await fetch("http://localhost:8000/api/render-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosSesion)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 3. Inyectas el HTML renderizado directamente dentro del Iframe
            const iframe = document.getElementById("space-preview-frame");
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            iframeDoc.open();
            iframeDoc.write(data.html); // Python ya hizo toda la magia de mapear y pintar las variables
            iframeDoc.close();
        }
    } catch (error) {
        console.error("Error conectando con el motor local en Python:", error);
    }
}

4. ¿Y cómo se conecta esto con la exportación a Word?
Como ya tienes la función normalizar_datos(raw_data) corriendo en tu backend, cuando el usuario le dé clic a "Exportar Word", tu backend llamará exactamente a la misma función antes de escribir en el template de docxtpl:
from docxtpl import DocxTemplate

@app.post("/api/export-word")
async def export_word(payload: dict):
    # Usas exactamente la misma lógica de normalización
    datos_limpios = normalizar_datos(payload)
    
    # Abrimos la plantilla .docx real de Word
    doc = DocxTemplate("plantilla_unheval_inicial.docx")
    
    # Al estar normalizados los datos, docxtpl mapea {{ desempeno_grado }} al toque sin fallar
    doc.render(datos_limpios)
    
    # Guardamos y enviamos el archivo de vuelta
    doc.save("sesion_generada.docx")
    return {"success": True, "path": "sesion_generada.docx"}

    a. Qué ganamos con esta arquitectura (Resumen de beneficios)
    Control Total: Ya no dependes de que JS raye la tabla. Si Python dice que el desempeño mide "construcción", el HTML dice "construcción". No hay discusión con la IA.

    Compatibilidad Absoluta (Tu dolor de cabeza resuelto): Python no entiende de frameworks de JS ni de errores de caché de navegador. Habla HTML puro. Al generar la sesión en Python, te aseguras de que cumpla al 100% con los estándares de Word que revisa tu decano.

    Un solo Cerebro: La función normalizar_datos es la llave maestra. La usas para limpiar datos de la IA, para preparar la impresión en la web y para generar el Word. No repites código.
    