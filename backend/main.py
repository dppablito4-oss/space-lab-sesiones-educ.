import os
import io
import re
import sys
import secrets
import asyncio
import webbrowser
import threading
import subprocess
import warnings
import urllib.request
import zipfile
import tkinter as tk
from tkinter import scrolledtext
from pathlib import Path

# Determinar base absoluta del ejecutable para portabilidad
if getattr(sys, 'frozen', False):
    EXE_DIR = Path(sys.executable).parent
    BASE_DIR = Path(sys._MEIPASS)
else:
    EXE_DIR = Path(__file__).resolve().parent
    BASE_DIR = EXE_DIR.parent

LOCAL_BIN_DIR = EXE_DIR / "bin"
CHROMIUM_DIR = LOCAL_BIN_DIR / "chrome-win"
CHROMIUM_EXE = CHROMIUM_DIR / "chrome.exe"

# Desactivar advertencias molestas en la consola (como DeprecationWarnings de FastAPI/Lifespan)
warnings.filterwarnings("ignore")

# Configurar consola en Windows para UTF-8 de forma forzada para evitar fallos con emojis/bloques
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup, NavigableString, Tag
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# Librerías para estilizar consola
try:
    from rich import print as rprint
    from rich.console import Console
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
    from rich.panel import Panel
    console = Console()
except ImportError:
    # Fallback si no está instalado rich
    console = None
    def rprint(*args, **kwargs):
        print(*args, **kwargs)

# Inicialización de FastAPI
app = FastAPI(
    title="Motor de Exportación Pedagógica",
    description="Backend local para generación premium de PDFs y Word (.docx)"
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_private_network_header(request, call_next):
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("origin", "*")
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# Variables globales para el enlace de sesión
CONNECTION_TOKEN = secrets.token_hex(16)
CLIENT_CONNECTED = False

# Esquemas de Datos con Token obligatorio para mayor seguridad
class ExportPDFRequest(BaseModel):
    html_content: str
    titulo: str = "Sesion_de_Aprendizaje"
    token: str

class ExportDocxRequest(BaseModel):
    html_content: str
    titulo: str = "Sesion_de_Aprendizaje"
    token: str


@app.get("/")
def check_status():
    """Endpoint de control para verificar si el servidor local está activo."""
    return {
        "status": "Online",
        "engine": "FastAPI + Python Export Engine",
        "connected": CLIENT_CONNECTED
    }


@app.get("/verificar-token")
def verificar_token(token: str):
    """Verifica si el token proveído coincide con el de la sesión actual."""
    global CLIENT_CONNECTED
    if token == CONNECTION_TOKEN:
        CLIENT_CONNECTED = True
        print("\n⚡ [CONEXIÓN ESTABLECIDA] El navegador se ha enlazado con éxito.\n")
        return {"status": "Connected", "message": "Enlace establecido correctamente."}
    else:
        raise HTTPException(status_code=401, detail="Token de conexión inválido.")


@app.post("/exportar-pdf")
async def exportar_pdf(payload: ExportPDFRequest):
    """
    Exporta el HTML y CSS recibido a un archivo PDF físico A4
    utilizando Playwright (Chromium headless). Requiere token de conexión.
    """
    if payload.token != CONNECTION_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado: Token de conexión inválido.")

    try:
        # Sanitizar el nombre del archivo
        filename = re.sub(r'[^a-zA-Z0-9-_\s]', '', payload.titulo).replace(' ', '_')
        nombre_archivo = f"{filename}.pdf"

        # Contenido HTML base estructurado con codificación UTF-8
        documento_completo = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>{payload.titulo}</title>
            <style>
                @media print {{
                    @page {{
                        size: A4;
                        margin: 1.5cm 1cm 1.5cm 1cm;
                    }}
                }}
            </style>
        </head>
        <body>
            {payload.html_content}
        </body>
        </html>
        """

        async with async_playwright() as p:
            ruta_motor = buscar_navegador_compatible()
            launch_args = {"headless": True}
            if ruta_motor:
                launch_args["executable_path"] = ruta_motor
            browser = await p.chromium.launch(**launch_args)
            context = await browser.new_context()
            page = await context.new_page()
            
            # Cargar el HTML y esperar a que finalice la red
            await page.set_content(documento_completo, wait_until="networkidle")
            
            # Generación de PDF binario
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={
                    "top": "1.5cm",
                    "bottom": "1.5cm",
                    "left": "1.2cm",
                    "right": "1.2cm"
                }
            )
            await browser.close()

        if console:
            console.print(f"[green]✓ [PDF EXPORTADO] Generado con éxito: {nombre_archivo}[/green]")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={nombre_archivo}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        print("[ERROR PDF]", str(e))
        raise HTTPException(status_code=500, detail=f"Fallo al compilar PDF: {str(e)}")


# ────────────────────────────────────────────────────────────────────────
# UTILIDADES PARA CONSTRUCCIÓN DE WORD (.docx) NATIVO
# ────────────────────────────────────────────────────────────────────────

def set_cell_background(cell, hex_color: str):
    """Establece el color de fondo de una celda en Word."""
    shading_elm = OxmlElement('w:shd')
    shading_elm.set(qn('w:val'), 'clear')
    shading_elm.set(qn('w:color'), 'auto')
    shading_elm.set(qn('w:fill'), hex_color)
    cell._tc.get_or_add_tcPr().append(shading_elm)


def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    """Establece márgenes internos (padding) de una celda en dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def add_table_borders(table):
    """Agrega bordes delgados de color gris claro a toda la tabla."""
    tblPr = table._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'single')
        border.set(qn('w:sz'), '4')  # 4 = 1/2 pt
        border.set(qn('w:space'), '0')
        border.set(qn('w:color'), 'CBD5E1')  # Slate-300
        borders.append(border)
    tblPr.append(borders)


