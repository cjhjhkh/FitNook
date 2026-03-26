const db = require('./config/db');

async function ensureSocialTables() {
    console.log('🚀 开始检查 MySQL 社交模块表结构...');

    try {
        // 1. 检查 social_posts 表
        console.log('📦 检查 social_posts 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS social_posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255),
                content TEXT,
                image_urls TEXT,
                views INT DEFAULT 0,
                likes_count INT DEFAULT 0,
                comments_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. 检查 social_comments 表 及 parent_id 字段
        console.log('💬 检查 social_comments 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS social_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                parent_id INT DEFAULT NULL,
                INDEX idx_post_id (post_id),
                INDEX idx_user_id (user_id),
                INDEX idx_parent_id (parent_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 检查是否有 parent_id 字段 (针对旧表)
        const [commentColumns] = await db.query("SHOW COLUMNS FROM social_comments LIKE 'parent_id'");
        if (commentColumns.length === 0) {
            console.log('⚠️ social_comments 缺少 parent_id 字段，正在添加...');
            await db.query("ALTER TABLE social_comments ADD COLUMN parent_id INT DEFAULT NULL AFTER user_id");
            console.log('✅ parent_id 字段添加成功');
        }

        // 3. 检查 social_likes 表
        console.log('❤️ 检查 social_likes 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS social_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, post_id),
                INDEX idx_post_id (post_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. 检查 favorites 表
        console.log('⭐ 检查 favorites 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                item_type VARCHAR(50) NOT NULL COMMENT 'outfit, clothing, post',
                item_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_fav (user_id, item_type, item_id),
                INDEX idx_user_type (user_id, item_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. 检查 user_profiles 表
        console.log('👤 检查 user_profiles 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id INT PRIMARY KEY,
                nickname VARCHAR(100),
                avatar_url VARCHAR(255),
                bio VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        // 自动为现有用户创建 profile
        console.log('🔄 同步缺失的用户资料...');
        await db.query(`
            INSERT IGNORE INTO user_profiles (user_id, nickname, avatar_url)
            SELECT id, username, '' FROM users
        `);

        console.log('\n✅ 所有社交模块表结构已就绪 (MySQL)!');

    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
    } finally {
        // 保持连接或者退出，视情况而定，这里直接退出进程
        process.exit();
    }
}

ensureSocialTables();