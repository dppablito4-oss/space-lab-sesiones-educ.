Motor de Exportación Híbrido (SYPABLITODP)
Versión: 1.1.0-Beta (Privada)
Arquitectura: FastAPI (Python) + Playwright Headless + python-docx
Entorno de Ejecución: PyInstaller Standalone .exe (Compatible con Windows LTSC)

1. Visión General del Sistema
Este backend actúa como el motor de renderizado local para la generación de sesiones pedagógicas y fichas de ejercicios. Soluciona las limitaciones de maquetación de los navegadores web tradicionales al exportar documentos nativos (PDF y DOCX) directamente desde el sistema operativo del usuario.

Esta versión implementa un Pipeline de Detección Híbrida Anti-Freeze. Está diseñada específicamente para evitar cuelgues al ser empaquetada con PyInstaller, garantizando su funcionamiento incluso en versiones recortadas de Windows (como Windows 10/11 LTSC) que carecen de navegadores preinstalados como Microsoft Edge.

2. Arquitectura de Detección Híbrida (Motor PDF)
Para la exportación a PDF, Playwright requiere un binario de Chromium. Para evitar el uso de comandos de consola (sys.executable) que rompen el ejecutable compilado, el sistema sigue este árbol de decisión de tres pasos:

Búsqueda Local Portable (./bin/chrome-win): Verifica si existe un motor Chromium portable junto al .exe.

Escaneo del Sistema Operativo: Si no hay portable, busca instalaciones nativas en las rutas por defecto de:

Google Chrome (Archivos de Programa / LocalAppData)

Brave Browser

Descarga Nativa de Emergencia: Si el entorno está completamente limpio (ej. LTSC puro), el script utiliza urllib.request de Python para descargar silenciosamente un snapshot oficial de Chromium (ZIP) directamente desde Google APIs, extrayéndolo localmente mediante zipfile y mostrando una barra de progreso nativa en consola mediante la librería rich.

3. Endpoints del API (FastAPI)
El servidor se levanta de forma local en http://127.0.0.1:8000 y expone las siguientes rutas:

GET / (Health Check)
Descripción: Verifica si el servidor está en línea y escuchando.

Respuesta: JSON con el estado del servidor y si el cliente (frontend) ya estableció la conexión.

GET /verificar-token
Descripción: Autentica la conexión entre el navegador web y el motor local.

Parámetros: token (Generado aleatoriamente al iniciar el .exe).

Respuesta: Confirmación de enlace seguro.

POST /exportar-pdf
Descripción: Recibe el HTML con estilos, inyecta un bloque CSS de impresión @page { size: A4 } y utiliza Playwright (conectado al binario detectado) para renderizar un PDF perfecto, omitiendo diálogos de sistema.

Payload Esperado: html_content (HTML de la sesión), titulo (String), token (String).

Respuesta: Archivo binario application/pdf con cabeceras de descarga automática.

POST /exportar-docx
Descripción: Convierte el código HTML en un archivo de Word nativo y editable. Utiliza BeautifulSoup para desarmar el árbol HTML y python-docx para mapear etiquetas a estilos de Word (títulos jerárquicos, listas, márgenes de celda y colores de fondo).

Payload Esperado: html_content (HTML estructurado), titulo (String), token (String).

Respuesta: Archivo binario .docx con cabeceras de descarga automática.

4. Flujo de Inicialización del Ejecutable (__main__)
Cuando el profesor hace doble clic en el pablitopyhost.exe, el sistema ejecuta la siguiente secuencia en orden:

Anti-QuickEdit: Desactiva el modo de edición rápida de la consola CMD de Windows. Esto previene que el servidor se congele si el usuario hace clic accidentalmente dentro de la ventana negra.

Banner UI: Imprime el arte ANSI oficial de S.Y.PABLITO_DP en colores magenta, azul y cian.

Escaneo de Navegadores: Ejecuta buscar_navegador_compatible(). Si retorna nulo, ejecuta descargar_chromium_nativo().

Enlace Uvicorn: Levanta el servidor ASGI de FastAPI en el puerto 8000.

