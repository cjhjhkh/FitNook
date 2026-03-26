const db = require('./config/db');

async function fixSocialTables() {
    try {
        console.log('正在检查社区模块数据库表...');
        
        // 1. 创建 posts 表 (如果不存在)
        // 注意：原先设计可能是 social_posts，但路由里写的是 posts，我们统一用 posts
        // 增加 image_urls 支持多图 (JSON)
        const createPostsTable = `
            CREATE TABLE IF NOT EXISTS posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                outfit_id INT NULL,
                content TEXT NULL,
                image_url VARCHAR(512) NULL, 
                image_urls JSON NULL,
                location VARCHAR(255) NULL,
                view_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_outfit (outfit_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await db.query(createPostsTable);
        console.log('-> posts 表检查完毕');

        // 2. 创建 likes 表 (如果不存在)
        // 统一用 likes 表，支持对 post (帖子) 和 outfit (搭配) 点赞
        const createLikesTable = `
            CREATE TABLE IF NOT EXISTS likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                target_id INT NOT NULL,
                target_type ENUM('POST', 'OUTFIT') NOT NULL DEFAULT 'POST',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, target_id, target_type),
                INDEX idx_target (target_id, target_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await db.query(createLikesTable);
        console.log('-> likes 表检查完毕');
        
        // 3. 检查 users 表列名 (确保有 avatar_url 和 nickname)
        // 有些旧数据可能叫 avatar 或 name
        console.log('-> 正在检查 users 表字段...');
        // 这里只是简单的 ALTER 尝试，如果存在会忽略或报错，我们用 try-catch 包裹
        try {
            await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100) DEFAULT '用户'`);
            await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512) DEFAULT ''`);
            console.log('   users 表字段已补全');
        } catch (e) {
            console.log('   users 表字段检查跳过 (可能已存在)');
        }

        console.log('社区模块数据库表修复完成！');
        process.exit(0);
    } catch (err) {
        console.error('修复失败:', err);
        process.exit(1);
    }
}

fixSocialTables();
