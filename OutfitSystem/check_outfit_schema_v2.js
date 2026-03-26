const db = require('./config/db');

async function checkAndFixOutfitSchema() {
    console.log('开始检查 outfits 表结构...');
    const connection = await db.getConnection();

    try {
        // 1. 检查 temperature 字段
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM outfits LIKE 'temperature'
        `);

        if (columns.length === 0) {
            console.log('检测到缺少 temperature 字段，正在添加...');
            await connection.query(`
                ALTER TABLE outfits
                ADD COLUMN temperature VARCHAR(50) NULL COMMENT '温度' AFTER weather
            `);
            console.log('temperature 字段添加成功。');
        } else {
            console.log('temperature 字段已存在。');
        }

        // 2. 检查 items 表的 cloth_id 字段 (确保外键或索引存在，优化查询)
        // 之前代码里有逻辑依赖 outfit_items
        
        console.log('检查完成。');

    } catch (err) {
        console.error('检查过程中出错:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

checkAndFixOutfitSchema();