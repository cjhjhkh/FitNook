const express = require('express');
const router = express.Router();
const minioClient = require('../config/minio');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 通用上传接口
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ code: 400, msg: '未上传文件' });
        }

        const bucketName = 'wardrobe';
        // 使用时间戳+随机数生成文件名
        const objectName = `snapshots/${Date.now()}-${Math.round(Math.random() * 1000)}.jpg`;

        const metaData = {
            'Content-Type': req.file.mimetype
        };

        // 上传到 MinIO
        await minioClient.putObject(bucketName, objectName, req.file.buffer, req.file.size, metaData);
        
        // 获取可访问 URL
        // 如果 minioClient 封装不同，这里可能需要调整，暂时假设直接拼接或使用 presigned
        // 根据 clothes.js 的逻辑，似乎直接使用 client.getPublicUrl (如果封装了) 或自行拼接
        // 这里为了稳健，复用 clothes.js 里的逻辑: publicUrl = minioClient.getPublicUrl...
        // 假设 config/minio.js 导出的是原始 client，我们需要确认 helper 方法。
        // 观察 clothes.js: const publicUrl = minioClient.getPublicUrl(bucketName, objectName);
        // 说明 minioClient 实例上有这个扩展方法或者被 hack 了。我们照用。
        
        let publicUrl = '';
        if (typeof minioClient.getPublicUrl === 'function') {
            publicUrl = minioClient.getPublicUrl(bucketName, objectName);
        } else {
             // Fallback logic just in case
             const protocol = minioClient.protocol || 'http';
             const host = minioClient.host || 'localhost';
             const port = minioClient.port ? `:${minioClient.port}` : '';
             publicUrl = `${protocol}://${host}${port}/${bucketName}/${objectName}`;
        }

        res.json({ code: 200, msg: '上传成功', url: publicUrl });

    } catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({ code: 500, msg: '上传失败', error: error.message });
    }
});

module.exports = router;
