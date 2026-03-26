const db = require('./config/db');

(async () => {
    try {
        const [rows] = await db.query('DESCRIBE favorites');
        console.log('✅ favorites 表结构:', rows);
        process.exit(0);
    } catch (error) {
        console.error('❌ 获取表结构失败:', error.message);
        
        // 如果表不存在，尝试创建
        if (error.code === 'ER_NO_SUCH_TABLE') {
             console.log('⚠️ favorites 表不存在，正在创建...');
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
            try {
                await db.query(createTableQuery);
                console.log('✅ favorites 表创建成功');
            } catch (createError) {
                console.error('❌ 创建表失败:', createError);
            }
        }
        process.exit(1);
    }
})();
