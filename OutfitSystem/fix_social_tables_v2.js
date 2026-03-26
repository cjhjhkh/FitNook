const db = require('./config/db');

async function fixSocialTables() {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('🚀 开始修复社区表结构...');

        // 1. 检查 posts 表的 image_url 字段
        console.log('检查 posts 表...');
        const [postsColumns] = await connection.query("SHOW COLUMNS FROM posts LIKE 'image_url'");
        if (postsColumns.length === 0) {
            console.log('⚠️ posts 表缺少 image_url 字段，正在添加...');
            // 添加 image_url 字段，用于存储主图/封面图
            await connection.query("ALTER TABLE posts ADD COLUMN image_url VARCHAR(255) DEFAULT NULL COMMENT '主图/封面' AFTER content");
            console.log('✅ image_url 字段添加成功');
        } else {
            console.log('✅ posts 表已有 image_url 字段');
        }

        // 2. 检查 likes 表是否存在
        console.log('检查 likes 表...');
        const [likesTables] = await connection.query("SHOW TABLES LIKE 'likes'");
        if (likesTables.length === 0) {
            console.log('⚠️ likes 表不存在，正在创建...');
            await connection.query(`
                CREATE TABLE likes (
                    id bigint NOT NULL AUTO_INCREMENT,
                    user_id bigint NOT NULL,
                    target_id bigint NOT NULL COMMENT '目标ID(帖子ID/评论ID)',
                    target_type enum('POST','COMMENT') DEFAULT 'POST',
                    created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uniq_user_target (user_id, target_id, target_type),
                    KEY idx_likes_target (target_id, target_type),
                    CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点赞记录表';
            `);
            console.log('✅ likes 表创建成功');
        } else {
            console.log('✅ likes 表已存在');
        }

        // 3. 检查 user_profiles 表是否存在 (路由中用到了)
        console.log('检查 user_profiles 表...');
        const [profileTables] = await connection.query("SHOW TABLES LIKE 'user_profiles'");
        if (profileTables.length === 0) {
             console.log('⚠️ user_profiles 表不存在，正在创建...');
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
             console.log('✅ user_profiles 表创建成功');
             
             // 尝试为现有用户创建默认 profile
             console.log('正在为现有用户生成默认 profile...');
             await connection.query(`
                INSERT IGNORE INTO user_profiles (user_id, nickname, avatar_url)
                SELECT id, CONCAT('用户', id), 'https://via.placeholder.com/150' FROM users
             `);
        } else {
            console.log('✅ user_profiles 表已存在');
        }

        console.log('🎉 所有表结构修复完成！');

    } catch (err) {
        console.error('❌ 修复失败:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

fixSocialTables();