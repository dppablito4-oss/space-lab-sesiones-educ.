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
                display_header_footer=True,
                header_template=f"""
                    <div style="font-family: 'Arial', sans-serif; font-size: 8px; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm; color: #94a3b8; border-bottom: 1px solid #f1f5f9;">
                        <span>S.Y. PABLITO_DP &bull; Motor de Exportación</span>
                        <span>{payload.titulo}</span>
                    </div>
                """,
                footer_template="""
                    <div style="font-family: 'Arial', sans-serif; font-size: 8px; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm; color: #94a3b8; border-top: 1px solid #f1f5f9;">
                        <span>Sesión de Aprendizaje Oficial &bull; Space Lab</span>
                        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
                    </div>
                """
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

            .hoja-a4 {{
                width: 210mm;
                min-height: 269mm;
                padding: 0 12mm;
                box-sizing: border-box;
                background: #ffffff;
                position: relative;
                page-break-after: always;
                break-after: page;
            }}

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
    </body>
    </html>
    """
    return html_content


@app.post("/exportar-pdf-json")
async def exportar_pdf_json(payload: SesionAprendizajeRequest):
    """
    Genera un archivo PDF a partir del JSON estructurado de la sesión de aprendizaje,
    utilizando una plantilla HTML estática (Jinja2-like) y Playwright.
    """
    if payload.token != CONNECTION_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado: Token de conexión inválido.")

    try:
        titulo = payload.metadata.titulo or "Sesion_de_Aprendizaje"
        filename = re.sub(r'[^a-zA-Z0-9-_\s]', '', titulo).replace(' ', '_')
        nombre_archivo = f"{filename}.pdf"

        # Generar HTML completo
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
            
            # Captura a PDF con Playwright aplicando prefer_css_page_size y márgenes físicos para evitar traslapes
            pdf_bytes = await page.pdf(
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "1.4cm", "bottom": "1.4cm", "left": "0", "right": "0"},
                display_header_footer=True,
                header_template=f"""
                    <div style="font-family: 'Arial', sans-serif; font-size: 8px; width: 100%; display: flex; justify-content: space-between; padding: 0 1.2cm; color: #94a3b8; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">
                        <span>S.Y. PABLITO_DP &bull; Motor de Exportación Premium</span>
                        <span>{escape_html(titulo)}</span>
                    </div>
                """,
                footer_template="""
                    <div style="font-family: 'Arial', sans-serif; font-size: 8px; width: 100%; display: flex; justify-content: space-between; padding: 0 1.2cm; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px;">
                        <span>Sesión de Aprendizaje Oficial &bull; Space Lab</span>
                        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
                    </div>
                """
            )
            await browser.close()

        if console:
            console.print(f"[green]✓ [PDF PREMIUM EXPORTADO] Generado nativamente con éxito: {nombre_archivo}[/green]")

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

    # Limpiar elementos interactivos del editor que no pertenecen al documento
    for selector in ['no-print', 'add-logo-placeholder', 'btn-remove-logo']:
        for el in soup.find_all(class_=selector):
            el.decompose()

    processed_tags = set()

    def add_runs_to_paragraph(paragraph, element, is_bold=False, is_italic=False):
        for child in element.children:
            if isinstance(child, NavigableString):
                text = str(child)
                if text:
                    run = paragraph.add_run(text)
                    if is_bold:
                        run.bold = True
                    if is_italic:
                        run.italic = True
            elif isinstance(child, Tag):
                if child.name == 'br':
                    paragraph.add_run('\n')
                elif child.name in ['strong', 'b']:
                    add_runs_to_paragraph(paragraph, child, is_bold=True, is_italic=is_italic)
                elif child.name in ['em', 'i']:
                    add_runs_to_paragraph(paragraph, child, is_bold=is_bold, is_italic=True)
                elif child.name in ['span', 'a']:
                    add_runs_to_paragraph(paragraph, child, is_bold=is_bold, is_italic=is_italic)
                else:
                    add_runs_to_paragraph(paragraph, child, is_bold=is_bold, is_italic=is_italic)

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

            # TABLAS — con soporte de rowspan/colspan via merge grid
            elif element.name == 'table':
                html_rows = element.find_all('tr', recursive=True)
                if not html_rows:
                    processed_tags.add(element)
                    return

                # ── Paso 1: Calcular dimensiones reales de la grilla ──
                # Construir una grilla lógica 2D para mapear ocupación de celdas
                num_rows = len(html_rows)
                # Calcular max_cols considerando colspan
                max_cols = 0
                for r in html_rows:
                    total = 0
                    for c in r.find_all(['td', 'th'], recursive=False):
                        cs = int(c.get('colspan', 1) or 1)
                        total += cs
                    if total > max_cols:
                        max_cols = total

                if max_cols == 0:
                    processed_tags.add(element)
                    return

                # Grilla de ocupación: occupied[row][col] = True si ya está ocupada por un rowspan previo
                occupied = [[False] * max_cols for _ in range(num_rows)]

                # ── Paso 2: Crear tabla docx con dimensiones exactas ──
                docx_table = doc.add_table(rows=num_rows, cols=max_cols)
                docx_table.autofit = True
                add_table_borders(docx_table)

                # ── Paso 3: Recorrer filas HTML y mapear celdas con merge ──
                # Almacenar merges pendientes para ejecutar después de llenar contenido
                merges = []  # Lista de (start_row, start_col, end_row, end_col)

                for row_idx, html_row in enumerate(html_rows):
                    html_cells = html_row.find_all(['td', 'th'], recursive=False)
                    col_cursor = 0  # Posición lógica actual en la grilla

                    for html_cell in html_cells:
                        # Avanzar cursor saltando celdas ya ocupadas por rowspan de filas anteriores
                        while col_cursor < max_cols and occupied[row_idx][col_cursor]:
                            col_cursor += 1

                        if col_cursor >= max_cols:
                            break

                        rs = int(html_cell.get('rowspan', 1) or 1)
                        cs = int(html_cell.get('colspan', 1) or 1)

                        # Marcar celdas ocupadas en la grilla
                        for dr in range(rs):
                            for dc in range(cs):
                                target_r = row_idx + dr
                                target_c = col_cursor + dc
                                if target_r < num_rows and target_c < max_cols:
                                    occupied[target_r][target_c] = True

                        # Registrar merge si abarca más de una celda
                        if rs > 1 or cs > 1:
                            end_row = min(row_idx + rs - 1, num_rows - 1)
                            end_col = min(col_cursor + cs - 1, max_cols - 1)
                            merges.append((row_idx, col_cursor, end_row, end_col))

                        # Llenar contenido en la celda de la esquina superior izquierda
                        cell = docx_table.rows[row_idx].cells[col_cursor]
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

                        col_cursor += cs

                # ── Paso 4: Ejecutar merges de celdas ──
                for start_r, start_c, end_r, end_c in merges:
                    try:
                        cell_a = docx_table.rows[start_r].cells[start_c]
                        cell_b = docx_table.rows[end_r].cells[end_c]
                        cell_a.merge(cell_b)
                    except Exception:
                        pass  # Merge inválido — ignorar silenciosamente

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


def get_image_stream(url: str):
    """Intenta descargar la imagen desde la URL y devuelve un BytesIO. Retorna None si falla o es vacía."""
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return None
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=3) as response:
            return io.BytesIO(response.read())
    except Exception as e:
        print(f"[WARN LOGO] No se pudo descargar el logo {url}: {e}")
        return None


def format_latex_to_unicode(text: str) -> str:
    """
    Traduce expresiones comunes de LaTeX a caracteres Unicode matemáticos para legibilidad en Word.
    """
    if not text:
        return ""
    
    # Tabla de equivalencias directas de LaTeX a Unicode
    replacements = {
        r'\pm': '±',
        r'\le': '≤',
        r'\ge': '≥',
        r'\neq': '≠',
        r'\times': '×',
        r'\div': '÷',
        r'\approx': '≈',
        r'\alpha': 'α',
        r'\beta': 'β',
        r'\gamma': 'γ',
        r'\theta': 'θ',
        r'\pi': 'π',
        r'\infty': '∞',
        r'\Delta': 'Δ',
        r'\Sigma': 'Σ',
        r'\rightarrow': '→',
        r'\leftarrow': '←',
        r'\leftrightarrow': '↔',
        r'\Rightarrow': '⇒',
        r'\Leftarrow': '⇐',
        r'\partial': '∂',
        r'\sqrt': '√',
        r'\cdot': '·',
        r'\text{o}': ' o ',
        r'\;': ' ',
        r'\:': ' ',
        r'\,': ' ',
        r'\!': '',
    }
    
    # Remover delimitadores de dólar
    cleaned = text
    cleaned = re.sub(r'\$\$(.*?)\$\$', r'\1', cleaned)
    cleaned = re.sub(r'\$(.*?)\$', r'\1', cleaned)
    
    # Aplicar equivalencias de comandos
    for key, val in replacements.items():
        cleaned = cleaned.replace(key, val)
        
    # Reemplazos de potencias comunes a superíndices unicode
    supers = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', 
              '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ', 'i': 'ⁱ'}
    
    def replace_super(match):
        val = match.group(1)
        return "".join(supers.get(c, c) for c in val)
        
    cleaned = re.sub(r'\^\{?([0-9+\-xyn]+)\}?', replace_super, cleaned)
    
    # Reemplazos de subíndices comunes a unicode
    subs = {'0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 
            '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', 'n': 'ₙ', 'x': 'ₓ', 'y': 'ᵧ', 'i': 'ᵢ'}
            
    def replace_sub(match):
        val = match.group(1)
        return "".join(subs.get(c, c) for c in val)
        
    cleaned = re.sub(r'\_\{?([0-9+\-xyni]+)\}?', replace_sub, cleaned)
    
    return cleaned


def preprocess_session_latex(session):
    """
    Recorre el modelo de la sesión y traduce todas las expresiones LaTeX de sus textos
    a caracteres Unicode matemáticos listos para la exportación a Word.
    """
    if not session:
        return
        
    # Metadatos
    if session.metadata:
        session.metadata.titulo = format_latex_to_unicode(session.metadata.titulo)
        session.metadata.institucion = format_latex_to_unicode(session.metadata.institucion)
        session.metadata.docente = format_latex_to_unicode(session.metadata.docente)
        session.metadata.area = format_latex_to_unicode(session.metadata.area)
        session.metadata.unidad = format_latex_to_unicode(session.metadata.unidad)
        
    # Propósitos
    if session.proposito:
        session.proposito.proposito_texto = format_latex_to_unicode(session.proposito.proposito_texto)
        session.proposito.conocimientos = format_latex_to_unicode(session.proposito.conocimientos)
        session.proposito.competencia = format_latex_to_unicode(session.proposito.competencia)
        session.proposito.estandar = format_latex_to_unicode(session.proposito.estandar)
        session.proposito.producto_evidencia = format_latex_to_unicode(session.proposito.producto_evidencia)
        session.proposito.instrumento = format_latex_to_unicode(session.proposito.instrumento)
        
        if session.proposito.capacidades:
            session.proposito.capacidades = [format_latex_to_unicode(c) for c in session.proposito.capacidades]
        if session.proposito.criterios:
            session.proposito.criterios = [format_latex_to_unicode(cr) for cr in session.proposito.criterios]

    # Competencias transversales
    if session.competencias_transversales:
        for ct in session.competencias_transversales:
            ct.titulo = format_latex_to_unicode(ct.titulo)
            if ct.desempenos:
                ct.desempenos = [format_latex_to_unicode(d) for d in ct.desempenos]

    # Enfoques transversales
    if session.enfoques_transversales:
        for et in session.enfoques_transversales:
            et.nombre = format_latex_to_unicode(et.nombre)
            et.valor = format_latex_to_unicode(et.valor)
            et.actitudes = format_latex_to_unicode(et.actitudes)

    # Recursos
    if session.recursos:
        session.recursos.enlaces = format_latex_to_unicode(session.recursos.enlaces)
        session.recursos.materiales = format_latex_to_unicode(session.recursos.materiales)
        session.recursos.refuerzo = format_latex_to_unicode(session.recursos.refuerzo)

    # Momentos
    if getattr(session, 'momentos', None):
        momentos = session.momentos
        # Inicio
        if getattr(momentos, 'inicio', None) and getattr(momentos.inicio, 'actividades', None):
            momentos.inicio.actividades = [format_latex_to_unicode(a) for a in momentos.inicio.actividades]
        # Desarrollo
        if getattr(momentos, 'desarrollo', None) and getattr(momentos.desarrollo, 'procesos', None):
            for proc in momentos.desarrollo.procesos:
                if getattr(proc, 'titulo', None):
                    proc.titulo = format_latex_to_unicode(proc.titulo)
                if getattr(proc, 'contenido', None):
                    proc.contenido = [format_latex_to_unicode(c) for c in proc.contenido]
        # Cierre
        if getattr(momentos, 'cierre', None):
            cierre = momentos.cierre
            if getattr(cierre, 'metacognicion', None):
                cierre.metacognicion = [format_latex_to_unicode(m) for m in cierre.metacognicion]
            if getattr(cierre, 'evaluacion', None):
                cierre.evaluacion = [format_latex_to_unicode(ev) for ev in cierre.evaluacion]
            if getattr(cierre, 'extension', None):
                cierre.extension = [format_latex_to_unicode(ex) for ex in cierre.extension]

    # Ficha de trabajo
    if getattr(session, 'ficha_trabajo', None):
        ficha = session.ficha_trabajo
        if getattr(ficha, 'titulo', None):
            ficha.titulo = format_latex_to_unicode(ficha.titulo)
        if getattr(ficha, 'indicaciones', None):
            ficha.indicaciones = format_latex_to_unicode(ficha.indicaciones)
        if getattr(ficha, 'actividades', None):
            ficha.actividades = format_latex_to_unicode(ficha.actividades)

    # Firmas (si existieran dinámicamente)
    if getattr(session, 'firmas', None):
        for f in session.firmas:
            if getattr(f, 'nombre', None):
                f.nombre = format_latex_to_unicode(f.nombre)
            if getattr(f, 'cargo', None):
                f.cargo = format_latex_to_unicode(f.cargo)


def build_docx_from_json(session: SesionAprendizajeRequest) -> io.BytesIO:
    # Preprocesar LaTeX a Unicode para asegurar compatibilidad matemática y estética en Word
    preprocess_session_latex(session)
    
    doc = Document()
    
    # Configuración de márgenes estándar (1.1 pulgadas arriba para membrete institucional, 0.8 en los lados)
    for s in doc.sections:
        s.top_margin = Inches(1.1)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)

    # Estilo Normal
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Arial'
    style_normal.font.size = Pt(10)
    style_normal.font.color.rgb = RGBColor(30, 41, 59) # Slate-800

    # ─── CABECERA INSTITUCIONAL EN EL HEADER NATIVO DE WORD ───
    section = doc.sections[0]
    header = section.header
    
    # Tabla sin bordes de 3 columnas para logos y textos oficiales
    header_table = header.add_table(rows=1, cols=3, width=Inches(6.9))
    header_table.autofit = False
    header_table.allow_autofit = False
    
    # Quitar bordes y fijar anchos a la tabla de cabecera
    anchos_header = [Inches(1.2), Inches(4.5), Inches(1.2)]
    for row in header_table.rows:
        for col_idx, cell in enumerate(row.cells):
            cell.width = anchos_header[col_idx]
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = OxmlElement('w:tcBorders')
            for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
                border = OxmlElement(f'w:{edge}')
                border.set(qn('w:val'), 'nil')
                tcBorders.append(border)
            tcPr.append(tcBorders)

    # Llenar columna 1: Logo Izquierdo
    logo_left_stream = get_image_stream(session.metadata.logo_left_url)
    if logo_left_stream:
        try:
            p_logo = header_table.cell(0, 0).paragraphs[0]
            p_logo.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p_logo.add_run().add_picture(logo_left_stream, width=Inches(0.8))
        except Exception:
            pass

    # Llenar columna 2: Textos Oficiales
    p_text = header_table.cell(0, 1).paragraphs[0]
    p_text.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    run_minedu = p_text.add_run("MINISTERIO DE EDUCACIÓN\n")
    run_minedu.bold = True
    run_minedu.font.size = Pt(8.5)
    
    run_dre = p_text.add_run(f"{session.metadata.dre or 'DIRECCIÓN REGIONAL DE EDUCACIÓN'}\n")
    run_dre.bold = True
    run_dre.font.size = Pt(9)
    
    run_ugel = p_text.add_run(f"{session.metadata.ugel or 'UNIDAD DE GESTIÓN EDUCATIVA LOCAL'}\n")
    run_ugel.bold = True
    run_ugel.font.size = Pt(9)
    
    run_agp = p_text.add_run("ÁREA DE GESTIÓN PEDAGÓGICA")
    run_agp.italic = True
    run_agp.font.size = Pt(8)

    # Llenar columna 3: Logo Derecho (Regional)
    logo_right_stream = get_image_stream(session.metadata.logo_regional_url)
    if logo_right_stream:
        try:
            p_logo_r = header_table.cell(0, 2).paragraphs[0]
            p_logo_r.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_logo_r.add_run().add_picture(logo_right_stream, width=Inches(0.8))
        except Exception:
            pass

    # Línea divisoria debajo de la cabecera en el párrafo base del header
    p_divider = header.paragraphs[0]
    p_divider.paragraph_format.space_before = Pt(4)
    p_divider.paragraph_format.space_after = Pt(0)
    p_divider_border = OxmlElement('w:pBdr')
    bottom_border = OxmlElement('w:bottom')
    bottom_border.set(qn('w:val'), 'single')
    bottom_border.set(qn('w:sz'), '12') # 1.5 pt
    bottom_border.set(qn('w:space'), '1')
    bottom_border.set(qn('w:color'), '000000')
    p_divider_border.append(bottom_border)
    p_divider._p.get_or_add_pPr().append(p_divider_border)

    # ─── TÍTULO PRINCIPAL ───
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(12)
    run_title = p_title.add_run(f"SESIÓN DE APRENDIZAJE N° {session.metadata.numero_sesion or '01'}")
    run_title.bold = True
    run_title.font.size = Pt(13)
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    # Título de la sesión
    p_sub_title = doc.add_paragraph()
    p_sub_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub_title.paragraph_format.space_after = Pt(14)
    run_sub = p_sub_title.add_run(f"\"{session.metadata.titulo or 'Título de la Sesión'}\"")
    run_sub.bold = True
    run_sub.italic = True
    run_sub.font.size = Pt(11)

    # ─── DATOS GENERALES (Tabla estructurada) ───
    dg_table = doc.add_table(rows=4, cols=6)
    dg_table.autofit = True
    add_table_borders(dg_table)
    
    # Rellenar fila 1
    dg_table.cell(0, 0).text = "Institución Educativa"
    set_cell_background(dg_table.cell(0, 0), "F1F5F9")
    dg_table.cell(0, 0).paragraphs[0].runs[0].bold = True
    dg_table.cell(0, 1).text = session.metadata.institucion or ""
    dg_table.cell(0, 1).merge(dg_table.cell(0, 3)) # Combina columnas 1 a 3 para el nombre de I.E.
    
    dg_table.cell(0, 4).text = "Nivel"
    set_cell_background(dg_table.cell(0, 4), "F1F5F9")
    dg_table.cell(0, 4).paragraphs[0].runs[0].bold = True
    dg_table.cell(0, 5).text = session.metadata.nivel or ""

    # Rellenar fila 2
    dg_table.cell(1, 0).text = "Docente"
    set_cell_background(dg_table.cell(1, 0), "F1F5F9")
    dg_table.cell(1, 0).paragraphs[0].runs[0].bold = True
    dg_table.cell(1, 1).text = session.metadata.docente or ""
    dg_table.cell(1, 1).merge(dg_table.cell(1, 3))
    
    dg_table.cell(1, 4).text = "Área"
    set_cell_background(dg_table.cell(1, 4), "F1F5F9")
    dg_table.cell(1, 4).paragraphs[0].runs[0].bold = True
    dg_table.cell(1, 5).text = session.metadata.area or ""

    # Rellenar fila 3
    dg_table.cell(2, 0).text = "Grado"
    set_cell_background(dg_table.cell(2, 0), "F1F5F9")
    dg_table.cell(2, 0).paragraphs[0].runs[0].bold = True
    dg_table.cell(2, 1).text = session.metadata.grado or ""
    
    dg_table.cell(2, 2).text = "Sección"
    set_cell_background(dg_table.cell(2, 2), "F1F5F9")
    dg_table.cell(2, 2).paragraphs[0].runs[0].bold = True
    dg_table.cell(2, 3).text = session.metadata.seccion or ""
    
    dg_table.cell(2, 4).text = "Unidad / Proyecto"
    set_cell_background(dg_table.cell(2, 4), "F1F5F9")
    dg_table.cell(2, 4).paragraphs[0].runs[0].bold = True
    dg_table.cell(2, 5).text = session.metadata.unidad or ""

    # Rellenar fila 4
    dg_table.cell(3, 0).text = "Fecha"
    set_cell_background(dg_table.cell(3, 0), "F1F5F9")
    dg_table.cell(3, 0).paragraphs[0].runs[0].bold = True
    dg_table.cell(3, 1).text = session.metadata.fecha or ""
    dg_table.cell(3, 1).merge(dg_table.cell(3, 3))
    
    dg_table.cell(3, 4).text = "Duración"
    set_cell_background(dg_table.cell(3, 4), "F1F5F9")
    dg_table.cell(3, 4).paragraphs[0].runs[0].bold = True
    dg_table.cell(3, 5).text = f"{session.metadata.duracion or ''} min" if session.metadata.duracion else ""

    # Estilos a las celdas de la tabla de datos
    for row in dg_table.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            cell.paragraphs[0].paragraph_format.line_spacing = 1.15
            cell.paragraphs[0].paragraph_format.space_after = Pt(2)

    # ─── PROPÓSITO DE LA SESIÓN ───
    doc.add_paragraph().paragraph_format.space_before = Pt(12)
    h_prop = doc.add_paragraph()
    h_prop.paragraph_format.keep_with_next = True
    run_h_prop = h_prop.add_run("I. PROPÓSITO DE LA SESIÓN")
    run_h_prop.bold = True
    run_h_prop.font.size = Pt(11)
    
    p_prop = doc.add_paragraph()
    p_prop.paragraph_format.left_indent = Inches(0.2)
    p_prop.add_run(session.proposito.proposito_texto or "")

    # ─── CONOCIMIENTOS ───
    h_cono = doc.add_paragraph()
    h_cono.paragraph_format.keep_with_next = True
    run_h_cono = h_cono.add_run("II. CONOCIMIENTOS")
    run_h_cono.bold = True
    run_h_cono.font.size = Pt(11)
    
    p_cono = doc.add_paragraph()
    p_cono.paragraph_format.left_indent = Inches(0.2)
    p_cono.add_run(session.proposito.conocimientos or "")

    # ─── PROPÓSITOS DE APRENDIZAJE ───
    doc.add_paragraph().paragraph_format.space_before = Pt(10)
    h_apren = doc.add_paragraph()
    h_apren.paragraph_format.keep_with_next = True
    run_h_apren = h_apren.add_run("III. PROPÓSITOS DE APRENDIZAJE")
    run_h_apren.bold = True
    run_h_apren.font.size = Pt(11)

    # Subtabla Competencia / Estándar
    comp_est_table = doc.add_table(rows=2, cols=2)
    comp_est_table.autofit = True
    add_table_borders(comp_est_table)
    
    comp_est_table.cell(0, 0).text = "Competencia"
    set_cell_background(comp_est_table.cell(0, 0), "F1F5F9")
    comp_est_table.cell(0, 0).paragraphs[0].runs[0].bold = True
    comp_est_table.cell(0, 0).width = Inches(1.8)
    comp_est_table.cell(0, 1).text = session.proposito.competencia or ""
    comp_est_table.cell(0, 1).paragraphs[0].runs[0].bold = True

    comp_est_table.cell(1, 0).text = "Estándar de aprendizaje"
    set_cell_background(comp_est_table.cell(1, 0), "F1F5F9")
    comp_est_table.cell(1, 0).paragraphs[0].runs[0].bold = True
    comp_est_table.cell(1, 1).text = session.proposito.estandar or ""
    
    for row in comp_est_table.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            cell.paragraphs[0].paragraph_format.line_spacing = 1.15

    # Tabla Matriz de Propósitos (Competencias, Capacidades, Criterios, Evidencia, Instrumento)
    doc.add_paragraph().paragraph_format.space_before = Pt(6)
    matriz_table = doc.add_table(rows=2, cols=5)
    matriz_table.autofit = False
    matriz_table.allow_autofit = False
    add_table_borders(matriz_table)
    
    # Encabezados
    headers = ["COMPETENCIAS", "CAPACIDADES", "CRITERIOS DE EVALUACIÓN", "PRODUCTO / EVIDENCIA", "INSTRUMENTOS DE EVALUACIÓN"]
    for idx, text in enumerate(headers):
        cell = matriz_table.cell(0, idx)
        cell.text = text
        set_cell_background(cell, "E2E8F0")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.runs[0].bold = True
        p.runs[0].font.size = Pt(8.5)

    # Rellenar datos
    matriz_table.cell(1, 0).text = session.proposito.competencia or ""
    matriz_table.cell(1, 0).paragraphs[0].runs[0].bold = True
    
    # Capacidades (lista)
    cell_cap = matriz_table.cell(1, 1)
    cell_cap.text = ""
    for cap in session.proposito.capacidades:
        p = cell_cap.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(2)
        p.add_run(cap)
        
    # Criterios (lista)
    cell_crit = matriz_table.cell(1, 2)
    cell_crit.text = ""
    for crit in session.proposito.criterios:
        p = cell_crit.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(2)
        p.add_run(crit)
        
    matriz_table.cell(1, 3).text = session.proposito.producto_evidencia or ""
    matriz_table.cell(1, 4).text = session.proposito.instrumento or ""

    # Fijar anchos de celda (Suma: 6.9 pulgadas) e incrementar padding (120 dxa = 6pt, 140 dxa = 7pt)
    anchos_matriz = [Inches(1.4), Inches(1.4), Inches(1.6), Inches(1.3), Inches(1.2)]
    for row_idx, row in enumerate(matriz_table.rows):
        for col_idx, cell in enumerate(row.cells):
            cell.width = anchos_matriz[col_idx]
            set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
            for p in cell.paragraphs:
                p.paragraph_format.line_spacing = 1.15
                if row_idx > 0:
                    p.paragraph_format.space_after = Pt(4)

    # ─── COMPETENCIAS TRANSVERSALES ───
    if session.competencias_transversales:
        doc.add_paragraph().paragraph_format.space_before = Pt(10)
        ct_table = doc.add_table(rows=1 + len(session.competencias_transversales), cols=2)
        ct_table.autofit = False
        ct_table.allow_autofit = False
        add_table_borders(ct_table)
        
        # Headers
        ct_table.cell(0, 0).text = "COMPETENCIAS TRANSVERSALES"
        set_cell_background(ct_table.cell(0, 0), "E2E8F0")
        ct_table.cell(0, 0).paragraphs[0].runs[0].bold = True
        
        ct_table.cell(0, 1).text = "DESEMPEÑOS PRECISADOS / PRODUCTO / INSTRUMENTOS"
        set_cell_background(ct_table.cell(0, 1), "E2E8F0")
        ct_table.cell(0, 1).paragraphs[0].runs[0].bold = True
        
        for idx, ct in enumerate(session.competencias_transversales):
            cell_titulo = ct_table.cell(idx + 1, 0)
            cell_titulo.text = ct.titulo
            cell_titulo.paragraphs[0].runs[0].bold = True
            
            cell_des = ct_table.cell(idx + 1, 1)
            cell_des.text = ""
            for des in ct.desempenos:
                p = cell_des.add_paragraph(style='List Bullet')
                p.paragraph_format.space_after = Pt(2)
                p.add_run(des)

        # Fijar anchos de celda (Suma: 6.9 pulgadas) e incrementar padding
        anchos_ct = [Inches(2.5), Inches(4.4)]
        for row in ct_table.rows:
            for col_idx, cell in enumerate(row.cells):
                cell.width = anchos_ct[col_idx]
                set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
                for p in cell.paragraphs:
                    p.paragraph_format.line_spacing = 1.15

    # ─── ENFOQUES TRANSVERSALES ───
    if session.enfoques_transversales:
        doc.add_paragraph().paragraph_format.space_before = Pt(10)
        enf_table = doc.add_table(rows=1 + len(session.enfoques_transversales), cols=3)
        enf_table.autofit = False
        enf_table.allow_autofit = False
        add_table_borders(enf_table)
        
        headers_enf = ["ENFOQUES TRANSVERSALES", "VALORES", "ACTITUDES O ACCIONES OBSERVABLES"]
        for idx, text in enumerate(headers_enf):
            cell = enf_table.cell(0, idx)
            cell.text = text
            set_cell_background(cell, "E2E8F0")
            cell.paragraphs[0].runs[0].bold = True
            
        for idx, enf in enumerate(session.enfoques_transversales):
            enf_table.cell(idx + 1, 0).text = enf.nombre
            enf_table.cell(idx + 1, 0).paragraphs[0].runs[0].bold = True
            enf_table.cell(idx + 1, 1).text = enf.valor
            enf_table.cell(idx + 1, 2).text = enf.actitudes

        # Fijar anchos de celda (Suma: 6.9 pulgadas) e incrementar padding
        anchos_enf = [Inches(2.0), Inches(1.8), Inches(3.1)]
        for row in enf_table.rows:
            for col_idx, cell in enumerate(row.cells):
                cell.width = anchos_enf[col_idx]
                set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
                for p in cell.paragraphs:
                    p.paragraph_format.line_spacing = 1.15

    # ─── RECURSOS Y MATERIALES ───
    doc.add_paragraph().paragraph_format.space_before = Pt(10)
    rec_table = doc.add_table(rows=3, cols=2)
    rec_table.autofit = True
    add_table_borders(rec_table)
    
    labels_rec = [
        ("Páginas de Texto, otros textos de consulta/Enlace web, etc.", session.recursos.enlaces),
        ("Materiales y recursos", session.recursos.materiales),
        ("Actividades de Refuerzo Escolar (N° ficha y Título)", session.recursos.refuerzo)
    ]
    for idx, (label, val) in enumerate(labels_rec):
        rec_table.cell(idx, 0).text = label
        set_cell_background(rec_table.cell(idx, 0), "F1F5F9")
        rec_table.cell(idx, 0).paragraphs[0].runs[0].bold = True
        rec_table.cell(idx, 0).width = Inches(3.0)
        rec_table.cell(idx, 1).text = val or ""

    for row in rec_table.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            cell.paragraphs[0].paragraph_format.line_spacing = 1.15

    # ─── MOMENTOS DE LA SESIÓN ───
    doc.add_paragraph().paragraph_format.space_before = Pt(12)
    h_mom = doc.add_paragraph()
    h_mom.paragraph_format.keep_with_next = True
    run_h_mom = h_mom.add_run("IV. SECUENCIA DIDÁCTICA (MOMENTOS)")
    run_h_mom.bold = True
    run_h_mom.font.size = Pt(11)

    procesos_des = session.momentos.desarrollo.procesos
    cant_procesos = len(procesos_des) if procesos_des else 1
    total_filas = 1 + 1 + cant_procesos + 1
    
    mom_table = doc.add_table(rows=total_filas, cols=3)
    mom_table.autofit = False
    mom_table.allow_autofit = False
    add_table_borders(mom_table)
    
    # Headers
    headers_mom = ["MOMENTOS DE LA SESIÓN", "ESTRATEGIAS / ACTIVIDADES", "EVALUACIÓN"]
    for idx, text in enumerate(headers_mom):
        cell = mom_table.cell(0, idx)
        cell.text = text
        set_cell_background(cell, "E2E8F0")
        cell.paragraphs[0].runs[0].bold = True

    # ── Fila de Inicio (Fila 1) ──
    cell_mom_inicio = mom_table.cell(1, 0)
    set_cell_background(cell_mom_inicio, "F8FAFC")
    p_mom_ini = cell_mom_inicio.paragraphs[0]
    run_mom_ini = p_mom_ini.add_run("INICIO:\n")
    run_mom_ini.bold = True
    run_mom_ini.font.size = Pt(9.5)
    
    p_sub_ini = cell_mom_inicio.add_paragraph()
    p_sub_ini.paragraph_format.space_before = Pt(4)
    p_sub_ini.add_run("• Saberes Previos\n• Problematización\n• Motivación").font.size = Pt(8)
    
    p_time_ini = cell_mom_inicio.add_paragraph()
    p_time_ini.paragraph_format.space_before = Pt(6)
    run_time_ini = p_time_ini.add_run(f"TIEMPO: {session.momentos.inicio.tiempo_total or ''} min" if session.momentos.inicio.tiempo_total else "")
    run_time_ini.bold = True
    run_time_ini.font.size = Pt(8.5)

    # Estrategias de Inicio
    cell_est_inicio = mom_table.cell(1, 1)
    cell_est_inicio.text = ""
    for act in session.momentos.inicio.actividades:
        p = cell_est_inicio.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.add_run(act)

    # Evaluación de Inicio
    cell_eval_inicio = mom_table.cell(1, 2)
    cell_eval_inicio.text = "EVALUACIÓN FORMATIVA"
    cell_eval_inicio.paragraphs[0].runs[0].font.size = Pt(8.5)
    cell_eval_inicio.paragraphs[0].runs[0].bold = True
    set_cell_background(cell_eval_inicio, "F8FAFC")

    # ── Filas de Desarrollo (Fila 2 a 2 + cant_procesos - 1) ──
    start_row_des = 2
    cell_mom_des = mom_table.cell(start_row_des, 0)
    set_cell_background(cell_mom_des, "F8FAFC")
    p_mom_des = cell_mom_des.paragraphs[0]
    run_mom_des = p_mom_des.add_run("DESARROLLO:\n")
    run_mom_des.bold = True
    run_mom_des.font.size = Pt(9.5)
    
    p_sub_des = cell_mom_des.add_paragraph()
    p_sub_des.paragraph_format.space_before = Pt(4)
    p_sub_des.add_run("Gestión y Acompañamiento del Desarrollo de las Competencias (Procesos didácticos del Área)").font.size = Pt(8)
    
    p_time_des = cell_mom_des.add_paragraph()
    p_time_des.paragraph_format.space_before = Pt(6)
    run_time_des = p_time_des.add_run(f"TIEMPO: {session.momentos.desarrollo.tiempo_total or ''} min" if session.momentos.desarrollo.tiempo_total else "")
    run_time_des.bold = True
    run_time_des.font.size = Pt(8.5)

    # Evaluación de Desarrollo
    cell_eval_des = mom_table.cell(start_row_des, 2)
    cell_eval_des.text = "EVALUACIÓN FORMATIVA\n\n(Monitoreo activo y retroalimentación)"
    cell_eval_des.paragraphs[0].runs[0].font.size = Pt(8.5)
    cell_eval_des.paragraphs[0].runs[0].bold = True
    set_cell_background(cell_eval_des, "F8FAFC")

    # Escribir procesos
    for idx in range(cant_procesos):
        row_num = start_row_des + idx
        cell_est_des = mom_table.cell(row_num, 1)
        cell_est_des.text = ""
        
        if procesos_des:
            proc = procesos_des[idx]
            p_title = cell_est_des.add_paragraph()
            p_title.paragraph_format.space_after = Pt(4)
            run_proc_t = p_title.add_run(f"{proc.titulo.upper()}")
            run_proc_t.bold = True
            run_proc_t.font.color.rgb = RGBColor(192, 57, 43) # C0392B
            run_proc_t.font.size = Pt(9)
            
            for parrafo in proc.contenido:
                p = cell_est_des.add_paragraph()
                p.paragraph_format.space_after = Pt(4)
                p.add_run(parrafo)
        else:
            cell_est_des.text = "Gestión y Acompañamiento del Desarrollo de Competencias..."

    # Fusión de columnas de momentos y evaluación
    if cant_procesos > 1:
        end_row_des = start_row_des + cant_procesos - 1
        cell_mom_des.merge(mom_table.cell(end_row_des, 0))
        cell_eval_des.merge(mom_table.cell(end_row_des, 2))

    # ── Fila de Cierre ──
    row_cierre_idx = total_filas - 1
    cell_mom_cie = mom_table.cell(row_cierre_idx, 0)
    set_cell_background(cell_mom_cie, "F8FAFC")
    p_mom_cie = cell_mom_cie.paragraphs[0]
    run_mom_cie = p_mom_cie.add_run("CIERRE:\n")
    run_mom_cie.bold = True
    run_mom_cie.font.size = Pt(9.5)
    
    p_sub_cie = cell_mom_cie.add_paragraph()
    p_sub_cie.paragraph_format.space_before = Pt(4)
    p_sub_cie.add_run("• Metacognición\n• Evaluación formativa\n• Actividades de extensión").font.size = Pt(8)
    
    p_time_cie = cell_mom_cie.add_paragraph()
    p_time_cie.paragraph_format.space_before = Pt(6)
    run_time_cie = p_time_cie.add_run(f"TIEMPO: {session.momentos.cierre.tiempo_total or ''} min" if session.momentos.cierre.tiempo_total else "")
    run_time_cie.bold = True
    run_time_cie.font.size = Pt(8.5)

    # Estrategias de Cierre
    cell_est_cierre = mom_table.cell(row_cierre_idx, 1)
    cell_est_cierre.text = ""
    
    if session.momentos.cierre.metacognicion:
        p = cell_est_cierre.add_paragraph()
        run = p.add_run("Metacognición:")
        run.bold = True
        for met in session.momentos.cierre.metacognicion:
            p_item = cell_est_cierre.add_paragraph(style='List Bullet')
            p_item.paragraph_format.space_after = Pt(2)
            p_item.add_run(met)
            
    if session.momentos.cierre.evaluacion:
        p = cell_est_cierre.add_paragraph()
        p.paragraph_format.space_before = Pt(4)
        run = p.add_run("Evaluación formativa:")
        run.bold = True
        for ev in session.momentos.cierre.evaluacion:
            p_item = cell_est_cierre.add_paragraph(style='List Bullet')
            p_item.paragraph_format.space_after = Pt(2)
            p_item.add_run(ev)
            
    if session.momentos.cierre.extension:
        p = cell_est_cierre.add_paragraph()
        p.paragraph_format.space_before = Pt(4)
        run = p.add_run("Extensión para casa:")
        run.bold = True
        for ext in session.momentos.cierre.extension:
            p_item = cell_est_cierre.add_paragraph(style='List Bullet')
            p_item.paragraph_format.space_after = Pt(2)
            p_item.add_run(ext)

    # Evaluación de Cierre
    cell_eval_cie = mom_table.cell(row_cierre_idx, 2)
    cell_eval_cie.text = "EVALUACIÓN FORMATIVA"
    cell_eval_cie.paragraphs[0].runs[0].font.size = Pt(8.5)
    cell_eval_cie.paragraphs[0].runs[0].bold = True
    set_cell_background(cell_eval_cie, "F8FAFC")

    anchos_mom = [Inches(1.2), Inches(4.5), Inches(1.2)]
    for row in mom_table.rows:
        for col_idx, cell in enumerate(row.cells):
            cell.width = anchos_mom[col_idx]
            set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
            for p in cell.paragraphs:
                p.paragraph_format.line_spacing = 1.15

    # ─── FIRMAS DE LA SESIÓN ───
    doc.add_paragraph().paragraph_format.space_before = Pt(40)
    firmas_table = doc.add_table(rows=1, cols=2)
    firmas_table.autofit = True
    
    # Quitar bordes a la tabla de firmas
    for cell in firmas_table.rows[0].cells:
        tcPr = cell._tc.get_or_add_tcPr()
        tcBorders = OxmlElement('w:tcBorders')
        for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
            border = OxmlElement(f'w:{edge}')
            border.set(qn('w:val'), 'nil')
            tcBorders.append(border)
        tcPr.append(tcBorders)

    # Firma Docente
    p_f_doc = firmas_table.cell(0, 0).paragraphs[0]
    p_f_doc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_f_doc.add_run("_______________________________\n").bold = True
    run_n_doc = p_f_doc.add_run((session.metadata.docente or "Docente de la Sesión") + "\n")
    run_n_doc.bold = True
    run_n_doc.font.size = Pt(9.5)
    run_c_doc = p_f_doc.add_run("Docente de la Sesión")
    run_c_doc.font.size = Pt(8.5)
    run_c_doc.font.color.rgb = RGBColor(100, 116, 139)

    # Firma Director
    p_f_dir = firmas_table.cell(0, 1).paragraphs[0]
    p_f_dir.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_f_dir.add_run("_______________________________\n").bold = True
    run_n_dir = p_f_dir.add_run((session.metadata.director or "Director(a) / Subdirector(a)") + "\n")
    run_n_dir.bold = True
    run_n_dir.font.size = Pt(9.5)
    run_c_dir = p_f_dir.add_run("Director(a) / Subdirector(a)")
    run_c_dir.font.size = Pt(8.5)
    run_c_dir.font.color.rgb = RGBColor(100, 116, 139)

    # ─── FICHA DE TRABAJO (SI EXISTE) ───
    if session.ficha_trabajo:
        doc.add_page_break()
        
        p_ft_title_box = doc.add_paragraph()
        p_ft_title_box.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_ft_title_box.paragraph_format.space_before = Pt(20)
        p_ft_title_box.paragraph_format.space_after = Pt(12)
        run_ft_t = p_ft_title_box.add_run("FICHA DE TRABAJO INDEPENDIENTE PARA EL ESTUDIANTE")
        run_ft_t.bold = True
        run_ft_t.font.size = Pt(12)
        
        # Datos del Estudiante
        ft_table = doc.add_table(rows=1, cols=2)
        ft_table.autofit = True
        for cell in ft_table.rows[0].cells:
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = OxmlElement('w:tcBorders')
            bottom_b = OxmlElement('w:bottom')
            bottom_b.set(qn('w:val'), 'single')
            bottom_b.set(qn('w:sz'), '8')
            bottom_b.set(qn('w:color'), '3498DB') # Azul
            tcBorders.append(bottom_b)
            tcPr.append(tcBorders)

        ft_table.cell(0, 0).text = "Nombre: __________________________________________________"
        ft_table.cell(0, 0).paragraphs[0].runs[0].bold = True
        ft_table.cell(0, 0).paragraphs[0].runs[0].font.size = Pt(10)
        ft_table.cell(0, 0).paragraphs[0].runs[0].font.color.rgb = RGBColor(44, 62, 80)
        
        ft_table.cell(0, 1).text = "Grado y Sección: ________________"
        ft_table.cell(0, 1).paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        ft_table.cell(0, 1).paragraphs[0].runs[0].bold = True
        ft_table.cell(0, 1).paragraphs[0].runs[0].font.size = Pt(10)
        ft_table.cell(0, 1).paragraphs[0].runs[0].font.color.rgb = RGBColor(44, 62, 80)

        # Actividad e Indicaciones
        doc.add_paragraph().paragraph_format.space_before = Pt(14)
        p_ft_act = doc.add_paragraph()
        run_ft_act = p_ft_act.add_run(f"🎨 Actividad: {session.ficha_trabajo.titulo or 'Mi Ficha Práctica'}")
        run_ft_act.bold = True
        run_ft_act.font.size = Pt(12)
        run_ft_act.font.color.rgb = RGBColor(41, 128, 185)
        
        p_ft_ind = doc.add_paragraph()
        p_ft_ind.paragraph_format.space_before = Pt(6)
        p_ft_ind.paragraph_format.space_after = Pt(14)
        run_ft_ind_l = p_ft_ind.add_run("Indicaciones: ")
        run_ft_ind_l.bold = True
        run_ft_ind_l.font.size = Pt(9.5)
        run_ft_ind_val = p_ft_ind.add_run(session.ficha_trabajo.indicaciones or "Realiza la actividad según las indicaciones.")
        run_ft_ind_val.italic = True
        run_ft_ind_val.font.size = Pt(9.5)

        # Contenido de las Actividades
        p_ft_cont = doc.add_paragraph()
        p_ft_cont.paragraph_format.left_indent = Inches(0.1)
        content_txt = session.ficha_trabajo.actividades or ""
        content_txt = re.sub(r'<[^>]*>', '', content_txt)
        p_ft_cont.add_run(content_txt)

    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)
    return stream


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