def build_docx_from_html(html_content: str) -> io.BytesIO:
    """Parsea recursivamente la estructura HTML y construye un documento .docx nativo."""
    doc = Document()
    
    # Configuración de márgenes estándar
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Estilo Normal
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Arial'
    style_normal.font.size = Pt(10)
    style_normal.font.color.rgb = RGBColor(30, 41, 59) # Slate-800

    soup = BeautifulSoup(html_content, 'html.parser')

    # Eliminar katex-html para evitar texto duplicado
    for katex_html in soup.find_all(class_='katex-html'):
        katex_html.decompose()

    processed_tags = set()

    def add_runs_to_paragraph(paragraph, element):
        for child in element.children:
            if isinstance(child, NavigableString):
                text = str(child)
                if text:
                    paragraph.add_run(text)
            elif isinstance(child, Tag):
                if child.name == 'br':
                    paragraph.add_run('\n')
                elif child.name in ['strong', 'b']:
                    run = paragraph.add_run()
                    run.bold = True
                    add_runs_to_paragraph(run, child)
                elif child.name in ['em', 'i']:
                    run = paragraph.add_run()
                    run.italic = True
                    add_runs_to_paragraph(run, child)
                elif child.name in ['span', 'a']:
                    add_runs_to_paragraph(paragraph, child)
                else:
                    add_runs_to_paragraph(paragraph, child)

    def walk_tree(element):
        if element in processed_tags:
            return
        
        if isinstance(element, Tag):
            # TÍTULOS
            if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                level = int(element.name[1])
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(14)
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.keep_with_next = True
                
                run = p.add_run()
                run.bold = True
                run.font.name = 'Arial'
                
                if level == 1:
                    run.font.size = Pt(16)
                    run.font.color.rgb = RGBColor(15, 23, 42)
                elif level == 2:
                    run.font.size = Pt(13)
                    run.font.color.rgb = RGBColor(30, 41, 59)
                else:
                    run.font.size = Pt(11)
                    run.font.color.rgb = RGBColor(71, 85, 105)
                
                add_runs_to_paragraph(p, element)
                processed_tags.add(element)
                return

            # PÁRRAFOS
            elif element.name == 'p':
                text_clean = element.get_text(strip=True)
                if not text_clean:
                    processed_tags.add(element)
                    return
                
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.line_spacing = 1.15
                add_runs_to_paragraph(p, element)
                processed_tags.add(element)
                return

            # LISTAS
            elif element.name in ['ul', 'ol']:
                list_style = 'List Bullet' if element.name == 'ul' else 'List Number'
                for li in element.find_all('li', recursive=False):
                    p = doc.add_paragraph(style=list_style)
                    p.paragraph_format.space_after = Pt(4)
                    p.paragraph_format.line_spacing = 1.15
                    add_runs_to_paragraph(p, li)
                processed_tags.add(element)
                return

            # TABLAS
            elif element.name == 'table':
                html_rows = element.find_all('tr', recursive=True)
                if not html_rows:
                    processed_tags.add(element)
                    return

                max_cols = 0
                for r in html_rows:
                    cols = len(r.find_all(['td', 'th'], recursive=False))
                    if cols > max_cols:
                        max_cols = cols

                if max_cols == 0:
                    processed_tags.add(element)
                    return

                docx_table = doc.add_table(rows=0, cols=max_cols)
                docx_table.autofit = True
                add_table_borders(docx_table)

                for row_idx, html_row in enumerate(html_rows):
                    row_cells = docx_table.add_row().cells
                    html_cells = html_row.find_all(['td', 'th'], recursive=False)

                    for col_idx, html_cell in enumerate(html_cells):
                        if col_idx < len(row_cells):
                            cell = row_cells[col_idx]
                            is_header = html_cell.name == 'th'

                            bg_color = "F8FAFC" if is_header else "FFFFFF"

                            style_attr = html_cell.get('style', '')
                            class_attr = html_cell.get('class', [])
                            
                            hex_match = re.search(r'background-color:\s*#([A-Fa-f0-9]{6})', style_attr)
                            if hex_match:
                                bg_color = hex_match.group(1).upper()
                            elif 'cell-peru' in class_attr:
                                bg_color = "C0392B"
                            elif 'cell-minedu' in class_attr:
                                bg_color = "2C3E50"

                            set_cell_background(cell, bg_color)
                            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)

                            p = cell.paragraphs[0]
                            p.paragraph_format.space_after = Pt(2)
                            p.paragraph_format.line_spacing = 1.1

                            if is_header:
                                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                                run = p.add_run()
                                run.bold = True
                                if bg_color in ["C0392B", "2C3E50"]:
                                    run.font.color.rgb = RGBColor(255, 255, 255)
                                else:
                                    run.font.color.rgb = RGBColor(15, 23, 42)
                                add_runs_to_paragraph(p, html_cell)
                            else:
                                add_runs_to_paragraph(p, html_cell)

                doc.add_paragraph().paragraph_format.space_before = Pt(8)
                processed_tags.add(element)
                return

            for child in element.children:
                walk_tree(child)

    walk_tree(soup)

    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)
    return stream


