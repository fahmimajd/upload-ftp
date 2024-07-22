const express = require('express');
const multer = require('multer');
const ftp = require('ftp');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const app = express();
const upload = multer({ dest: 'uploads/' });

const FTP_HOST = '10.11.10.14';
const FTP_USER = 'capil';
const FTP_PASSWORD = 'capil';

// Middleware untuk melayani file statis
app.use(express.static('public'));
app.use(express.json());

function getFormattedDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // January is 0!
    const year = String(date.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
}

app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const folderName = req.body.folderName || '';

    if (!file) {
        return res.status(400).send({ message: 'No file uploaded' });
    }

    const datePrefix = getFormattedDate();
    const fullFolderName = `${datePrefix}-${folderName}`;

    try {
        const outputPath = `uploads/compressed-${file.originalname}`;

        // Compress the file using sharp (only for images)
        await sharp(file.path)
            .resize({ width: 1000 }) // Example resizing
            .toFormat('jpeg', { quality: 80 }) // Adjust quality
            .toFile(outputPath);

        // Check file size and ensure it's below 1MB
        const stats = fs.statSync(outputPath);
        if (stats.size > 1 * 1024 * 1024) {
            return res.status(400).send({ message: 'File too large to compress under 1MB' });
        }

        const ftpClient = new ftp();
        ftpClient.on('ready', () => {
            ftpClient.mkdir(fullFolderName, true, (err) => {
                if (err && err.code !== 550) {
                    return res.status(500).send({ message: 'FTP folder creation failed', error: err });
                }

                const remotePath = path.posix.join(fullFolderName, file.originalname);
                ftpClient.put(outputPath, remotePath, (err) => {
                    if (err) {
                        return res.status(500).send({ message: 'FTP upload failed', error: err });
                    }

                    fs.unlink(file.path, () => {});
                    fs.unlink(outputPath, () => {});

                    ftpClient.end();
                    res.send({ message: 'File uploaded successfully' });
                });
            });
        });

        ftpClient.connect({
            host: FTP_HOST,
            user: FTP_USER,
            password: FTP_PASSWORD
        });

    } catch (error) {
        res.status(500).send({ message: 'Error processing file', error });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
