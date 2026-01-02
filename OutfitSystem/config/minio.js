// const Minio = require('minio');

// const minioClient = new Minio.Client({
//     endPoint: '127.0.0.1', // 如果是本地 MinIO
//     port: 9000,
//     useSSL: false,
//     accessKey: '你的AccessKey', // MinIO 控制台生成的
//     secretKey: '你的SecretKey'
// });

// module.exports = minioClient;


















const Minio = require('minio');

const minioClient = new Minio.Client({
    endPoint: '101.251.176.123', // 去掉协议和端口，只保留主机名或 IP
    port: 20012, // 单独配置端口
    useSSL: false,
    accessKey: 'minioadmin', // MinIO 控制台生成的
    secretKey: 'minioadmin123'
});

// helper to build a public access URL for uploaded objects
minioClient.getPublicUrl = (bucketName, objectName) => {
    const host = 'http://101.251.176.123';
    const port = 20012;
    return `${host}:${port}/${bucketName}/${objectName}`;
};

module.exports = minioClient;