@app.post("/exportar-docx")
async def exportar_docx(payload: ExportDocxRequest):
    """
    Convierte el HTML de la sesión en un archivo Word (.docx) nativo.
    Requiere token de conexión.
    """
    if payload.token != CONNECTION_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado: Token de conexión inválido.")

    try:
        # Sanitizar nombre del archivo
        filename = re.sub(r'[^a-zA-Z0-9-_\s]', '', payload.titulo).replace(' ', '_')
        nombre_archivo = f"{filename}.docx"

        # Compilar archivo DOCX
        docx_stream = build_docx_from_html(payload.html_content)

        if console:
            console.print(f"[blue]✓ [WORD EXPORTADO] Generado con éxito: {nombre_archivo}[/blue]")

        return StreamingResponse(
            docx_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename={nombre_archivo}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        print("[ERROR DOCX]", str(e))
        raise HTTPException(status_code=500, detail=f"Fallo al compilar archivo de Word (.docx): {str(e)}")


# ────────────────────────────────────────────────────────────────────────
# INICIALIZACIÓN, COMPROBACIÓN DE CHROMIUM Y ARRANQUE
# ────────────────────────────────────────────────────────────────────────

def buscar_navegador_compatible():
    """Busca un ejecutable de Chromium en la carpeta local o en el sistema."""
    # 1. Prioridad Máxima: Verificar si ya existe en nuestra carpeta portable './bin'
    if CHROMIUM_EXE.exists():
        return str(CHROMIUM_EXE)

    # 2. Prioridad Secundaria: Buscar navegadores instalados en Windows
    if sys.platform.startswith('win'):
        rutas_sistema = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        ]
        for ruta in rutas_sistema:
            if Path(ruta).exists():
                return ruta
    return None


