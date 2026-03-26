const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
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

        // 1. 获取业务类型（默认为 wardrobe）
        const type = req.body.type || 'wardrobe';
        const allowedTypes = ['wardrobe', 'avatar', 'diary'];
        const subDir = allowedTypes.includes(type) ? type : 'wardrobe';

        // 2. 确保上传目录存在
        // 存储在项目根目录下的 uploads/{type} 文件夹中
        const uploadDir = path.join(__dirname, '..', 'uploads', subDir);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 3. 生成文件名
        // 使用 type_ 前缀区分
        const fileName = `${type}_${Date.now()}_${Math.round(Math.random() * 1000)}.jpg`;
        const filePath = path.join(uploadDir, fileName);

        // 4. 写入本地文件
        fs.writeFileSync(filePath, req.file.buffer);
        
        // 5. 生成访问 URL
        // 假设服务器运行在 localhost:3000，静态资源路径挂载在 /uploads
        // 这个 HOST 最好是从配置文件或环境变量取，这里先写死本地地址
        const HOST = 'http://localhost:3000'; 
        const publicUrl = `${HOST}/uploads/${subDir}/${fileName}`;

        res.json({ code: 200, msg: '上传成功', url: publicUrl });

    } catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({ code: 500, msg: '上传失败', error: error.message });
    }
});

module.exports = router;
