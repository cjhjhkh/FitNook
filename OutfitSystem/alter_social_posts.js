const db = require('./config/db');

async function alterSocialTable() {
    try {
        console.log('🔄 开始修改 social_posts 表结构...');
        
        // 1. 检查字段是否存在
        const [columns] = await db.query("SHOW COLUMNS FROM social_posts LIKE 'image_urls'");
        
        if (columns.length === 0) {
            // 如果 image_urls 不存在，检查 image_url 是否存在
            const [oldColumns] = await db.query("SHOW COLUMNS FROM social_posts LIKE 'image_url'");
            
            if (oldColumns.length > 0) {
                console.log('检测到旧字段 image_url，执行重命名和类型变更...');
                // 将 image_url 重命名为 image_urls 并修改类型为 JSON
                // 注意：由于可能有旧数据，我们需要先处理数据，这里简单起见直接改名，
                // MySQL 5.7+ 支持 JSON，如果是旧版 MySQL 可能用 TEXT。这里假设是较新版。
                // 为了兼容性，先修改为 TEXT 或 JSON
                await db.query(`
                    ALTER TABLE social_posts 
                    CHANGE COLUMN image_url image_urls JSON DEFAULT NULL COMMENT '图片列表JSONArray'
                `);
            } else {
                console.log('未找到 image_url 字段，直接添加 image_urls...');
                await db.query(`
                    ALTER TABLE social_posts 
                    ADD COLUMN image_urls JSON DEFAULT NULL COMMENT '图片列表JSONArray' AFTER content
                `);
            }
            console.log('✅ social_posts 表字段更新成功 (image_urls)');
        } else {
            console.log('ℹ️ image_urls 字段已存在，无需修改。');
        }
        
        process.exit(0);
    } catch (e) {
        console.error('❌ 修改表结构失败:', e);
        process.exit(1);
    }
}

alterSocialTable();
