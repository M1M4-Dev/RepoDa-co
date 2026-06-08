document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('report-form');
    const reportsTbody = document.getElementById('reports-tbody');
    const reportCount = document.getElementById('report-count');
    const searchInput = document.getElementById('search-input');

    let reports = [];

    const fetchReportsFromServer = async () => {
        try {
            const response = await fetch('/api/reportes');
            if (response.ok) {
                reports = await response.json();
                updateUI();
            }
        } catch (error) {
            console.error('Error al sincronizar con MongoDB:', error);
        }
    };

    // Renderizado Adaptativo Mejorado
    const renderReports = (filterText = '') => {
        reportsTbody.innerHTML = '';
        
        const filtered = reports.filter(r => 
            r.title.toLowerCase().includes(filterText.toLowerCase()) || 
            r.code.toLowerCase().includes(filterText.toLowerCase()) ||
            r.category.toLowerCase().includes(filterText.toLowerCase())
        );

        if (filtered.length === 0) {
            reportsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay reportes registrados en la base de datos</td></tr>`;
            return;
        }

        filtered.forEach(r => {
            const tr = document.createElement('tr');
            
            // Generar HTML para las vistas previas de imágenes indexadas
            let imagesHtml = '<span class="no-image">Sin evidencia</span>';
            if (r.images && r.images.length > 0) {
                // Al hacer clic, abre la imagen en resolución completa en una nueva pestaña
                imagesHtml = `<div class="image-gallery">
                    ${r.images.map(img => `<a href="${img}" target="_blank"><img src="${img}" class="img-thumbnail" alt="Evidencia"></a>`).join('')}
                </div>`;
            }

            tr.innerHTML = `
                <td style="color: var(--primary-dark);"><strong>${r.code}</strong></td>
                <td>${r.date.split('-').reverse().join('/')}</td>
                <td>
                    <div class="report-title-cell">
                        <strong>${r.title}</strong>
                        <span class="badge" style="width: fit-content;">${r.category}</span>
                    </div>
                </td>
                <td>${imagesHtml}</td>
                <td>
                    <button class="btn-pdf" data-code="${r.code}">Exportar PDF</button>
                </td>
            `;
            reportsTbody.appendChild(tr);
        });
    };

    const updateUI = () => {
        reportCount.textContent = `${reports.length} reportes indexados`;
        renderReports(searchInput.value);
    };

    // Envío del Formulario (Ahora soporta Archivos)
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = reportForm.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Subiendo Datos e Imágenes...';

        // Objeto FormData permite enviar archivos e información estructurada simultáneamente
        const formData = new FormData();
        formData.append('title', document.getElementById('report-title').value.trim());
        formData.append('category', document.getElementById('report-category').value);
        formData.append('date', document.getElementById('report-date').value);
        formData.append('description', document.getElementById('report-description').value.trim());

        const imageFiles = document.getElementById('report-images').files;
        for (let i = 0; i < imageFiles.length; i++) {
            formData.append('images', imageFiles[i]);
        }

        try {
            // Nota: Con FormData NO se envían headers de Content-Type. 
            // El navegador calcula automáticamente el 'multipart/form-data boundary'.
            const response = await fetch('/api/reportes', {
                method: 'POST',
                body: formData 
            });

            if (response.ok) {
                reportForm.reset();
                document.getElementById('report-date').valueAsDate = new Date();
                await fetchReportsFromServer();
            } else {
                alert('Ocurrió un error al procesar el reporte.');
            }
        } catch (error) {
            console.error('Fallo en la conexión:', error);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Alojar Reporte';
        }
    });

    searchInput.addEventListener('input', (e) => renderReports(e.target.value));

    // Motor PDF Mantenido (Actualizado para el nuevo selector)
    reportsTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-pdf')) {
            const codeTarget = e.target.getAttribute('data-code');
            const reporte = reports.find(r => r.code === codeTarget);
            if (reporte) generarPDF(reporte);
        }
    });

    const generarPDF = (reporte) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const rojo = [211, 47, 47], gris = [33, 37, 41];

        // Diseño Banner
        doc.setFillColor(...rojo);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(18);
        doc.text("ALMACÉN PF", 15, 16);
        
        // Encabezado
        doc.setTextColor(...gris);
        doc.setFont("helvetica", "bold"); doc.setFontSize(14);
        doc.text(`REPORTE: ${reporte.code}`, 15, 40);
        doc.setDrawColor(222, 226, 230); doc.line(15, 44, 195, 44);

        // Metadatos
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold"); doc.text("Categoría:", 15, 54);
        doc.setFont("helvetica", "normal"); doc.text(reporte.category, 40, 54);
        doc.setFont("helvetica", "bold"); doc.text("Fecha:", 15, 62);
        doc.setFont("helvetica", "normal"); doc.text(reporte.date.split('-').reverse().join('/'), 40, 62);
        doc.setFont("helvetica", "bold"); doc.text("Título:", 100, 54);
        doc.setFont("helvetica", "normal"); doc.text(reporte.title, 115, 54);
        
        // Indicador de imágenes adjuntas
        doc.setFont("helvetica", "bold"); doc.text("Anexos visuales:", 100, 62);
        doc.setFont("helvetica", "normal"); 
        doc.text(reporte.images && reporte.images.length > 0 ? `${reporte.images.length} imagen(es) en base de datos` : "Ninguno", 132, 62);
        
        doc.line(15, 70, 195, 70);

        // Descripción
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Descripción:", 15, 80);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const textLines = doc.splitTextToSize(reporte.description, 180);
        doc.text(textLines, 15, 88, { lineHeightFactor: 1.5 });

        doc.save(`${reporte.code}_AlmacenPF.pdf`);
    };

    // Inicialización
    document.getElementById('report-date').valueAsDate = new Date();
    fetchReportsFromServer();
});