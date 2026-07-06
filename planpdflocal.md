# 🛠️ Documentación de la Arquitectura Local (Localhost)
**Proyecto:** Sistema de Automatización y Generación de Sesiones Pedagógicas Premium
**Desarrollador:** Samuel Pablo
**Versión:** 1.0.0-beta (Fábrica Privada)

---

## 1. Descripción General del Sistema
Este sistema implementa una arquitectura híbrida para entorno local. Mantiene una interfaz gráfica hermosa y minimalista construida en **HTML/CSS/Tailwind** corriendo en el navegador web, la cual se comunica de manera asíncrona mediante un pipeline de datos (JSON) con un motor de ejecución pesado programado en **Python (FastAPI)**.

Este enfoque elimina por completo las limitaciones de maquetación de los navegadores web (`window.print()`), delegando la creación y estructuración de los documentos PDF de manera nativa a los hilos de ejecución de Python en la máquina local.

---

## 2. Diagrama de Flujo de Datos

[ Tu Frontend Web (HTML/JS) ]
│
(Fetch API / JSON)
▼
[ Servidor Local (FastAPI a puerto 8000) ] ──(Llamada API IA)──► [ Servidor IA ]
│                                                            │
(Procesa a PDF)                                              (Devuelve Texto)
▼                                                            │
[ Guarda en Disco Duro ] ◄─────────────────────────────────────────────┘
│
(Retorna archivo)
▼
[ Descarga Automática en Navegador ]

## 3. Weapon Stack (Librerías Recomendadas)

Para levantar el entorno local sin sobrecargar los recursos de hardware, se deben instalar las siguientes dependencias en el entorno virtual de Python:

| Librería | Propósito | Justificación Técnica |
| :--- | :--- | :--- |
| **`fastapi`** | Framework de Backend | Basado en estándares abiertos (OpenAPI), ejecución asíncrona nativa y autogeneración de documentación interactiva. |
| **`uvicorn`** | Servidor ASGI | Servidor de producción ultrarrápido para desplegar la app en el entorno local (`localhost:8000`). |
| **`httpx`** | Cliente HTTP | Reemplazo moderno de `requests` con soporte asíncrono para llamadas concurrentes a la API Key de la IA. |
| **`pydantic`** | Validación de Datos | Asegura que los tipos de datos que entran desde el formulario web cumplan estrictamente con el esquema esperado antes de procesar el prompt. |
| **`fpdf2`** | Generación de PDF | Librería nativa y ligera que escribe el binario del PDF celda por celda sin romper márgenes ni depender de renderizadores web. |

---

## 4. Estructura de Directorios del Proyecto

Se establece una división limpia entre lógica de cliente y lógica de servidor para facilitar una futura migración hacia una VPS o arquitectura SaaS:

