const db = require('./config/db');

async function fixTable() {
    const connection = await db.getConnection();
    try {
        console.log('🚀 正在修复缺失的 suitcases 表...');
        
        // 创建 suitcases 表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS suitcases (
                id bigint NOT NULL AUTO_INCREMENT COMMENT '行李箱ID',
                user_id bigint NOT NULL COMMENT '所属用户',
                name varchar(100) NOT NULL COMMENT '行程名称',
                destination varchar(100) DEFAULT NULL COMMENT '目的地',
                start_date date DEFAULT NULL COMMENT '开始日期',
                end_date date DEFAULT NULL COMMENT '结束日期',
                description text COMMENT '备注说明',
                status enum('planning','departed','finished') DEFAULT 'planning' COMMENT '当前状态',
                items json DEFAULT NULL COMMENT '物品清单 JSON',
                outfits json DEFAULT NULL COMMENT '穿搭清单 JSON',
                created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                PRIMARY KEY (id),
                KEY idx_suitcases_user (user_id),
                CONSTRAINT fk_suitcases_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行李箱行程表';
        `);

        console.log('✅ suitcases 表创建成功！');

    } catch (err) {
        console.error('❌ 修复失败:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

fixTable();
