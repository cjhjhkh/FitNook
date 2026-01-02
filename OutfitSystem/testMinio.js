const minioClient = require('./config/minio');

// 测试列出所有的 buckets
minioClient.listBuckets((err, buckets) => {
  if (err) {
    return console.log('❌ 连接 MinIO 失败:', err.message);
  }
  console.log('✅ 连接成功！当前 Buckets:', buckets);
});