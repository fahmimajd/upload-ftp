const express = require('express');
const multer = require('multer');
const ftp = require('ftp');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

const FTP_HOST = 'host';
const FTP_USER = 'user';
const FTP_PASSWORD = 'pass';

// Middleware untuk melayani file statis
app.use(express.static('public'));
app.use(express.json());

app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const folderName = req.body.folderName || '';

    if (!file) {
        return res.status(400).send({ message: 'No file uploaded' });
    }

    const ftpClient = new ftp();
    ftpClient.on('ready', () => {
        // Buat folder jika belum ada
        ftpClient.mkdir(folderName, true, (err) => {
            if (err && err.code !== 550) { // 550: Folder already exists
                return res.status(500).send({ message: 'FTP folder creation failed', error: err });
            }

            // Upload file ke folder yang ditentukan
            const remotePath = folderName ? path.posix.join(folderName, file.originalname) : file.originalname;
            ftpClient.put(file.path, remotePath, (err) => {
                if (err) {
                    return res.status(500).send({ message: 'FTP upload failed', error: err });
                }

                // Hapus file yang sudah diunggah dari server lokal
                fs.unlink(file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Failed to delete local file:', unlinkErr);
                });

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
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
