const db = require('./config/db');

async function checkAndFix() {
    console.log('开始检查 outfits 表结构...');
    let connection;
    try {
        connection = await db.getConnection();
        const [rows] = await connection.query('SHOW COLUMNS FROM outfits');
        const columns = rows.map(c => c.Field);

        // 检查 temperature
        if (!columns.includes('temperature')) {
            console.log('⚠️ 缺少 temperature 字段，正在添加...');
            await connection.query('ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50) DEFAULT "" COMMENT "温度" AFTER weather');
            console.log('✅ temperature 字段添加成功');
        } else {
            console.log('✅ temperature 字段已存在');
        }

        // 检查 image_url
        if (!columns.includes('image_url')) {
            console.log('⚠️ 缺少 image_url 字段，正在添加...');
            await connection.query('ALTER TABLE outfits ADD COLUMN image_url VARCHAR(500) DEFAULT "" COMMENT "合成图URL" AFTER description');
            console.log('✅ image_url 字段添加成功');
        } else {
            console.log('✅ image_url 字段已存在');
        }

    } catch (err) {
        console.error('检查失败:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

checkAndFix();
