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

function getFormattedDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // January is 0!
    const year = String(date.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
}

app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const folderName = req.body.folderName || '';

    if (!file) {
        return res.status(400).send({ message: 'No file uploaded' });
    }

    const datePrefix = getFormattedDate();
    const fullFolderName = `${datePrefix}-${folderName}`;

    const ftpClient = new ftp();
    ftpClient.on('ready', () => {
        ftpClient.mkdir(fullFolderName, true, (err) => {
            if (err && err.code !== 550) { // 550: Folder already exists
                return res.status(500).send({ message: 'FTP folder creation failed', error: err });
            }

            const remotePath = path.posix.join(fullFolderName, file.originalname);
            ftpClient.put(file.path, remotePath, (err) => {
                if (err) {
                    return res.status(500).send({ message: 'FTP upload failed', error: err });
                }

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