```text
proyecto-sesiones/
│
├── backend/
│   ├── main.py              # Kernel del servidor FastAPI y enrutamiento
│   ├── pipeline_lotes.py    # Script de automatización por lotes (Batch)
│   ├── requirements.txt     # Manifiesto de dependencias de Python
│   └── output_sesiones/     # Almacenamiento local automatizado de los PDFs
│
└── frontend/
    ├── index.html           # Interfaz de Usuario (UI Dark Mode)
    └── app.js               # Controlador de peticiones asíncronas (JS)

5. Implementación del Backend (backend/main.py)
Este script levanta el servidor local y expone el endpoint /generar-sesion. Incluye un middleware de CORS con comodín para desarrollo local, previniendo bloqueos de seguridad del navegador.

Python

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path

# Inicialización del Motor Local
app = FastAPI(
    title="Engine de Sesiones Premium",
    description="Backend local de alto rendimiento para el procesamiento de tokens pedagógicos y generación de PDFs."
)

# 🚨 CONFIGURACIÓN DE SEGURIDAD CORS (Crucial para desarrollo local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite peticiones desde archivos locales o cualquier puerto
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Esquema Estricto del Pedido del Docente (Pydantic)
class PedidoSesion(BaseModel):
    profesor_name: str
    grado: str
    curso: str
    tema: str

# Inicialización Automática del Sistema de Archivos
OUTPUT_DIR = Path("output_sesiones")
OUTPUT_DIR.mkdir(exist_ok=True)

@app.get("/")
def check_status():
    """Endpoint de control para verificar la salud del servidor."""
    return {"status": "Online", "developer": "Samuel Pablo", "engine": "FastAPI + Python"}

@app.post("/generar-sesion")
async def procesar_y_exportar_sesion(pedido: PedidoSesion):
    try:
        # ======================================================================
        # PASO 1: Aquí se integra el Prompt de 2K tokens con las variables del pedido
        # y se dispara la llamada HTTP hacia la API Key de la IA.
        # ======================================================================
        texto_generado_ia = (
            f"--- SESIÓN PREMUM ---\n"
            f"Docente: {pedido.profesor_name}\n"
            f"Curso: {pedido.curso} | Grado: {pedido.grado}\n"
            f"Tema Central: {pedido.tema}\n"
            f"Estructura: Competencias, Capacidades, Inicio, Desarrollo, Cierre y Ficha Técnica."
        )
        
        # ======================================================================
        # PASO 2: Tu motor de PDF (10 de 10) procesa la cadena de texto de la IA.
        # Guardamos el archivo binario directamente en el almacenamiento local.
        # ======================================================================
        slug_tema = pedido.tema.lower().replace(" ", "_")
        slug_profesor = pedido.profesor_name.lower().replace(" ", "_")
        nombre_archivo = f"Sesion_{slug_tema}_{slug_profesor}.pdf"
        ruta_archivo_final = OUTPUT_DIR / nombre_archivo
        
        # [Simulación de guardado] Aquí se inyecta la librería PDF nativa (fpdf2)
        with open(ruta_archivo_final, "w", encoding="utf-8") as archivo:
            archivo.write(texto_generado_ia)
            
        # ======================================================================
        # PASO 3: Transmisión del archivo binario de regreso al Frontend
        # para detonar la descarga automática sin intermediarios.
        # ======================================================================
        return FileResponse(
            path=ruta_archivo_final, 
            filename=nombre_archivo, 
            media_type='application/pdf'
        )
        
    except Exception as error_interno:
        raise HTTPException(status_code=500, detail=f"Fallo en el pipeline local: {str(error_interno)}")

6. Conexión del Cliente (frontend/app.js)
Función asíncrona encargada de capturar las variables del formulario HTML, serializarlas a JSON y procesar la respuesta binaria (blob) devuelta por Python para forzar la descarga en el escritorio del usuario.

/**
 * Captura las variables del formulario de la interfaz web
 * y detona la generación y descarga automática del PDF desde el backend local.
 */
async function invocarGeneradorLocal() {
    // Reemplazar estos valores estáticos por los inputs reales de tu DOM (document.getElementById)
    const payload = {
        profesor_name: "Hermano Edward",
        grado: "5to de Secundaria",
        curso: "Física Pura",
        tema: "Movimiento Rectilíneo Uniformemente Variado (MRUV)"
    };

    try {
        console.log("[POST] Transmitiendo parámetros al servidor local...");
        
        const respuesta = await fetch('http://localhost:8000/generar-sesion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            throw new Error(`Código de estado HTTP inválido: ${respuesta.status}`);
        }

        // Parsear la respuesta HTTP a un objeto binario (Blob) de tipo PDF
        const binarioPdf = await respuesta.blob();
        
        // Crear un puntero de descarga temporal en la memoria del navegador
        const urlDescarga = window.URL.createObjectURL(binarioPdf);
        const enlaceAncla = document.createElement('a');
        
        enlaceAncla.href = urlDescarga;
        enlaceAncla.download = `Sesion_${payload.tema.replace(/ /g, "_")}.pdf`;
        
        // Inyección efímera en el DOM para forzar el evento Click del sistema operativo
        document.body.appendChild(enlaceAncla);
        enlaceAncla.click();
        
        // Limpieza de memoria y remoción del elemento
        enlaceAncla.remove();
        window.URL.revokeObjectURL(urlDescarga);
        
        console.log("[OK] Transmisión finalizada. PDF descargado con éxito.");
        
    } catch (error_pipeline) {
        console.error("[CRITICAL] Fallo en la comunicación con el motor local:", error_pipeline);
    }
}

7. Protocolo de Despliegue en Consola
Para poner en marcha el ecosistema en tu PC local, ejecuta los siguientes comandos en tu terminal de comandos:

Instalación de la Suite de Librerías:
pip install fastapi uvicorn httpx pydantic fpdf2

Lanzamiento del Servidor en Modo Watcher (Auto-reload al guardar cambios):
uvicorn main.py:app --reload --port 8000

Prueba de Conectividad Extrema:
Abre una pestaña en tu navegador web y navega a http://localhost:8000/. El sistema debe retornar de inmediato el JSON de confirmación de salud en standby.