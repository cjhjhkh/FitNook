const db = require('./config/db');

async function createChatTables() {
    const connection = await db.getConnection();
    try {
        console.log('开始检查并创建 AI 聊天相关表...');

        // 1. 会话表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_account VARCHAR(255) NOT NULL,
                title VARCHAR(255) DEFAULT '新建会话',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user (user_account)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ chat_sessions 表就绪');

        // 2. 聊天记录表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS chat_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                sender_role ENUM('user', 'assistant', 'system') NOT NULL,
                msg_type VARCHAR(50) DEFAULT 'text', -- text, outfit_card, image
                content TEXT,
                meta_json JSON COMMENT '存储结构化数据，如推荐的衣物ID列表',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session (session_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ chat_logs 表就绪');

        // 3. AI 收藏表 (用于收藏 AI 推荐的搭配)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ai_fav_collections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_account VARCHAR(255) NOT NULL,
                from_source VARCHAR(50) DEFAULT 'chat', -- chat, inspiration
                source_id INT COMMENT '来源记录ID，如 chat_logs.id',
                items_json JSON NOT NULL COMMENT '包含搭配单品的完整信息',
                title VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_account)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ ai_fav_collections 表就绪');

    } catch (err) {
        console.error('❌ 建表失败:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

createChatTables();