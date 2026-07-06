/* ═══════════════════════════════════════════════════════════════
   PAGINADOR.JS — Motor de Paginación A4 Frontend
   
   Convierte el HTML continuo de la sesión en "páginas" físicas
   de 210mm × 297mm, listas para ser calqueadas por el backend.
   
   Estrategia:
   1. Clonar el DOM del session-sheet
   2. Medir las alturas reales de cada nodo con offsetHeight
   3. Distribuir los nodos en divs .hoja-a4
   4. Si una tabla se desborda → cerrar la hoja actual y abrir una nueva
      clonando el <thead> de esa tabla para continuidad visual
   ═══════════════════════════════════════════════════════════════ */

const Paginador = (() => {

    // ── Dimensiones físicas A4 en píxeles a 96 dpi ──
    // 297mm × 96dpi / 25.4 = 1122.52px
    // Márgenes útiles: 297mm - 36mm (top 18mm + bottom 18mm) = 261mm = 985px
    const A4_HEIGHT_PX = 985; // Alto útil de la hoja A4 en píxeles (sin márgenes)

    /**
     * Verifica si una tabla tiene cabecera (thead)
     */
    function getTableHeader(tableEl) {
        if (!tableEl || tableEl.tagName !== 'TABLE') return null;
        return tableEl.querySelector(':scope > thead') || tableEl.querySelector('thead');
    }

    /**
     * Crea un nuevo div .hoja-a4 vacío para comenzar una nueva página
     */
    function crearHoja(canvas) {
        const hoja = document.createElement('div');
        hoja.className = 'hoja-a4';
        canvas.appendChild(hoja);
        return hoja;
    }

    /**
     * Mide la altura real de un nodo insertándolo en un contenedor
     * fuera de pantalla del mismo ancho que la hoja A4.
     */
    function medirNodo(nodo, medidorContainer) {
        const clon = nodo.cloneNode(true);
        medidorContainer.appendChild(clon);
        const altura = clon.offsetHeight;
        medidorContainer.removeChild(clon);
        return altura;
    }

    /**
     * Motor principal de paginación.
     * @param {HTMLElement} sessionSheetEl - El elemento #session-sheet con el HTML renderizado
     * @returns {HTMLElement} - Canvas con divs .hoja-a4 pre-paginados
     */
    function calcular(sessionSheetEl) {
        // Contenedor canvas donde alojar las hojas generadas
        const canvas = document.createElement('div');
        canvas.id = 'a4-canvas';

        // Contenedor medidor fuera de pantalla (mismo ancho que la hoja a 96dpi ~794px)
        const medidor = document.createElement('div');
        medidor.style.cssText = [
            'position:absolute',
            'top:-9999px',
            'left:-9999px',
            'width:794px',
            'visibility:hidden',
            'pointer-events:none'
        ].join(';');
        document.body.appendChild(medidor);

        // 1. Extraer la cabecera oficial y el contenido real a paginar
        let headerOficial = null;
        let nodosContenido = [];

        const printLayoutTable = sessionSheetEl.querySelector('.print-layout-table');
        if (printLayoutTable) {
            // Extraer el encabezado institucional para repetirlo en cada página
            const headerTable = printLayoutTable.querySelector('.official-header-table');
            if (headerTable) {
                headerOficial = headerTable.cloneNode(true);
            }

            // Extraer nodos contenidos dentro de la celda de datos principal
            const tbodyTd = printLayoutTable.querySelector(':scope > tbody > tr > td') || printLayoutTable.querySelector('tbody td');
            if (tbodyTd) {
                nodosContenido = Array.from(tbodyTd.childNodes);
            } else {
                nodosContenido = Array.from(printLayoutTable.childNodes);
            }

            // Añadir los elementos que queden fuera o después de la tabla contenedora
            const hermanos = Array.from(sessionSheetEl.childNodes);
            const indexTable = hermanos.indexOf(printLayoutTable);
            if (indexTable !== -1) {
                nodosContenido = nodosContenido.concat(hermanos.slice(indexTable + 1));
            }
        } else {
            // Sin layout table contenedora, procesar todo linealmente
            nodosContenido = Array.from(sessionSheetEl.childNodes);
        }

        // Helper para inicializar una nueva página A4 con su cabecera si existe
        function crearNuevaHoja() {
            const hoja = document.createElement('div');
            hoja.className = 'hoja-a4';
            canvas.appendChild(hoja);

            let alturaCabecera = 0;
            if (headerOficial) {
                const headerClone = headerOficial.cloneNode(true);
                hoja.appendChild(headerClone);
                alturaCabecera = medirNodo(headerClone, medidor);
            }
            return { hoja, alturaCabecera };
        }

        let { hoja: hojaActual, alturaCabecera: alturaCabeceraActual } = crearNuevaHoja();
        let alturaUsada = alturaCabeceraActual;

        for (const nodo of nodosContenido) {
            // Ignorar nodos de texto vacíos y comentarios
            if (nodo.nodeType !== Node.ELEMENT_NODE) continue;

            // Ignorar elementos interactivos del editor
            if (nodo.classList && (
                nodo.classList.contains('no-print') ||
                nodo.classList.contains('btn-remove-logo') ||
                nodo.classList.contains('add-logo-placeholder')
            )) continue;

            // Medir altura real del nodo
            const alturaElem = medirNodo(nodo, medidor);
            if (alturaElem === 0) continue; // nodo invisible o vacío

            // ── Caso 1: El nodo cabe en la hoja actual ──
            if (alturaUsada + alturaElem <= A4_HEIGHT_PX) {
                hojaActual.appendChild(nodo.cloneNode(true));
                alturaUsada += alturaElem;
                continue;
            }

            // ── Caso 2: Es una tabla → fragmentar fila por fila ──
            const esTabla = nodo.tagName === 'TABLE';
            const tablaInterna = !esTabla ? nodo.querySelector('table') : null;
            const tabla = esTabla ? nodo : tablaInterna;

            if (tabla) {
                const thead = getTableHeader(tabla);
                const tbody = tabla.querySelector(':scope > tbody') || tabla;
                const filas = Array.from(tbody.querySelectorAll(':scope > tr'));

                if (filas.length > 0) {
                    let tablaActual = crearTablaClonada(tabla, thead);
                    hojaActual.appendChild(tablaActual);

                    for (const fila of filas) {
                        const alturaFila = medirNodo(fila, medidor);

                        if (alturaUsada + alturaFila <= A4_HEIGHT_PX) {
                            tablaActual.querySelector('tbody').appendChild(fila.cloneNode(true));
                            alturaUsada += alturaFila;
                        } else {
                            // Salto de página: crear nueva hoja e inyectar cabecera oficial
                            const res = crearNuevaHoja();
                            hojaActual = res.hoja;
                            alturaUsada = res.alturaCabecera;

                            tablaActual = crearTablaClonada(tabla, thead);
                            hojaActual.appendChild(tablaActual);
                            tablaActual.querySelector('tbody').appendChild(fila.cloneNode(true));
                            alturaUsada += alturaFila;
                        }
                    }
                    continue;
                }
            }

            // ── Caso 3: Bloque genérico que no cabe → forzar salto de página ──
            const res = crearNuevaHoja();
            hojaActual = res.hoja;
            alturaUsada = res.alturaCabecera;

            hojaActual.appendChild(nodo.cloneNode(true));
            alturaUsada += alturaElem;
        }

        // Limpiar medidor fuera de pantalla
        document.body.removeChild(medidor);

        return canvas;
    }

    /**
     * Crea una nueva tabla clonando la estructura (colgroup + thead vacío + tbody vacío).
     */
    function crearTablaClonada(tablaOriginal, thead) {
        const nuevaTabla = document.createElement('table');
        nuevaTabla.className = tablaOriginal.className;
        const style = tablaOriginal.getAttribute('style');
        if (style) nuevaTabla.setAttribute('style', style);

        const colgroup = tablaOriginal.querySelector(':scope > colgroup');
        if (colgroup) nuevaTabla.appendChild(colgroup.cloneNode(true));

        if (thead) {
            const theadClone = thead.cloneNode(true);
            theadClone.setAttribute('data-repeated', 'true');
            nuevaTabla.appendChild(theadClone);
        }

        const nuevoTbody = document.createElement('tbody');
        nuevaTabla.appendChild(nuevoTbody);

        return nuevaTabla;
    }

    /**
     * Obtiene el HTML limpio del canvas paginado para enviar al backend.
     */
    function getHtml(canvas) {
        return canvas.outerHTML;
    }

    // API pública
    return { calcular, getHtml, A4_HEIGHT_PX };

})();
