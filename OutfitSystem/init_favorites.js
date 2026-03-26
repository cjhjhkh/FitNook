const db = require('./config/db');

async function initFavoritesTable() {
    try {
        console.log('🚀 开始初始化收藏夹表...');
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS favorites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL COMMENT '用户ID',
                item_type ENUM('clothing', 'outfit', 'post', 'diary') NOT NULL COMMENT '收藏项类型',
                item_id INT NOT NULL COMMENT '收藏项ID',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_favorite (user_id, item_type, item_id),
                INDEX idx_user_type (user_id, item_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收藏表';
        `;

        await db.query(createTableQuery);
        console.log('✅ favorites 表创建成功');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        process.exit(1);
    }
}

initFavoritesTable();
