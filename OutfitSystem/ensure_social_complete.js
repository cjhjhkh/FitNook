const db = require('./config/db');

async function ensureSocialTables() {
    console.log('开始检查社区功能相关数据表...');

    const connection = await db.getConnection();

    try {
        // 1. 检查 social_posts 表
        console.log('检查 social_posts 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                outfit_id INT DEFAULT NULL,
                content TEXT,
                image_urls JSON DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_outfit (outfit_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. 检查 social_likes 表
        console.log('检查 social_likes 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, post_id),
                INDEX idx_post (post_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. 检查 social_comments 表
        console.log('检查 social_comments 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_post (post_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. 检查 favorites 表 (确保收藏功能可用)
        console.log('检查 favorites 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                item_type ENUM('clothing', 'outfit', 'post') NOT NULL,
                item_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_fav (user_id, item_type, item_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('✅ 所有社交功能相关数据表检查完毕！');

    } catch (error) {
        console.error('❌ 初始化数据库表失败:', error);
    } finally {
        connection.release();
        process.exit(); 
    }
}

ensureSocialTables();
