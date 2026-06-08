const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de credenciales (Asegúrate de configurar estas variables en Vercel)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado exitosamente a MongoDB Atlas'))
    .catch(err => console.error('Error al conectar a MongoDB:', err));

// Definición del Esquema (Estructura de la base de datos)
const reportSchema = new mongoose.Schema({
    numericId: Number,
    code: String,
    title: String,
    category: String,
    date: String,
    description: String,
    images: [String], // Array que almacenará las URLs de Cloudinary
    timestamp: { type: Number, default: () => Date.now() }
});
const Report = mongoose.model('Report', reportSchema);

// Configuración de Multer para manejar los archivos en la memoria temporal (RAM)
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Función auxiliar para subir un archivo buffer a Cloudinary
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "almacen_pf" }, // Carpeta virtual en tu Cloudinary
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

// ENDPOINT: Crear y alojar un nuevo reporte con imágenes
app.post('/api/reportes', upload.array('images', 5), async (req, res) => { // Máximo 5 imágenes por reporte
    try {
        // 1. Generar Código Único Consultando MongoDB
        const lastReport = await Report.findOne().sort('-numericId');
        const nextNumber = lastReport ? lastReport.numericId + 1 : 1;
        const codeStr = `R-${String(nextNumber).padStart(3, '0')}`;

        // 2. Subir las imágenes a Cloudinary en paralelo (si existen)
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
            const results = await Promise.all(uploadPromises);
            imageUrls.push(...results);
        }

        // 3. Guardar el documento estructurado en MongoDB
        const newReport = new Report({
            numericId: nextNumber,
            code: codeStr,
            title: req.body.title,
            category: req.body.category,
            date: req.body.date,
            description: req.body.description,
            images: imageUrls
        });

        await newReport.save();
        res.status(201).json({ message: 'Reporte guardado con éxito', data: newReport });

    } catch (error) {
        console.error('Fallo en el servidor:', error);
        res.status(500).json({ error: 'Ocurrió un error al procesar el reporte.' });
    }
});

// ENDPOINT: Listar reportes
app.get('/api/reportes', async (req, res) => {
    try {
        // Traer todos los reportes ordenados del más reciente al más antiguo
        const reportes = await Report.find().sort({ timestamp: -1 });
        res.json(reportes);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar MongoDB.' });
    }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));