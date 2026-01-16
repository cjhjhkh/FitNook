const db = require('./config/db');

async function updateSchema() {
    try {
        console.log('🔍 正在检查 outfits 表结构...');
        const [columns] = await db.query('SHOW COLUMNS FROM outfits');
        const columnNames = columns.map(c => c.Field);
        
        if (!columnNames.includes('weather')) {
            console.log('➕ 正在添加 weather 字段...');
            await db.query('ALTER TABLE outfits ADD COLUMN weather varchar(50) DEFAULT NULL COMMENT "天气"');
        } else {
            console.log('✅ weather 字段已存在');
        }

        if (!columnNames.includes('temperature')) {
            console.log('➕ 正在添加 temperature 字段...');
            await db.query('ALTER TABLE outfits ADD COLUMN temperature varchar(20) DEFAULT NULL COMMENT "温度"');
        } else {
            console.log('✅ temperature 字段已存在');
        }
        
        console.log('🎉 数据库结构更新完成！');
    } catch (err) {
        console.error('❌ 更新失败:', err);
    } finally {
        process.exit();
    }
}

updateSchema();