def descargar_chromium_nativo():
    """Descarga Chromium usando urllib para no congelar el .exe y muestra barra de progreso."""
    LOCAL_BIN_DIR.mkdir(exist_ok=True)
    zip_path = LOCAL_BIN_DIR / "chromium.zip"
    
    # URL directa de Google APIs (Versión ligera y estable para Windows x64)
    url_chromium = "https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/1182249/chrome-win.zip"

    print("\n⚠️  [MOTOR INCOMPLETO] No se detectó ningún navegador compatible (Chrome/Brave/Edge) ni motor local.")
    print("Iniciando descarga de motor Chromium portable (aprox. 140MB)...")
    
    last_percent = -1
    def progreso_download(block_num, block_size, total_size):
        nonlocal last_percent
        if total_size > 0:
            completed = block_num * block_size
            percent = int((completed / total_size) * 100)
            if percent != last_percent and percent % 5 == 0:  # Cada 5%
                last_percent = percent
                completed_mb = completed / (1024 * 1024)
                total_mb = total_size / (1024 * 1024)
                print(f"Descargando Chromium: {percent}% completado ({completed_mb:.1f} MB de {total_mb:.1f} MB)")

    # Extracción del ZIP de forma nativa
    try:
        urllib.request.urlretrieve(url_chromium, zip_path, reporthook=progreso_download)
        print("✓ Descarga completada. Extrayendo motor portable...")
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(LOCAL_BIN_DIR)
            
        # Eliminar el ZIP basura para ahorrar espacio
        if zip_path.exists():
            os.remove(zip_path)
            
        print("✓ Motor Chromium extraído y listo para usar en ./bin/chrome-win/\n")
    except Exception as e:
        print(f"❌ Error al descargar o extraer Chromium: {str(e)}")


@app.on_event("startup")
async def startup_event():
    """Evento que se dispara al iniciar FastAPI para mostrar la URL de conexión segura en los logs."""
    target_url = f"https://sesiones.sypablitodp.site/conexion.html?token={CONNECTION_TOKEN}"
    print(f"🌐 [MOTOR ONLINE] Servidor de exportación corriendo en http://127.0.0.1:8000")
    print(f"🔗 [ENLACE SEGURO] URL de vinculación segura:\n{target_url}\n")


class TerminalRedirector:
    def __init__(self, text_widget):
        self.text_widget = text_widget
        self.ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

    def write(self, string):
        clean_string = self.ansi_escape.sub('', string)
        if not clean_string: return
        
        try:
            self.text_widget.configure(state='normal')
            # Pintar de verde si detecta éxito, rojo si es error, blanco el resto
            tag = "muted"
            if "✓" in clean_string or "ONLINE" in clean_string or "Conectado" in clean_string or "enlazado" in clean_string: tag = "green"
            if "❌" in clean_string or "ERROR" in clean_string or "Fallo" in clean_string: tag = "red"
            
            self.text_widget.insert('end', clean_string, tag)
            self.text_widget.see('end')
            self.text_widget.configure(state='disabled')
        except Exception:
            pass

    def flush(self): pass


