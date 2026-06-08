const express = require('express');
const path = require('path');
const { put, list } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// El Token es inyectado automáticamente por Vercel en producción
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// Endpoint para guardar un reporte en Vercel Blob
app.post('/api/reportes', async (req, res) => {
    const reporte = req.body;
    const reportId = reporte.code;

    if (!reportId) return res.status(400).json({ error: 'Falta el ID del reporte.' });

    try {
        const blob = await put(`reportes/${reportId}.json`, JSON.stringify(reporte, null, 2), {
            access: 'public',
            contentType: 'application/json',
            token: BLOB_TOKEN
        });
        res.status(201).json({ message: 'Guardado exitoso', url: blob.url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fallo al guardar en la nube.' });
    }
});

// Endpoint para leer todos los reportes desde Vercel Blob
app.get('/api/reportes', async (req, res) => {
    try {
        const { blobs } = await list({ prefix: 'reportes/', token: BLOB_TOKEN });
        
        const reportes = await Promise.all(
            blobs.map(async (blob) => {
                const response = await fetch(blob.url);
                return await response.json();
            })
        );

        reportes.sort((a, b) => b.timestamp - a.timestamp);
        res.json(reportes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al recuperar reportes.' });
    }
});

app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));