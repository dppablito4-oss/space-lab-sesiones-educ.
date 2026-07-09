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
from docx_builder import build_docx_from_json, build_docx_from_html





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
TOKEN_FILE = BASE_DIR / "connection_token.txt"

if TOKEN_FILE.exists():
    try:
        CONNECTION_TOKEN = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        CONNECTION_TOKEN = secrets.token_hex(16)
        TOKEN_FILE.write_text(CONNECTION_TOKEN, encoding="utf-8")
else:
    CONNECTION_TOKEN = secrets.token_hex(16)
    try:
        TOKEN_FILE.write_text(CONNECTION_TOKEN, encoding="utf-8")
    except Exception:
        pass
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

# ── MODELO DE DATOS JSON ESTRUCTURADO PARA SESIONES PREMIUM ──
from typing import List, Optional

class MetadataData(BaseModel):
    institucion: Optional[str] = ""
    dre: Optional[str] = ""
    ugel: Optional[str] = ""
    docente: Optional[str] = ""
    director: Optional[str] = ""
    fecha: Optional[str] = ""
    nivel: Optional[str] = ""
    numero_sesion: Optional[str] = ""
    grado: Optional[str] = ""
    seccion: Optional[str] = ""
    area: Optional[str] = ""
    duracion: Optional[str] = ""
    unidad: Optional[str] = ""
    titulo: Optional[str] = ""
    logo_left_url: Optional[str] = ""
    logo_regional_url: Optional[str] = ""

class PropositoData(BaseModel):
    proposito_texto: Optional[str] = ""
    conocimientos: Optional[str] = ""
    competencia: Optional[str] = ""
    estandar: Optional[str] = ""
    capacidades: List[str] = []
    criterios: List[str] = []
    producto_evidencia: Optional[str] = ""
    instrumento: Optional[str] = ""

class CompetenciaTransversal(BaseModel):
    titulo: str
    desempenos: List[str] = []

class EnfoqueTransversal(BaseModel):
    nombre: str
    valor: str
    actitudes: str

class RecursosData(BaseModel):
    enlaces: Optional[str] = ""
    materiales: Optional[str] = ""
    refuerzo: Optional[str] = ""

class MomentoInicio(BaseModel):
    tiempo_total: Optional[str] = ""
    actividades: List[str] = []

class ProcesoDesarrollo(BaseModel):
    clave: str
    titulo: str
    contenido: List[str] = []

class MomentoDesarrollo(BaseModel):
    tiempo_total: Optional[str] = ""
    procesos: List[ProcesoDesarrollo] = []

class MomentoCierre(BaseModel):
    tiempo_total: Optional[str] = ""
    metacognicion: List[str] = []
    evaluacion: List[str] = []
    extension: List[str] = []

class MomentosData(BaseModel):
    inicio: MomentoInicio
    desarrollo: MomentoDesarrollo
    cierre: MomentoCierre

class FichaTrabajoData(BaseModel):
    titulo: Optional[str] = ""
    indicaciones: Optional[str] = ""
    actividades: Optional[str] = ""

class SesionAprendizajeRequest(BaseModel):
    metadata: MetadataData
    proposito: PropositoData
    competencias_transversales: List[CompetenciaTransversal] = []
    enfoques_transversales: List[EnfoqueTransversal] = []
    recursos: RecursosData
    momentos: MomentosData
    ficha_trabajo: Optional[FichaTrabajoData] = None
    alumnos: Optional[List[str]] = []
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
        if not CLIENT_CONNECTED:
            CLIENT_CONNECTED = True
            print("\n⚡ [CONEXIÓN ESTABLECIDA] El navegador se ha enlazado con éxito.\n")
        return {"status": "Connected", "message": "Enlace establecido correctamente."}
    else:
        raise HTTPException(status_code=401, detail="Token de conexión inválido.")


