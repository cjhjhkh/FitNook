const db = require('./config/db');
-
async function updateDiarySchema() {
    try {
        console.log('开始检查 diaries 表结构...');
        
        // 1. 检查表是否存在
        const [tables] = await db.query("SHOW TABLES LIKE 'diaries'");
        if (tables.length === 0) {
            console.log('❌ diaries 表不存在，请先运行初始化脚本');
            process.exit(1);
        }

        // 2. 检查列是否存在
        const [columns] = await db.query("SHOW COLUMNS FROM diaries LIKE 'linked_items'");
        
        if (columns.length === 0) {
            console.log('⚠️ linked_items 列不存在，正在添加...');
            await db.query("ALTER TABLE diaries ADD COLUMN linked_items JSON COMMENT '关联的衣物/搭配ID集合'");
            console.log('✅ linked_items 列添加成功');
        } else {
            console.log('✅ linked_items 列已存在');
        }

        console.log('数据库更新完成');
        process.exit(0);
    } catch (err) {
        console.error('更新失败:', err);
        process.exit(1);
    }
}

updateDiarySchema();
