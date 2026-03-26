const Minio = require('minio');

// 切换回本地配置，确保本地安装并启动了 MinIO
const minioClient = new Minio.Client({
    endPoint: '127.0.0.1', 
    port: 9000, 
    useSSL: false,
    accessKey: 'minioadmin', 
    secretKey: 'minioadmin'  // 修正为默认密码，通常是 minioadmin
});

// helper to build a public access URL for uploaded objects
minioClient.getPublicUrl = (bucketName, objectName) => {
    // 适配本地环境
    const host = 'http://127.0.0.1';
    const port = 9000;
    return `${host}:${port}/${bucketName}/${objectName}`;
};

module.exports = minioClient;