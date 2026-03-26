const db = require('./config/db');

async function updateSchema() {
    try {
        console.log('开始检查社交功能相关表结构...');

        // 1. 检查 social_posts 表是否有 like_count 和 view_count 字段
        const checkColumnsQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'outfit_closet' 
            AND table_name = 'social_posts';
        `;
        const [columns] = await db.query(checkColumnsQuery);
        const columnNames = columns.map(c => c.COLUMN_NAME);

        /*
        if (!columnNames.includes('like_count')) {
            console.log('添加 like_count 字段到 social_posts...');
            await db.query(`ALTER TABLE social_posts ADD COLUMN like_count INT DEFAULT 0`);
        } else {
            console.log('social_posts 表已有 like_count 字段');
        }

        if (!columnNames.includes('view_count')) {
            console.log('添加 view_count 字段到 social_posts...');
            await db.query(`ALTER TABLE social_posts ADD COLUMN view_count INT DEFAULT 0`);
        } else {
            console.log('social_posts 表已有 view_count 字段');
        }
        */

        // 2. 创建 social_likes 表
        console.log('检查 social_likes 表...');
        const createLikesTableQuery = `
            CREATE TABLE IF NOT EXISTS social_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, post_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await db.query(createLikesTableQuery);
        console.log('social_likes 表检查/创建完成');

        console.log('数据库结构更新完成');
        process.exit(0);
    } catch (error) {
        console.error('更新数据库结构失败:', error);
        process.exit(1);
    }
}

updateSchema();