Evento de Arranque: Imprime en consola la URL segura (https://sesiones.sypablitodp.site/conexion.html?token=...) que el usuario debe abrir para enlazar el software web con el motor de su PC.

5. Instrucciones de Compilación (PyInstaller)
El sistema está diseñado para ser empaquetado usando el archivo pablitopyhost.spec. Al utilizar descargas por urllib en lugar del CLI de Playwright, ya no se requieren exclusiones complejas ni hooks adicionales.

Para generar el ejecutable de producción:
pyinstaller pablitopyhost.spec --clean


troso de codio que podemos integrar 
import os
import urllib.request
import zipfile
from pathlib import Path

# ==============================================================================
# 🛠️ MÓDULO ANTI-FREEZE: RUTAS Y VARIABLES GLOBALES
# ==============================================================================
LOCAL_BIN_DIR = Path("bin")
CHROMIUM_DIR = LOCAL_BIN_DIR / "chrome-win"
CHROMIUM_EXE = CHROMIUM_DIR / "chrome.exe"

# ==============================================================================
# 🔍 FUNCIÓN 1: ESCÁNER DE NAVEGADORES (LTSC & PORTABLES)
# ==============================================================================
def buscar_navegador_compatible():
    """Busca un ejecutable de Chromium en la carpeta local o en el sistema."""
    
    # 1. Prioridad Máxima: Verificar si ya existe en nuestra carpeta portable './bin'
    if CHROMIUM_EXE.exists():
        return str(CHROMIUM_EXE)

    # 2. Prioridad Secundaria: Buscar navegadores instalados en Windows
    rutas_sistema = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" # Por si acaso
    ]

    for ruta in rutas_sistema:
        if Path(ruta).exists():
            return ruta

    # Si retorna None, significa que estamos en un entorno puro/limpio (como LTSC)
    return None

# ==============================================================================
# ⬇️ FUNCIÓN 2: DESCARGADOR NATIVO (SIN DEPENDER DE PYINSTALLER)
# ==============================================================================
def descargar_chromium_nativo():
    """Descarga Chromium usando urllib para no congelar el .exe"""
    LOCAL_BIN_DIR.mkdir(exist_ok=True)
    zip_path = LOCAL_BIN_DIR / "chromium.zip"
    
    # URL directa de Google APIs (Versión ligera y estable para Windows x64)
    url_chromium = "https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/1182249/chrome-win.zip"

    # Aquí puedes meter tu lógica de consola (Rich) para la barra de progreso
    if console:
        console.print("[yellow]Iniciando descarga de motor Chromium...[/yellow]")
        
        # Callback para conectar urllib con la barra de progreso de Rich
        def progreso_download(count, block_size, total_size):
            # Tu lógica de progreso visual va aquí
            pass 
            
        urllib.request.urlretrieve(url_chromium, zip_path, reporthook=progreso_download)
    else:
        # Fallback si no hay Rich
        urllib.request.urlretrieve(url_chromium, zip_path)

    # Extracción del ZIP de forma nativa
    if console:
        console.print("[yellow]Extrayendo motor...[/yellow]")
        
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(LOCAL_BIN_DIR)
        
    # Eliminar el ZIP basura para ahorrar espacio
    if zip_path.exists():
        os.remove(zip_path)



        Para que esta plantilla funcione perfectamente en tu app, solo tienes que hacer 2 conexiones clave en el resto de tu código:

Inyección en Playwright (Endpoint PDF):
Cuando llames a Playwright en tu ruta /exportar-pdf, tienes que pasarle la ruta que encontró la función escáner en el parámetro executable_path. Si no le pasas esto, Playwright intentará buscar su propio motor y crasheará.

ruta_lista = buscar_navegador_compatible()
# Le inyectas la ruta al launch()
browser = await p.chromium.launch(headless=True, executable_path=ruta_lista)

Ejecución en el bloque __main__:
Antes de hacer uvicorn.run(...), el sistema debe ejecutar la validación para asegurarse de que el motor exista antes de que los profesores empiecen a enviar HTML.

if __name__ == "__main__":
    # Verifica si existe un navegador
    motor_valido = buscar_navegador_compatible()

    # Si no existe (entorno LTSC puro), lo descarga en ese momento
    if not motor_valido:
        descargar_chromium_nativo()

    # Ya con la seguridad de que hay motor, levantas Uvicorn
    uvicorn.run("main:app", ...)

    