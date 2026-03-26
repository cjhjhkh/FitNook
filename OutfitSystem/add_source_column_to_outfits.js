const db = require('./config/db');

async function addSourceColumn() {
    console.log('开始检查 outfits 表是否需要添加 source 字段...');
    
    const connection = await db.getConnection();
    try {
        // 检查字段是否存在
        const [columns] = await connection.query("SHOW COLUMNS FROM outfits LIKE 'source'");
        
        if (columns.length === 0) {
            console.log('正在添加 source 字段...');
            // 添加 source 字段，默认为 'USER' (普通用户创建)
            await connection.query("ALTER TABLE outfits ADD COLUMN source VARCHAR(50) DEFAULT 'USER' COMMENT '来源: USER-用户创建, INSPIRATION-灵感收藏'");
            console.log('添加成功！');
        } else {
            console.log('source 字段已存在，跳过。');
        }

        // 验证
        const [cols] = await connection.query("SHOW COLUMNS FROM outfits");
        console.log('当前 outfits 表结构字段:', cols.map(c => c.Field));

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

addSourceColumn();