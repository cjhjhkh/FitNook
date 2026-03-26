const db = require('./OutfitSystem/config/db');

async function initSocialTables() {
    try {
        console.log('开始初始化社交模块数据库表...');

        // 1. 创建 social_posts 表
        // 帖子表：存储用户发布的穿搭动态
        const createPostsTable = `
            CREATE TABLE IF NOT EXISTS social_posts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                outfit_id BIGINT DEFAULT NULL,
                content TEXT,
                image_urls JSON DEFAULT NULL,
                view_count INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE SET NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        await db.query(`DROP TABLE IF EXISTS social_likes`); // 先删除依赖表
        await db.query(`DROP TABLE IF EXISTS social_posts`); // 删除旧表以应用新结构
        await db.query(createPostsTable);
        console.log('✅ social_posts 表重置/创建成功');

        // 2. 创建 social_likes 表
        // 点赞表：存储用户对帖子的点赞状态
        const createLikesTable = `
            CREATE TABLE IF NOT EXISTS social_likes (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                post_id BIGINT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, post_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        await db.query(createLikesTable);
        console.log('✅ social_likes 表检查/创建成功');

        console.log('🎉 社交模块数据库初始化完成！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        process.exit(1);
    }
}

initSocialTables();