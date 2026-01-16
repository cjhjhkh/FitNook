const db = require('./config/db');

async function addOutfitImageColumn() {
    console.log('开始添加 outfit.image_url 字段...');
    const connection = await db.getConnection();
    try {
        // 检查字段是否存在
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'outfits' 
              AND COLUMN_NAME = 'image_url'
        `);

        if (columns.length === 0) {
            await connection.query(`
                ALTER TABLE outfits 
                ADD COLUMN image_url VARCHAR(255) DEFAULT NULL COMMENT '穿搭合成预览图' AFTER name
            `);
            console.log('image_url 字段添加成功');
        } else {
            console.log('image_url 字段已存在，跳过');
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

addOutfitImageColumn();
