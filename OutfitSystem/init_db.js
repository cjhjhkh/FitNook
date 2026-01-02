const db = require('./config/db');
const bcrypt = require('bcryptjs');

async function initDB() {
    const connection = await db.getConnection();
    try {
        console.log('🚀 开始初始化数据库...');
        
        // 1. 禁用外键检查
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. 清空旧表 (如果存在)
        const tables = [
            'chat_logs', 'chat_sessions', 'notifications', 'follows', 'interactions', 
            'comments', 'posts', 'ai_fav_collections', 'diaries', 'suitcase_details', 
            'suitcases', 'outfit_canvas', 'outfits', 'entity_tag_relation', 'tags', 
            'clothes', 'user_profiles', 'users',
            // 清理旧版可能存在的表
            'cloth_scene_relation', 'cloth_season_relation', 'scenes', 'seasons', 'categories'
        ];
        
        for (const table of tables) {
            await connection.query(`DROP TABLE IF EXISTS ${table}`);
            console.log(`🗑️  已删除表: ${table}`);
        }

        // 3. 创建新表
        console.log('🔨 正在创建新表结构...');

        // 3.1 用户基础与画像
        await connection.query(`
            CREATE TABLE users (
                id bigint NOT NULL AUTO_INCREMENT COMMENT '用户ID',
                account varchar(50) NOT NULL UNIQUE COMMENT '账号',
                password varchar(255) NOT NULL COMMENT '密码',
                is_profile_completed tinyint(1) DEFAULT 0 COMMENT '是否已填资料',
                registration_time timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
                PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户基础信息表';
        `);

        await connection.query(`
            CREATE TABLE user_profiles (
                user_id bigint NOT NULL COMMENT '用户ID (FK)',
                nickname varchar(50) DEFAULT NULL COMMENT '昵称',
                avatar_url varchar(255) DEFAULT NULL COMMENT '头像',
                signature varchar(255) DEFAULT NULL COMMENT '个性签名',
                gender enum('MALE','FEMALE','OTHER','SECRET') DEFAULT 'SECRET' COMMENT '性别',
                birthday date DEFAULT NULL COMMENT '生日',
                height decimal(5,2) DEFAULT NULL COMMENT '身高(cm)',
                weight decimal(5,2) DEFAULT NULL COMMENT '体重(kg)',
                body_shape varchar(50) DEFAULT NULL COMMENT '体型',
                style_preference varchar(100) DEFAULT NULL COMMENT '风格偏好',
                skin_tone varchar(50) DEFAULT NULL COMMENT '肤色',
                following_count int DEFAULT 0 COMMENT '关注数',
                follower_count int DEFAULT 0 COMMENT '粉丝数',
                PRIMARY KEY (user_id),
                CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户详细画像表';
        `);

        // 3.2 衣橱、标签与穿搭
        await connection.query(`
            CREATE TABLE clothes (
                id bigint NOT NULL AUTO_INCREMENT COMMENT '单品ID',
                user_id bigint NOT NULL COMMENT '所属用户',
                name varchar(100) DEFAULT '未命名' COMMENT '名称',
                image_url varchar(255) NOT NULL COMMENT '单品图片',
                price decimal(10,2) DEFAULT 0.00 COMMENT '价格',
                wear_count int DEFAULT 0 COMMENT '穿着次数',
                cost_per_wear decimal(10,2) GENERATED ALWAYS AS (price / NULLIF(wear_count, 0)) VIRTUAL COMMENT '虚拟列:单次成本',
                color varchar(50) DEFAULT NULL COMMENT '颜色',
                material varchar(50) DEFAULT NULL COMMENT '材质',
                location varchar(100) DEFAULT NULL COMMENT '物理位置',
                remarks text COMMENT '自定义备注',
                record_time timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '录入时间',
                PRIMARY KEY (id),
                KEY idx_clothes_user (user_id),
                CONSTRAINT fk_clothes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='衣橱单品表';
        `);

        await connection.query(`
            CREATE TABLE tags (
                tag_id bigint NOT NULL AUTO_INCREMENT COMMENT '标签ID',
                creator_id bigint DEFAULT NULL COMMENT '创建者ID(系统标签则为空)',
                tag_name varchar(50) NOT NULL COMMENT '标签名',
                tag_type enum('SEASON','CATEGORY','SCENE') NOT NULL COMMENT '类型',
                PRIMARY KEY (tag_id),
                KEY idx_tag_type (tag_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签库';
        `);

        await connection.query(`
            CREATE TABLE entity_tag_relation (
                entity_id bigint NOT NULL COMMENT '实体ID(单品或穿搭ID)',
                tag_id bigint NOT NULL COMMENT '标签ID',
                entity_type enum('ITEM','OUTFIT') NOT NULL COMMENT '实体类型',
                PRIMARY KEY (entity_id,tag_id,entity_type),
                CONSTRAINT fk_rel_tag FOREIGN KEY (tag_id) REFERENCES tags (tag_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签关联中间表';
        `);

        // 4. 预填数据
        console.log('🌱 正在写入初始数据...');

        // 4.1 写入标签 (分类、场景、季节)
        const categories = ['上衣', '裤装', '裙装', '外套', '鞋靴', '包袋', '配饰'];
        const scenes = ['通勤', '约会', '休闲', '运动', '居家', '派对', '旅行'];
        const seasons = ['春', '夏', '秋', '冬'];

        for (const name of categories) {
            await connection.query(`INSERT INTO tags (tag_name, tag_type) VALUES (?, 'CATEGORY')`, [name]);
        }
        for (const name of scenes) {
            await connection.query(`INSERT INTO tags (tag_name, tag_type) VALUES (?, 'SCENE')`, [name]);
        }
        for (const name of seasons) {
            await connection.query(`INSERT INTO tags (tag_name, tag_type) VALUES (?, 'SEASON')`, [name]);
        }

        // 4.2 创建测试账号
        const hashedPassword = await bcrypt.hash('123456', 10);
        await connection.query(`INSERT INTO users (account, password, is_profile_completed) VALUES ('11', ?, 1)`, [hashedPassword]);
        
        // 获取刚插入的用户ID
        const [userRows] = await connection.query(`SELECT id FROM users WHERE account = '11'`);
        const userId = userRows[0].id;

        // 插入用户画像
        await connection.query(`INSERT INTO user_profiles (user_id, nickname) VALUES (?, '测试用户')`, [userId]);

        console.log('✅ 数据库初始化完成！');
        console.log('🔑 测试账号: 11 / 123456');

    } catch (err) {
        console.error('❌ 初始化失败:', err);
    } finally {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        connection.release();
        process.exit();
    }
}

initDB();