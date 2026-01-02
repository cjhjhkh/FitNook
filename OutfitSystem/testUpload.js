const minioClient = require('./config/minio');

async function testUpload() {
    const bucketName = 'wardrobe';
    const objectName = `test-upload-${Date.now()}.txt`;
    const content = 'Hello MinIO, this is a test upload.';
    
    console.log(`[Test] 开始上传测试文件: ${objectName}`);
    const startTime = Date.now();

    try {
        // 检查 bucket 是否存在
        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
            console.log(`[Test] Bucket '${bucketName}' 不存在，尝试创建...`);
            await minioClient.makeBucket(bucketName);
            console.log(`[Test] Bucket '${bucketName}' 创建成功`);
        }

        await minioClient.putObject(bucketName, objectName, content);
        const duration = (Date.now() - startTime) / 1000;
        console.log(`[Test] ✅ 上传成功！耗时: ${duration}s`);
        
        const url = await minioClient.presignedGetObject(bucketName, objectName);
        console.log(`[Test] 文件访问链接 (临时): ${url}`);

    } catch (err) {
        console.error('[Test] ❌ 上传失败:', err);
    }
}

testUpload();