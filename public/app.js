document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('report-form');
    const reportsTbody = document.getElementById('reports-tbody');
    const reportCount = document.getElementById('report-count');
    const searchInput = document.getElementById('search-input');

    let reports = [];

    // 1. Obtener datos desde Vercel Blob vía API
    const fetchReportsFromServer = async () => {
        try {
            const response = await fetch('/api/reportes');
            if (response.ok) {
                reports = await response.json();
                updateUI();
            }
        } catch (error) {
            console.error('Error de red:', error);
        }
    };

    // 2. Generar Código Único
    const generateCode = () => {
        const nextNumber = reports.length > 0 ? Math.max(...reports.map(r => r.numericId)) + 1 : 1;
        return { numericId: nextNumber, codeStr: `R-${String(nextNumber).padStart(3, '0')}` };
    };

    // 3. Motor PDF (jsPDF)
    const generarPDF = (reporte) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const rojo = [211, 47, 47], gris = [33, 37, 41];

        // Banner
        doc.setFillColor(...rojo);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(18);
        doc.text("ALMACÉN PF", 15, 16);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        doc.text("SISTEMA DE REPORTES", 150, 15);

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
        
        doc.line(15, 70, 195, 70);

        // Descripción
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Descripción:", 15, 80);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const textLines = doc.splitTextToSize(reporte.description, 180);
        doc.text(textLines, 15, 88, { lineHeightFactor: 1.5 });

        doc.save(`${reporte.code}_AlmacenPF.pdf`);
    };

    // 4. Renderizado de Interfaz
    const renderReports = (filterText = '') => {
        reportsTbody.innerHTML = '';
        const filtered = reports.filter(r => 
            r.title.toLowerCase().includes(filterText.toLowerCase()) || r.code.toLowerCase().includes(filterText.toLowerCase())
        );

        if (filtered.length === 0) {
            reportsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay reportes</td></tr>`;
            return;
        }

        filtered.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${r.code}</strong></td>
                <td>${r.date.split('-').reverse().join('/')}</td>
                <td>${r.title}</td>
                <td><span class="badge" style="background-color:#6c757d;">${r.category}</span></td>
                <td><button class="btn-pdf" data-id="${r.numericId}">PDF</button></td>
            `;
            reportsTbody.appendChild(tr);
        });
    };

    const updateUI = () => {
        reportCount.textContent = `${reports.length} reportes`;
        renderReports(searchInput.value);
    };

    // 5. Eventos
    reportsTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-pdf')) {
            const reporte = reports.find(r => r.numericId === parseInt(e.target.dataset.id));
            if (reporte) generarPDF(reporte);
        }
    });

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idData = generateCode();
        const btnSubmit = reportForm.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Guardando...';

        const newReport = {
            numericId: idData.numericId,
            code: idData.codeStr,
            title: document.getElementById('report-title').value.trim(),
            category: document.getElementById('report-category').value,
            date: document.getElementById('report-date').value,
            description: document.getElementById('report-description').value.trim(),
            timestamp: new Date().getTime()
        };

        try {
            const response = await fetch('/api/reportes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReport)
            });

            if (response.ok) {
                reportForm.reset();
                document.getElementById('report-date').valueAsDate = new Date();
                await fetchReportsFromServer();
            }
        } catch (error) {
            console.error('Fallo al guardar:', error);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Alojar Reporte';
        }
    });

    searchInput.addEventListener('input', (e) => renderReports(e.target.value));

    // Inicialización
    document.getElementById('report-date').valueAsDate = new Date();
    fetchReportsFromServer();
});