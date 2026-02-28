const mysql = require('mysql2/promise');
const dbConfig = require('./config/db');

// 正确提取数据库配置
const config = {
    host: dbConfig.pool.config.connectionConfig.host,
    user: dbConfig.pool.config.connectionConfig.user,
    password: dbConfig.pool.config.connectionConfig.password,
    database: dbConfig.pool.config.connectionConfig.database
};

const createTablesSql = [
    // 1. 创建会话表
    `CREATE TABLE IF NOT EXISTS chat_sessions (
        session_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(100) DEFAULT '新对话',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    // 2. 创建消息记录表 (包含快照和关联实体)
    `CREATE TABLE IF NOT EXISTS chat_logs (
        msg_id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        sender_role ENUM('user', 'assistant', 'system') NOT NULL,
        msg_type ENUM('text', 'image', 'voice', 'outfit_card') DEFAULT 'text',
        content TEXT,
        media_url VARCHAR(255),
        linked_entities JSON COMMENT '关联的单品ID列表 [1, 2]',
        user_profile_snapshot JSON COMMENT '当时的画像快照',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
    );`,

    // 3. 创建 AI 灵感收藏表 (闭环数据)
    `CREATE TABLE IF NOT EXISTS ai_fav_collections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        outfit_image_url VARCHAR(255) COMMENT 'AI生成的合成图',
        recommend_reason TEXT COMMENT '推荐理由',
        linked_items JSON COMMENT '涉及的单品ID',
        category VARCHAR(50) DEFAULT 'other' COMMENT 'internal_match, style_explore, etc',
        user_profile_snapshot JSON COMMENT '收藏时的画像',
        prompt_used TEXT COMMENT '生成时的提示词',
        scene_context VARCHAR(100) COMMENT '场景上下文',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`
];

async function runMigration() {
    let connection;
    try {
        console.log('正在连接数据库...');
        connection = await mysql.createConnection(config);
        
        console.log('开始更新数据库 Schema...');
        for (const sql of createTablesSql) {
            await connection.query(sql);
            console.log('✅ 执行成功');
        }
        
        console.log('🎉 数据库 ChatAI 模块相关表更新完毕！');
    } catch (err) {
        console.error('❌ 数据库更新失败:', err);
    } finally {
        if (connection) await connection.end();
    }
}

runMigration();
