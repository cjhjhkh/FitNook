const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config.js'); // Assuming typical config path, need to check if it matches

// Try to load db config, fallback if not found or different structure
let pool;
try {
    const db = require('./config/db');
    pool = db;
} catch (e) {
    console.error("Could not load db module, trying direct config");
    // Fallback logic if needed, but 'db' module is likely available based on previous context
}

async function ensureSocialTables() {
    console.log('开始检查社交功能数据库表结构...');
    let connection;

    try {
        if (!pool) {
             const db = require('./config/db');
             pool = db;
        }
        connection = await pool.getConnection();

        // 1. 检查并创建 social_posts 表
        console.log('检查 social_posts 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255),
                content TEXT,
                image_urls TEXT,
                views INT DEFAULT 0,
                likes INT DEFAULT 0,
                comments INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 检查 social_posts 列是否存在
        const [postColumns] = await connection.query("SHOW COLUMNS FROM social_posts");
        const postColumnNames = postColumns.map(c => c.Field);
        
        if (!postColumnNames.includes('image_urls')) {
            console.log('添加 image_urls 列到 social_posts...');
            await connection.query("ALTER TABLE social_posts ADD COLUMN image_urls TEXT");
        }
        if (!postColumnNames.includes('title')) {
             console.log('添加 title 列到 social_posts...');
             await connection.query("ALTER TABLE social_posts ADD COLUMN title VARCHAR(255)");
        }


        // 2. 检查并创建 social_comments 表
        console.log('检查 social_comments 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                content TEXT,
                parent_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_post_id (post_id),
                INDEX idx_parent_id (parent_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const [commentColumns] = await connection.query("SHOW COLUMNS FROM social_comments");
        const commentColumnNames = commentColumns.map(c => c.Field);

        if (!commentColumnNames.includes('parent_id')) {
            console.log('添加 parent_id 列到 social_comments...');
            await connection.query("ALTER TABLE social_comments ADD COLUMN parent_id INT DEFAULT NULL");
            // Check if index exists before adding? Usually safe to add if column added.
             try {
                await connection.query("CREATE INDEX idx_parent_id ON social_comments(parent_id)");
            } catch(e) { console.log('Index might already exist'); }
        }

        // 3. 检查 user_profiles 表
        console.log('检查 user_profiles 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id INT PRIMARY KEY,
                nickname VARCHAR(100),
                avatar_url VARCHAR(500),
                bio VARCHAR(500),
                height FLOAT,
                weight FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. 检查 favorites 表
         console.log('检查 favorites 表...');
         await connection.query(`
             CREATE TABLE IF NOT EXISTS favorites (
                 id INT AUTO_INCREMENT PRIMARY KEY,
                 user_id INT NOT NULL,
                 item_type VARCHAR(50) NOT NULL,
                 item_id INT NOT NULL,
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 UNIQUE KEY unique_fav (user_id, item_type, item_id)
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
         `);

        // 5. 检查 social_likes 表
        console.log('检查 social_likes 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (post_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        console.log('======================================');
        console.log('数据库结构检查与修复完成！全部通过。');
        console.log('======================================');

    } catch (err) {
        console.error('数据库检查出错:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

ensureSocialTables();