def start_gui():
    """Interfaz gráfica ultra-minimalista tipo terminal hacker."""
    root = tk.Tk()
    root.title("S.Y. PABLITO_DP - Servidor Local")
    root.geometry("850x500")
    root.configure(bg="#050505") # Negro profundo
    root.resizable(False, False)

    # Cargar icono si existe
    ico_path = BASE_DIR / "assets" / "logo.ico"
    if not ico_path.exists():
        ico_path = EXE_DIR.parent / "assets" / "logo.ico"
    if ico_path.exists():
        try:
            root.iconbitmap(str(ico_path))
        except Exception:
            pass

    # Interceptar el evento de cierre de ventana para mostrar advertencia
    from tkinter import messagebox
    def on_closing():
        if messagebox.askokcancel("Confirmar Salida", "¿Deseas cerrar el motor de exportación?\n\nSi lo cierras, se desconectará del navegador y no podrás exportar PDFs ni archivos de Word."):
            root.destroy()
            
    root.protocol("WM_DELETE_WINDOW", on_closing)

    # 1. Widget de Texto Principal (Ocupa toda la ventana, sin bordes)
    terminal = scrolledtext.ScrolledText(
        root, 
        bg="#050505", 
        fg="#e2e8f0", 
        font=("Consolas", 10), 
        relief="flat", 
        bd=0, 
        insertbackground="#e2e8f0",
        highlightthickness=0,
        padx=20,
        pady=20
    )
    terminal.pack(fill="both", expand=True)

    # 2. Configuración de Etiquetas de Color (Sintaxis Hacker)
    terminal.tag_config("magenta", foreground="#d946ef")
    terminal.tag_config("blue", foreground="#3b82f6")
    terminal.tag_config("cyan", foreground="#06b6d4")
    terminal.tag_config("green", foreground="#22c55e")
    terminal.tag_config("yellow", foreground="#eab308")
    terminal.tag_config("red", foreground="#ef4444")
    terminal.tag_config("muted", foreground="#64748b")
    
    # Etiqueta especial para el ENLACE (Puras letritas, pero clickeable)
    terminal.tag_config("link", foreground="#38bdf8", underline=True)
    
    # Eventos del enlace (Cambia el cursor a la manito y abre la web)
    target_url = f"https://sesiones.sypablitodp.site/conexion.html?token={CONNECTION_TOKEN}"
    terminal.tag_bind("link", "<Enter>", lambda e: terminal.config(cursor="hand2"))
    terminal.tag_bind("link", "<Leave>", lambda e: terminal.config(cursor="xterm"))
    terminal.tag_bind("link", "<Button-1>", lambda e: webbrowser.open(target_url))

    # 3. El Banner Oficial (Ahora se renderizará perfecto sin cortes)
    banner_magenta = (
        "███████╗     ██╗   ██╗     ██████╗   █████╗  ██████╗  ██╗      ████████╗ ████████╗  ██████╗           ██████╗  ██████╗ \n"
        "██╔════╝     ╚██╗ ██╔╝     ██╔══██╗ ██╔══██╗ ██╔══██╗ ██║      ╚══██╔══╝ ╚══██╔══╝ ██╔═══██╗          ██╔══██╗ ██╔══██╗ \n"
    )
    banner_blue = (
        "███████╗      ╚████╔╝      ██████╔╝ ███████║ ██████╔╝ ██║         ██║       ██║    ██║   ██║          ██║  ██║ ██████╔╝ \n"
        "╚════██║ ██╗   ╚██╔╝   ██╗ ██╔═══╝  ██╔══██║ ██╔══██╗ ██║         ██║       ██║    ██║   ██║          ██║  ██║ ██╔═══╝  \n"
    )
    banner_cyan = (
        "███████║ ╚═╝    ██║    ╚═╝ ██║      ██║  ██║ ██████╔╝ ███████╗ ████████╗    ██║    ╚██████╔╝ ████████╗ ██████╔╝ ██║     \n"
        "╚══════╝        ╚═╝        ╚═╝      ╚═╝  ╚═╝ ╚═════╝  ╚══════╝ ╚══════╝    ╚═╝     ╚═════╝  ╚═══════╝ ╚═════╝  ╚═╝     \n"
    )

    # Insertar el Banner
    terminal.insert("end", banner_magenta, "magenta")
    terminal.insert("end", banner_blue, "blue")
    terminal.insert("end", banner_cyan, "cyan")
    
    # Separador y créditos
    terminal.insert("end", "\n" + "─" * 80 + "\n", "muted")
    terminal.insert("end", "  [ MOTOR DE EXPORTACIÓN LOCAL ]", "green")
    terminal.insert("end", " | Desarrollado por: Samuel Pablo C.\n", "muted")
    terminal.insert("end", "─" * 80 + "\n\n", "muted")

    # Instrucciones y URL Clickeable
    terminal.insert("end", "[ESTADO] ", "yellow")
    terminal.insert("end", "Esperando vinculación de la web...\n")
    terminal.insert("end", "[ENLACE] ", "cyan")
    terminal.insert("end", "Haz clic en la siguiente URL para autorizar el motor:\n")
    
    # Aquí insertamos la URL pura con la etiqueta 'link'
    terminal.insert("end", f"> {target_url}\n\n", "link")

    sys.stdout = TerminalRedirector(terminal)
    sys.stderr = TerminalRedirector(terminal)
    terminal.configure(state='disabled')

    # 5. Hilo para arrancar FastAPI sin congelar la terminal UI
    def run_server_flow():
        try:
            print("Escaneando motor de renderizado Chromium...")
            motor_valido = buscar_navegador_compatible()
            if not motor_valido:
                descargar_chromium_nativo()
            else:
                print(f"✓ Navegador compatible detectado: {motor_valido}")
            
            print("Iniciando servidor local en el puerto 8000...")
            import uvicorn
            uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning", log_config=None)
        except Exception as e:
            print(f"\n❌ [ERROR CRÍTICO]: {str(e)}")

    threading.Thread(target=run_server_flow, daemon=True).start()
    
    # 6. Actualizar el estado visual cuando se conecte
    def check_connection():
        if CLIENT_CONNECTED:
            terminal.configure(state='normal')
            terminal.insert('end', "\n✓ [CONECTADO] El enlace de seguridad fue establecido con la web.\n", "green")
            terminal.insert('end', "⚠️  [IMPORTANTE] Mantén esta ventana abierta en segundo plano. Si la cierras, se desconectará del navegador.\n\n", "yellow")
            terminal.configure(state='disabled')
            terminal.see('end')
        else:
            root.after(2000, check_connection)

    root.after(2000, check_connection)
    root.mainloop()

if __name__ == "__main__":
    start_gui()
