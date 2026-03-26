const db = require('./config/db');

async function ensureSocialTables() {
    console.log('🔍 开始检查社区模块数据库表...');
    let connection;
    try {
        connection = await db.getConnection();

        // 1. 创建 social_posts 表 (社区动态)
        // 包含: 发布者ID, 关联搭配ID, 文本内容, 图片列表(JSON), 点赞数/评论数缓存(可选), 发布时间
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL COMMENT '发布用户ID',
                outfit_id INT NULL COMMENT '关联的搭配ID',
                content TEXT NULL COMMENT '动态文案',
                image_urls JSON NULL COMMENT '图片链接列表',
                view_count INT DEFAULT 0 COMMENT '浏览量',
                is_public TINYINT(1) DEFAULT 1 COMMENT '是否公开',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ social_posts 表检查完成');

        // 2. 创建 social_likes 表 (点赞记录)
        // 用于记录谁给哪篇帖子点了赞，防止重复点赞
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_user_post (user_id, post_id),
                INDEX idx_post (post_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ social_likes 表检查完成');

        // 3. 创建 social_comments 表 (评论记录)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL COMMENT '关联帖子ID',
                user_id INT NOT NULL COMMENT '评论者ID',
                parent_id INT NULL COMMENT '父评论ID(用于回复)',
                content VARCHAR(500) NOT NULL COMMENT '评论内容',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_post (post_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ social_comments 表检查完成');

        console.log('🎉 社区模块数据库表初始化成功！');

    } catch (err) {
        console.error('❌ 初始化失败:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

ensureSocialTables();