@app.post("/exportar-pdf")
async def exportar_pdf(payload: ExportPDFRequest):
    """
    Exporta el HTML y CSS recibido a un archivo PDF físico A4
    utilizando Playwright (Chromium headless) con paginado dinámico y reglas anti-corte de tablas.
    """
    if payload.token != CONNECTION_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado: Token de conexión inválido.")

    try:
        # Sanitizar el nombre del archivo
        filename = re.sub(r'[^a-zA-Z0-9-_\s]', '', payload.titulo).replace(' ', '_')
        nombre_archivo = f"{filename}.pdf"

        # HTML base mínimo — el frontend ya trae el HTML pre-paginado en divs .hoja-a4
        documento_completo = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>{payload.titulo}</title>
            <style>
                /* Glue CSS mínimo: el frontend es responsable del diseño y la paginación */
                * {{ box-sizing: border-box; margin: 0; padding: 0; }}
                body {{
                    background: #fff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }}
                /* Garantizar salto de página después de cada hoja */
                .hoja-a4 {{
                    page-break-after: always !important;
                    break-after: page !important;
                }}
                /* Ocultar elementos interactivos residuales */
                .no-print, .add-logo-placeholder, .btn-remove-logo {{
                    display: none !important;
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
            
            await page.set_content(documento_completo, wait_until="networkidle")
            
            # Usar prefer_css_page_size=True → Chromium respeta la medida exacta del div .hoja-a4
            # Los márgenes van en cero porque el padding ya está definido en el div
            pdf_bytes = await page.pdf(
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
                display_header_footer=False
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


def escape_html(text: str) -> str:
    """Escapa caracteres HTML básicos."""
    if not text:
        return ""
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&#x27;"))


def build_pdf_html_from_json(session: SesionAprendizajeRequest) -> str:
    # 1. Cabecera con logos si existen
    logo_left_html = ""
    if session.metadata.logo_left_url:
        logo_left_html = f'<img src="{session.metadata.logo_left_url}" class="header-logo-img" />'

    logo_right_html = ""
    if session.metadata.logo_regional_url:
        logo_right_html = f'<img src="{session.metadata.logo_regional_url}" class="header-logo-img" />'

    # 2. Listas de propósitos
    capacidades_html = "".join([f"<li>{escape_html(c)}</li>" for c in session.proposito.capacidades])
    criterios_html = "".join([f"<li>{escape_html(c)}</li>" for c in session.proposito.criterios])

    # 3. Competencias transversales
    ct_rows_html = ""
    if session.competencias_transversales:
        for ct in session.competencias_transversales:
            desempenos_li = "".join([f"<li>{escape_html(d)}</li>" for d in ct.desempenos])
            ct_rows_html += f"""
            <tr>
                <td style="font-weight: 600;">{escape_html(ct.titulo)}</td>
                <td><ul class="session-list">{desempenos_li}</ul></td>
            </tr>
            """

    # 4. Enfoques transversales
    enfoques_rows_html = ""
    if session.enfoques_transversales:
        for enf in session.enfoques_transversales:
            enfoques_rows_html += f"""
            <tr>
                <td style="font-weight: 600;">{escape_html(enf.nombre)}</td>
                <td>{escape_html(enf.valor)}</td>
                <td>{escape_html(enf.actitudes)}</td>
            </tr>
            """

    # 5. Momentos Didácticos (Fusión inteligente con rowspan en HTML)
    procesos_des = session.momentos.desarrollo.processes if hasattr(session.momentos.desarrollo, 'processes') else session.momentos.desarrollo.procesos
    cant_procesos = len(procesos_des) if procesos_des else 1

    # Inicio
    inicio_actividades_html = "".join([f"<p class='proceso-parrafo'>{escape_html(act)}</p>" for act in session.momentos.inicio.actividades])
    
    # Desarrollo (Primer proceso y siguientes)
    desarrollo_primero_html = ""
    desarrollo_siguientes_html = ""
    
    if procesos_des:
        p_primero = procesos_des[0]
        p_primero_cont = "".join([f"<p class='proceso-parrafo'>{escape_html(par)}</p>" for par in p_primero.contenido])
        desarrollo_primero_html = f"""
        <div class="proceso-titulo">{escape_html(p_primero.titulo)}</div>
        {p_primero_cont}
        """
        
        for idx in range(1, cant_procesos):
            p_sig = procesos_des[idx]
            p_sig_cont = "".join([f"<p class='proceso-parrafo'>{escape_html(par)}</p>" for par in p_sig.contenido])
            desarrollo_siguientes_html += f"""
            <tr>
                <td>
                    <div class="proceso-titulo">{escape_html(p_sig.titulo)}</div>
                    {p_sig_cont}
                </td>
            </tr>
            """
    else:
        desarrollo_primero_html = "<p class='proceso-parrafo'>Gestión y Acompañamiento del Desarrollo de Competencias...</p>"

    # Cierre
    cierre_estrategias_html = ""
    if session.momentos.cierre.metacognicion:
        cierre_estrategias_html += "<p class='proceso-parrafo'><strong>Metacognición:</strong></p><ul class='session-list'>"
        cierre_estrategias_html += "".join([f"<li>{escape_html(m)}</li>" for m in session.momentos.cierre.metacognicion])
        cierre_estrategias_html += "</ul>"
    if session.momentos.cierre.evaluacion:
        cierre_estrategias_html += "<p class='proceso-parrafo' style='margin-top:8px;'><strong>Evaluación formativa:</strong></p><ul class='session-list'>"
        cierre_estrategias_html += "".join([f"<li>{escape_html(e)}</li>" for e in session.momentos.cierre.evaluacion])
        cierre_estrategias_html += "</ul>"
    if session.momentos.cierre.extension:
        cierre_estrategias_html += "<p class='proceso-parrafo' style='margin-top:8px;'><strong>Extensión para casa:</strong></p><ul class='session-list'>"
        cierre_estrategias_html += "".join([f"<li>{escape_html(ext)}</li>" for ext in session.momentos.cierre.extension])
        cierre_estrategias_html += "</ul>"

    # Ficha de Trabajo
    ficha_html = ""
    if session.ficha_trabajo:
        ficha_actividades_txt = session.ficha_trabajo.actividades or ""
        ficha_actividades_txt = re.sub(r'<[^>]*>', '', ficha_actividades_txt) # Limpiar tags HTML residuales
        ficha_actividades_p = "".join([f"<p class='proceso-parrafo'>{escape_html(p)}</p>" for p in ficha_actividades_txt.split("\n") if p.strip()])
        
        ficha_html = f"""
        <div class="hoja-a4" style="page-break-before: always; break-before: page;">
            <div class="ficha-title">FICHA DE TRABAJO INDEPENDIENTE PARA EL ESTUDIANTE</div>
            
            <table class="ficha-header-table">
                <tr>
                    <td>Nombre: __________________________________________________</td>
                    <td style="text-align: right;">Grado y Sección: ________________</td>
                </tr>
            </table>
            
            <div class="ficha-act-title">🎨 Actividad: {escape_html(session.ficha_trabajo.titulo or 'Mi Ficha Práctica')}</div>
            <div class="ficha-indicaciones">
                <strong>Indicaciones: </strong><span>{escape_html(session.ficha_trabajo.indicaciones or 'Realiza la actividad según las indicaciones.')}</span>
            </div>
            
            <div class="ficha-contenido">
                {ficha_actividades_p}
            </div>
        </div>
        """

    # 5.5. Construir la Lista de Cotejo dinámica basada en la lista de alumnos
    alumnos_list = session.alumnos if session.alumnos else []
    if not alumnos_list:
        alumnos_list = [f"Estudiante {i+1}" for i in range(30)]

    criterios = session.proposito.criterios if session.proposito.criterios else []
    if not criterios:
        criterios = [
            "Expresa con diversas representaciones la comprensión sobre el tema.",
            "Ordena y organiza conceptos clave para resolver problemas.",
            "Emplea estrategias y procedimientos diversos para realizar las tareas.",
            "Halla y valida soluciones utilizando criterios y conocimientos del área."
        ]

    criterios_headers_html = "".join([
        f"<th colspan='2' style='font-size: 7.5pt; font-weight: bold; background: #e2e8f0; border: 1px solid #000; padding: 4px; text-align: center; vertical-align: top; max-width: 150px;'>{escape_html(c)}</th>"
        for c in criterios
    ])

    criterios_subheaders_html = "".join([
        "<th style='width: 30px; text-align: center; background: #f1f5f9; border: 1px solid #000; font-size: 8pt; font-weight: bold;'>SI</th><th style='width: 30px; text-align: center; background: #f1f5f9; border: 1px solid #000; font-size: 8pt; font-weight: bold;'>NO</th>"
        for _ in criterios
    ])

    rows_html = ""
    for idx, stud in enumerate(alumnos_list):
        display_name = "" if stud.startswith("Estudiante ") else stud
        criterios_cells_html = "".join([
            "<td style='border: 1px solid #000;'></td><td style='border: 1px solid #000;'></td>"
            for _ in criterios
        ])
        rows_html += f"""
        <tr>
            <td style="text-align: center; font-weight: 700; height: 26px; border: 1px solid #000; font-size: 8.5pt;">{idx + 1}</td>
            <td style="text-align: left; padding-left: 6px; font-weight: 600; border: 1px solid #000; font-size: 8.5pt;">{escape_html(display_name)}</td>
            {criterios_cells_html}
        </tr>
        """

    lista_cotejo_html = f"""
    <div class="hoja-a4" style="page-break-before: always; break-before: page; padding: 18mm 12mm;">
        <div class="section-title" style="text-align: center; font-size: 11pt; font-weight: 800; text-transform: uppercase;">Instrumento de Evaluación</div>
        <div class="section-title" style="text-align: center; font-size: 9.5pt; font-weight: 700; background: #f1f5f9; color: #000; margin-top: 4px;">
            LISTA DE COTEJO {escape_html(session.metadata.grado or '2°')} {escape_html(session.metadata.seccion or 'A')}
        </div>
        
        <table class="content-table momentos-table" style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #000;">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 30px; text-align: center; background: #e2e8f0; border: 1px solid #000; font-size: 8.5pt;">N°</th>
                    <th rowspan="2" style="text-align: left; padding-left: 6px; background: #e2e8f0; border: 1px solid #000; font-size: 8.5pt;">ESTUDIANTES</th>
                    {criterios_headers_html}
                </tr>
                <tr>
                    {criterios_subheaders_html}
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
    </div>
    """

    # 6. HTML final unificado
    html_content = f"""<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <!-- Cargar MathJax para renderizar ecuaciones matemáticas en el PDF -->
        <script>
            window.MathJax = {{
                tex: {{
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true
                }},
                options: {{
                    ignoreHtmlClass: 'tex2jax_ignore',
                    processHtmlClass: 'tex2jax_process'
                }},
                svg: {{
                    fontCache: 'global'
                }}
            }};
        </script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
            
            * {{ box-sizing: border-box; margin: 0; padding: 0; }}
            body {{
                font-family: 'Inter', Arial, sans-serif;
                background: #ffffff;
                color: #1e293b;
                font-size: 10pt;
                line-height: 1.4;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }}

            @page {
                size: A4 portrait;
                margin: 0 !important;
            }

            .hoja-a4 {
                width: 210mm;
                height: 297mm;
                min-height: 297mm;
                max-height: 297mm;
                padding: 18mm 12mm;
                box-sizing: border-box;
                background: #ffffff;
                position: relative;
                page-break-after: always;
                break-after: page;
                overflow: hidden;
            }

            /* Cabecera */
            .header-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
            }}
            .header-table td {{
                border: none !important;
                padding: 0;
                vertical-align: middle;
            }}
            .header-logos {{
                width: 70px;
            }}
            .header-logo-img {{
                max-width: 65px;
                max-height: 65px;
                object-fit: contain;
            }}
            .header-text {{
                text-align: center;
                font-size: 7.5pt;
                line-height: 1.25;
                color: #334155;
            }}
            .header-text .minedu {{
                font-weight: 700;
                font-size: 8pt;
                color: #0f172a;
            }}
            .header-text .dre, .header-text .ugel {{
                font-weight: 600;
                font-size: 8pt;
            }}
            .header-text .agp {{
                font-style: italic;
                color: #64748b;
            }}

            .divider {{
                border-bottom: 2px solid #0f172a;
                margin-top: 4px;
                margin-bottom: 12px;
            }}

            .title-box {{
                text-align: center;
                margin-bottom: 12px;
            }}
            .title-box h1 {{
                font-size: 13pt;
                font-weight: 700;
                margin: 0;
                color: #0f172a;
                text-transform: uppercase;
            }}
            .title-box h2 {{
                font-size: 10.5pt;
                font-weight: 600;
                font-style: italic;
                margin: 2px 0 0 0;
                color: #334155;
            }}

            /* Tablas */
            table.content-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
                page-break-inside: auto;
            }}
            table.content-table tr {{
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }}
            table.content-table th, table.content-table td {{
                border: 1px solid #cbd5e1;
                padding: 5px 7px;
                font-size: 9pt;
                vertical-align: top;
            }}
            table.content-table th {{
                background-color: #f1f5f9;
                font-weight: 600;
                text-align: left;
                color: #0f172a;
            }}
            table.content-table td.label-cell {{
                background-color: #f8fafc;
                font-weight: 600;
                color: #334155;
                width: 140px;
            }}

            .section-title {{
                font-size: 10.5pt;
                font-weight: 700;
                color: #0f172a;
                margin: 12px 0 4px 0;
                text-transform: uppercase;
                border-left: 3px solid #3b82f6;
                padding-left: 6px;
            }}

            .section-content {{
                font-size: 9.5pt;
                color: #334155;
                padding-left: 4px;
                margin-bottom: 10px;
            }}

            /* Listas */
            ul.session-list {{
                margin: 0;
                padding-left: 14px;
            }}
            ul.session-list li {{
                margin-bottom: 2px;
            }}

            /* Momentos didácticos */
            .momentos-table th {{
                background-color: #e2e8f0 !important;
                font-size: 8.5pt !important;
                text-align: center !important;
            }}
            .momento-label-cell {{
                background-color: #f8fafc;
                font-weight: 700;
                font-size: 9pt;
                color: #0f172a;
                width: 120px;
            }}
            .momento-time {{
                font-size: 7.5pt;
                color: #64748b;
                margin-top: 4px;
                font-weight: 600;
            }}
            .momento-eval-cell {{
                background-color: #f8fafc;
                font-weight: 600;
                font-size: 8pt;
                color: #475569;
                width: 95px;
            }}
            .proceso-titulo {{
                font-weight: 700;
                color: #b91c1c; /* C0392B */
                font-size: 8.5pt;
                text-transform: uppercase;
                margin-bottom: 4px;
            }}
            .proceso-parrafo {{
                margin: 0 0 4px 0;
                font-size: 9pt;
            }}

            /* Firmas */
            .firmas-container {{
                display: flex;
                justify-content: space-between;
                margin-top: 35px;
                padding: 0 30px;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }}
            .firma-box {{
                text-align: center;
                width: 180px;
            }}
            .firma-linea {{
                border-top: 1px solid #475569;
                margin-bottom: 4px;
            }}
            .firma-nombre {{
                font-weight: 600;
                font-size: 8.5pt;
                color: #0f172a;
            }}
            .firma-cargo {{
                font-size: 7.5pt;
                color: #64748b;
            }}

            /* Ficha de trabajo */
            .ficha-title {{
                text-align: center;
                font-size: 11pt;
                font-weight: 700;
                color: #0f172a;
                margin-top: 5px;
                margin-bottom: 15px;
                text-transform: uppercase;
            }}
            .ficha-header-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
            }}
            .ficha-header-table td {{
                border-bottom: 2px solid #3498db;
                padding: 5px 0;
                font-weight: 600;
                font-size: 9pt;
                color: #2c3e50;
            }}
            .ficha-act-title {{
                font-size: 10.5pt;
                font-weight: 700;
                color: #2980b9;
                margin-top: 12px;
                margin-bottom: 4px;
            }}
            .ficha-indicaciones {{
                font-size: 9pt;
                margin-bottom: 10px;
            }}
            .ficha-indicaciones strong {{
                color: #0f172a;
            }}
            .ficha-indicaciones span {{
                font-style: italic;
                color: #555;
            }}
            .ficha-contenido {{
                font-size: 9pt;
                color: #334155;
                white-space: pre-wrap;
            }}
        </style>
    </head>
    <body>
        <div class="hoja-a4">
            <!-- ════════ CABECERA INSTITUCIONAL ════════ -->
            <table class="header-table">
                <tr>
                    <td class="header-logos" style="text-align: left;">
                        {logo_left_html}
                    </td>
                    <td class="header-text">
                        <span class="minedu">MINISTERIO DE EDUCACIÓN</span><br>
                        <span class="dre">{escape_html(session.metadata.dre) or 'DIRECCIÓN REGIONAL DE EDUCACIÓN'}</span><br>
                        <span class="ugel">{escape_html(session.metadata.ugel) or 'UNIDAD DE GESTIÓN EDUCATIVA LOCAL'}</span><br>
                        <span class="agp">ÁREA DE GESTIÓN PEDAGÓGICA</span>
                    </td>
                    <td class="header-logos" style="text-align: right;">
                        {logo_right_html}
                    </td>
                </tr>
            </table>
            
            <div class="divider"></div>
            
            <!-- ════════ TÍTULO PRINCIPAL ════════ -->
            <div class="title-box">
                <h1>SESIÓN DE APRENDIZAJE N° {escape_html(session.metadata.numero_sesion) or '01'}</h1>
                <h2>"{escape_html(session.metadata.titulo) or 'Título de la Sesión'}"</h2>
            </div>
            
            <!-- ════════ DATOS GENERALES ════════ -->
            <table class="content-table">
                <tr>
                    <td class="label-cell">Institución Educativa</td>
                    <td colspan="3">{escape_html(session.metadata.institucion)}</td>
                    <td class="label-cell">Nivel</td>
                    <td>{escape_html(session.metadata.nivel)}</td>
                </tr>
                <tr>
                    <td class="label-cell">Docente</td>
                    <td colspan="3">{escape_html(session.metadata.docente)}</td>
                    <td class="label-cell">Área</td>
                    <td>{escape_html(session.metadata.area)}</td>
                </tr>
                <tr>
                    <td class="label-cell">Grado</td>
                    <td>{escape_html(session.metadata.grado)}</td>
                    <td class="label-cell" style="width: 80px;">Sección</td>
                    <td>{escape_html(session.metadata.seccion)}</td>
                    <td class="label-cell">Unidad / Proyecto</td>
                    <td>{escape_html(session.metadata.unidad)}</td>
                </tr>
                <tr>
                    <td class="label-cell">Fecha</td>
                    <td colspan="3">{escape_html(session.metadata.fecha)}</td>
                    <td class="label-cell">Duración</td>
                    <td>{escape_html(session.metadata.duracion)} min</td>
                </tr>
            </table>
            
            <!-- ════════ I. PROPÓSITO ════════ -->
            <div class="section-title">I. Propósito de la Sesión</div>
            <div class="section-content">
                {escape_html(session.proposito.proposito_texto)}
            </div>
            
            <!-- ════════ II. CONOCIMIENTOS ════════ -->
            <div class="section-title">II. Conocimientos</div>
            <div class="section-content">
                {escape_html(session.proposito.conocimientos)}
            </div>
            
            <!-- ════════ III. PROPÓSITOS DE APRENDIZAJE ════════ -->
            <div class="section-title">III. Propósitos de Aprendizaje</div>
            
            <table class="content-table" style="margin-top: 4px;">
                <tr>
                    <td class="label-cell" style="width: 140px;">Competencia</td>
                    <td><strong>{escape_html(session.proposito.competencia)}</strong></td>
                </tr>
                <tr>
                    <td class="label-cell">Estándar de aprendizaje</td>
                    <td style="font-size: 8.5pt; color: #475569;">{escape_html(session.proposito.estandar)}</td>
                </tr>
            </table>
            
            <table class="content-table">
                <thead>
                    <tr>
                        <th>COMPETENCIAS</th>
                        <th>CAPACIDADES</th>
                        <th>CRITERIOS DE EVALUACIÓN</th>
                        <th>PRODUCTO / EVIDENCIA</th>
                        <th>INSTRUMENTOS</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-weight: 600;">{escape_html(session.proposito.competencia)}</td>
                        <td><ul class="session-list">{capacidades_html}</ul></td>
                        <td><ul class="session-list">{criterios_html}</ul></td>
                        <td>{escape_html(session.proposito.producto_evidencia)}</td>
                        <td>{escape_html(session.proposito.instrumento)}</td>
                    </tr>
                </tbody>
            </table>
            
            <!-- ════════ COMPETENCIAS TRANSVERSALES ════════ -->
            {"<table class='content-table'><thead><tr><th style='width: 35%'>COMPETENCIAS TRANSVERSALES</th><th>DESEMPEÑOS PRECISADOS / PRODUCTO / INSTRUMENTOS</th></tr></thead><tbody>" + ct_rows_html + "</tbody></table>" if ct_rows_html else ""}
            
            <!-- ════════ ENFOQUES TRANSVERSALES ════════ -->
            {"<table class='content-table'><thead><tr><th style='width: 30%'>ENFOQUES TRANSVERSALES</th><th style='width: 30%'>VALORES</th><th>ACTITUDES OBSERVABLES</th></tr></thead><tbody>" + enfoques_rows_html + "</tbody></table>" if enfoques_rows_html else ""}
            
            <!-- ════════ RECURSOS ════════ -->
            <table class="content-table" style="margin-top: 8px;">
                <tr>
                    <td class="label-cell" style="width: 200px;">Páginas de Texto, otros textos de consulta/Enlaces</td>
                    <td>{escape_html(session.recursos.enlaces)}</td>
                </tr>
                <tr>
                    <td class="label-cell">Materiales y recursos</td>
                    <td>{escape_html(session.recursos.materiales)}</td>
                </tr>
                <tr>
                    <td class="label-cell">Actividades de Refuerzo Escolar</td>
                    <td>{escape_html(session.recursos.refuerzo)}</td>
                </tr>
            </table>
            
            <!-- ════════ IV. SECUENCIA DIDÁCTICA ════════ -->
            <div class="section-title">IV. Secuencia Didáctica (Momentos)</div>
            
            <table class="content-table momentos-table" style="margin-top: 4px;">
                <thead>
                    <tr>
                        <th>MOMENTOS DE LA SESIÓN</th>
                        <th>ESTRATEGIAS / ACTIVIDADES</th>
                        <th>EVALUACIÓN</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Inicio -->
                    <tr>
                        <td class="momento-label-cell">
                            INICIO
                            <div class="momento-time">TIEMPO: {escape_html(session.momentos.inicio.tiempo_total)} min</div>
                        </td>
                        <td>
                            {inicio_actividades_html}
                        </td>
                        <td class="momento-eval-cell" rowspan="1">
                            EVALUACIÓN FORMATIVA
                        </td>
                    </tr>
                    
                    <!-- Desarrollo (Primer Proceso) -->
                    <tr>
                        <td class="momento-label-cell" rowspan="{cant_procesos}">
                            DESARROLLO
                            <div class="momento-time">TIEMPO: {escape_html(session.momentos.desarrollo.tiempo_total)} min</div>
                        </td>
                        <td>
                            {desarrollo_primero_html}
                        </td>
                        <td class="momento-eval-cell" rowspan="{cant_procesos}">
                            EVALUACIÓN FORMATIVA<br><br>
                            <span style="font-size: 7.5pt; font-weight: normal; color: #64748b;">(Monitoreo activo y retroalimentación)</span>
                        </td>
                    </tr>
                    
                    <!-- Desarrollo (Procesos Siguientes) -->
                    {desarrollo_siguientes_html}
                    
                    <!-- Cierre -->
                    <tr>
                        <td class="momento-label-cell">
                            CIERRE
                            <div class="momento-time">TIEMPO: {escape_html(session.momentos.cierre.tiempo_total)} min</div>
                        </td>
                        <td>
                            {cierre_estrategias_html}
                        </td>
                        <td class="momento-eval-cell">
                            EVALUACIÓN FORMATIVA
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <!-- ════════ FIRMAS ════════ -->
            <div class="firmas-container">
                <div class="firma-box">
                    <div class="firma-linea"></div>
                    <div class="firma-nombre">{escape_html(session.metadata.docente) or 'Docente de la Sesión'}</div>
                    <div class="firma-cargo">Docente de la Sesión</div>
                </div>
                <div class="firma-box">
                    <div class="firma-linea"></div>
                    <div class="firma-nombre">{escape_html(session.metadata.director) or 'Director(a) / Subdirector(a)'}</div>
                    <div class="firma-cargo">Director(a) / Subdirector(a)</div>
                </div>
            </div>
        </div>
        
        <!-- ════════ V. FICHA DE TRABAJO ════════ -->
        {ficha_html}
        
        <!-- ════════ VI. LISTA DE COTEJO ════════ -->
        {lista_cotejo_html}
    </body>
    </html>
    """
    return html_content


@app.post("/exportar-pdf-json")
async def exportar_pdf_json(payload: SesionAprendizajeRequest):
    """
    Genera un archivo PDF a partir del JSON estructurado de la sesión de aprendizaje.
    Intenta utilizar la conversión nativa de Word (docx2pdf) si está disponible en Windows,
    y si falla o no está disponible, cae de vuelta al renderizado con Playwright.
    """
    if payload.token != CONNECTION_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado: Token de conexión inválido.")

    try:
        titulo = payload.metadata.titulo or "Sesion_de_Aprendizaje"
        filename = re.sub(r'[^a-zA-Z0-9-_\s]', '', titulo).replace(' ', '_')
        nombre_archivo = f"{filename}.pdf"

        # 1. Intentar conversión nativa Word-to-PDF si estamos en Windows
        if sys.platform.startswith('win'):
            try:
                from docx2pdf import convert
                
                # Generamos primero el Word perfecto usando la función premium
                docx_stream = build_docx_from_json(payload)
                
                # Crear archivos temporales
                temp_docx = LOCAL_BIN_DIR / f"temp_{secrets.token_hex(4)}_{filename}.docx"
                temp_pdf = LOCAL_BIN_DIR / f"temp_{secrets.token_hex(4)}_{filename}.pdf"
                
                LOCAL_BIN_DIR.mkdir(exist_ok=True)
                with open(temp_docx, "wb") as f:
                    f.write(docx_stream.read())
                    
                if console:
                    console.print(f"[yellow]⚡ Intentando conversión nativa Word-to-PDF para {nombre_archivo}...[/yellow]")
                
                # Ejecutar la conversión de Word en un hilo separado
                await asyncio.to_thread(convert, str(temp_docx), str(temp_pdf))
                
                # Leer los bytes del PDF resultante
                with open(temp_pdf, "rb") as f:
                    pdf_bytes = f.read()
                    
                # Limpieza de archivos temporales
                try:
                    os.remove(temp_docx)
                    os.remove(temp_pdf)
                except Exception:
                    pass
                    
                if console:
                    console.print(f"[green]✓ [PDF PREMIUM CONVERTIDO] Generado vía Word con éxito: {nombre_archivo}[/green]")
                    
                return Response(
                    content=pdf_bytes,
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f"attachment; filename={nombre_archivo}",
                        "Access-Control-Expose-Headers": "Content-Disposition"
                    }
                )
            except Exception as word_err:
                if console:
                    console.print(f"[yellow]⚠️ Falló conversión vía Word: {str(word_err)}. Usando fallback de Chromium...[/yellow]")
                else:
                    print(f"[WARN WORD PDF] Falló conversión: {word_err}. Usando fallback...")

        # 2. Fallback: Renderizado HTML con Playwright (Chromium headless)
        documento_html = build_pdf_html_from_json(payload)

        async with async_playwright() as p:
            ruta_motor = buscar_navegador_compatible()
            launch_args = {"headless": True}
            if ruta_motor:
                launch_args["executable_path"] = ruta_motor
            browser = await p.chromium.launch(**launch_args)
            context = await browser.new_context()
            page = await context.new_page()
            
            await page.set_content(documento_html, wait_until="networkidle")
            
            # Esperar a que MathJax termine de procesar las fórmulas matemáticas (si está presente)
            try:
                await page.evaluate("() => window.MathJax && window.MathJax.startup && window.MathJax.startup.promise")
            except Exception as e:
                print("[WARN MATHJAX WAIT]", str(e))
            
            # Captura a PDF con Playwright aplicando prefer_css_page_size y márgenes en cero (el diseño ya tiene padding)
            pdf_bytes = await page.pdf(
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
                display_header_footer=False
            )
            await browser.close()

        if console:
            console.print(f"[green]✓ [PDF PREMIUM EXPORTADO] Generado vía Chromium con éxito: {nombre_archivo}[/green]")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={nombre_archivo}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        print("[ERROR PDF JSON]", str(e))
        raise HTTPException(status_code=500, detail=f"Fallo al compilar PDF Premium: {str(e)}")


# ────────────────────────────────────────────────────────────────────────
# UTILIDADES DE CONSTRUCCIÓN DE WORD (.docx) NATIVAS - MOVIDAS A DOCX_BUILDER.PY
# ────────────────────────────────────────────────────────────────────────

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


@app.post("/exportar-docx-json")
async def exportar_docx_json(payload: SesionAprendizajeRequest):
    """
    Exporta una sesión de aprendizaje completa desde JSON a un archivo Word (.docx) nativo premium.
    Requiere token de conexión.
    """
    if payload.token != CONNECTION_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado: Token de conexión inválido.")

    try:
        titulo = payload.metadata.titulo or "Sesion_de_Aprendizaje"
        filename = re.sub(r'[^a-zA-Z0-9-_\s]', '', titulo).replace(' ', '_')
        nombre_archivo = f"{filename}.docx"

        # Compilar archivo DOCX desde JSON nativo
        docx_stream = build_docx_from_json(payload)

        if console:
            console.print(f"[green]✓ [WORD PREMIUM EXPORTADO] Generado nativamente con éxito: {nombre_archivo}[/green]")

        return StreamingResponse(
            docx_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename={nombre_archivo}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        print("[ERROR DOCX JSON]", str(e))
        raise HTTPException(status_code=500, detail=f"Fallo al compilar archivo de Word (.docx) nativo: {str(e)}")


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
    print(f"🌐 [MOTOR ONLINE] Servidor de exportación corriendo en http://localhost:8000")
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
            
            # Limitar el historial de la terminal a las últimas 300 líneas para evitar fugas de memoria
            try:
                line_count = int(self.text_widget.index('end-1c').split('.')[0])
                if line_count > 300:
                    self.text_widget.delete('1.0', '100.0') # Borra las primeras 100 líneas antiguas
            except Exception:
                pass

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
    terminal.insert("end", "  [ MOTOR DE EXPORTACIÓN REFINADO  ]", "green")
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
            uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning", log_config=None)
        except Exception as e:
            print(f"\n❌ [ERROR CRÍTICO]: {str(e)}")

    threading.Thread(target=run_server_flow, daemon=True).start()
    
    # 6. Actualizar el estado visual cuando se conecte
    def check_connection():
        if CLIENT_CONNECTED:
            terminal.configure(state='normal')
            terminal.insert('end', "\n✓ [CONECTADO] El enlace de seguridad fue establecido con la web sesiones.sypablitodp.site.\n", "green")
            terminal.insert('end', "⚠️  [IMPORTANTE] Mantén esta ventana abierta en segundo plano. Si la cierras, se desconectará del navegador y no podra exportar sus sesiones a menso que abre otra ves el programa.\n\n", "yellow")
            terminal.configure(state='disabled')
            terminal.see('end')
        else:
            root.after(2000, check_connection)

    # 7. Forzar recolección de basura periódica de Python para evitar crecimiento de memoria
    import gc
    def force_gc():
        gc.collect()
        root.after(30000, force_gc)

    root.after(2000, check_connection)
    root.after(30000, force_gc)
    root.mainloop()

if __name__ == "__main__":
    start_gui()
