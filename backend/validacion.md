1. El Muro de Seguridad: CORS (Cross-Origin Resource Sharing)
Cuando tu interfaz en HTML (que puede estar corriendo en un Live Server o abriéndose como archivo file://) intente enviar datos a tu servidor de Python en localhost:8000, el navegador bloqueará la petición por seguridad.

Para evitar esto, en FastAPI siempre debes configurar el middleware de CORS al inicio. Como es un entorno local privado, puedes abrirlo completamente:

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite que cualquier frontend local se conecte
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

2. El Formato del Payload (De la IA a Python)
Tu frontend ya hizo el trabajo pesado: llamó a GPT-4o-mini, Gemini o DeepSeek, y generó la estructura de la sesión en tu pantalla. No necesitas volver a llamar a las APIs en Python.

Lo único que tu frontend debe hacer es capturar ese HTML resultante y enviarlo como un JSON.
from pydantic import BaseModel

class PedidoExportacion(BaseModel):
    html_content: str
    titulo: str

3. La Recepción en el Frontend (Manejo de Blobs)
Este es el error más común al conectar frontends con backends de exportación. Cuando FastAPI te devuelve un PDF o un Word, no te devuelve un texto, te devuelve un archivo binario. Si usas un fetch normal en JavaScript sin procesar el binario, el archivo se corrompe.

Debes decirle a JavaScript que trate la respuesta como un blob (Binary Large Object) y forzar la descarga creando un enlace oculto:

async function exportarSesionAPDF() {
    // 1. Capturas el HTML que ya está renderizado en tu pantalla
    const contenidoHTML = document.getElementById('contenedor-sesion').innerHTML;

    try {
        const respuesta = await fetch('http://localhost:8000/exportar-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                html_content: contenidoHTML, 
                titulo: "Sesion_Matematica_5to" 
            })
        });

        // 2. Crucial: Convertir la respuesta a archivo binario (Blob)
        const blob = await respuesta.blob();
        
        // 3. Crear una URL temporal en la memoria del navegador
        const urlDescarga = window.URL.createObjectURL(blob);
        
        // 4. Crear un botón invisible, hacerle clic y destruirlo
        const ancla = document.createElement('a');
        ancla.href = urlDescarga;
        ancla.download = "Sesion_Premium.pdf"; 
        document.body.appendChild(ancla);
        ancla.click();
        
        ancla.remove();
        window.URL.revokeObjectURL(urlDescarga); // Limpiar memoria
        
    } catch (error) {
        console.error("Fallo la conexión con el motor local:", error);
    }
}

4. Los Motores de Renderizado Ideales en Python
Para que los archivos salgan con calidad institucional (especialmente importante para los formatos estrictos de la EBR):

Para PDF (Playwright): Es la herramienta definitiva. Playwright levanta un navegador "fantasma" (Chromium) en el backend, inyecta tu HTML con todos tus estilos CSS, y le toma una "foto" en formato PDF tamaño A4 perfecto. Respeta colores de fondo, tablas y fuentes sin cortarlos a la mitad de la hoja.

Para DOCX (BeautifulSoup + python-docx): Exportar a Word es más delicado porque Word no lee HTML de forma nativa. La mejor estrategia es usar BeautifulSoup en FastAPI para leer las etiquetas (<h1>, <p>, <table>) del HTML que mandó tu frontend, y usar python-docx para ir construyendo el documento nativo de Microsoft Word, asignándole márgenes, bordes grises y tipografías oficiales (como Arial pt. 10 u 11).

Conectando el frontend a través del Fetch API manejando Blobs, y asegurando el paso libre con CORS en FastAPI, tu aplicación web se mantendrá ligera, mientras el código de Python en tu computadora hace todo el trabajo rudo de armar los archivos listos para imprimir.