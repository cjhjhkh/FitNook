const db = require('./config/db');

async function checkAndFixSchema() {
    const connection = await db.getConnection();
    try {
        console.log('开始检查 outfits 表结构...');
        
        // 1. 检查 temperature 字段
        const [columns] = await connection.query(`SHOW COLUMNS FROM outfits LIKE 'temperature'`);
        if (columns.length === 0) {
            console.log('检测到缺少 temperature 字段，正在添加...');
            await connection.query(`ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50) DEFAULT '' COMMENT '温度' AFTER weather`);
            console.log('temperature 字段添加成功');
        } else {
            console.log('temperature 字段已存在');
        }

        // 2. 检查 image_url 字段 (确保长度足够)
        const [urlColumns] = await connection.query(`SHOW COLUMNS FROM outfits LIKE 'image_url'`);
        if (urlColumns.length > 0) {
             const type = urlColumns[0].Type.toLowerCase();
             // 如果是默认的 varchar(255) 可能不够存某些长链接，改为 TEXT 或 longer varchar
             if (type.includes('varchar(255)')) {
                 console.log('检测到 image_url 长度可能不足，正在扩容...');
                 await connection.query(`ALTER TABLE outfits MODIFY COLUMN image_url TEXT COMMENT '合成图URL'`);
                 console.log('image_url 字段已扩容为 TEXT');
             }
        }
        
        console.log('数据库检查完成');

    } catch (err) {
        console.error('检查过程中出错:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

checkAndFixSchema();
