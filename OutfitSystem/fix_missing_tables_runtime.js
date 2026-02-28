const db = require('./config/db');

async function fixTables() {
    try {
        console.log('开始检查并修复缺失的数据库表...');

        // 1. 创建 suitcases 表
        console.log('检查 suitcases 表...');
        await db.query(`
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
        console.log('✅ suitcases 表准备就绪');

        // 2. 创建 outfit_calendar 表 (作为补充，防止日历功能也报错)
        console.log('检查 outfit_calendar 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS outfit_calendar (
                id bigint NOT NULL AUTO_INCREMENT,
                user_id bigint NOT NULL COMMENT '用户ID',
                outfit_id bigint NOT NULL COMMENT '穿搭ID',
                date date NOT NULL COMMENT '日期',
                created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_calendar_user_date (user_id, date),
                CONSTRAINT fk_calendar_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT fk_calendar_outfit FOREIGN KEY (outfit_id) REFERENCES outfits (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='穿搭日历表';
        `);
        console.log('✅ outfit_calendar 表准备就绪');

        console.log('所有修复已完成。');
        process.exit(0);
    } catch (err) {
        console.error('修复过程中发生错误:', err);
        process.exit(1);
    }
}

fixTables();
