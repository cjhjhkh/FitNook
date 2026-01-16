const db = require('./config/db');

async function fix() {
    try {
        console.log('🚀 开始修复数据库字段...');
        
        // 1. 修复 outfit_items 表
        try {
            await db.query("ALTER TABLE outfit_items ADD COLUMN image_url varchar(255) DEFAULT NULL COMMENT '单品图片快照'");
            console.log("✅ outfit_items: image_url 字段添加成功");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ outfit_items: image_url 字段已存在");
            } else {
                console.error("❌ outfit_items 错误:", e.message);
            }
        }

        // 2. 修复 outfits 表
        const outfitFields = [
            { name: 'image_url', type: 'varchar(255)', comment: '穿搭预览图' },
            { name: 'bg_color', type: 'varchar(20)', comment: '背景颜色' },
            { name: 'weather', type: 'varchar(50)', comment: '天气' },
            { name: 'temperature', type: 'varchar(20)', comment: '温度' }
        ];

        for (const field of outfitFields) {
            try {
                await db.query(`ALTER TABLE outfits ADD COLUMN ${field.name} ${field.type} DEFAULT NULL COMMENT "${field.comment}"`);
                console.log(`✅ outfits: ${field.name} 字段添加成功`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️ outfits: ${field.name} 字段已存在`);
                } else {
                    console.error(`❌ outfits ${field.name} 错误:`, e.message);
                }
            }
        }

        console.log('🎉 数据库修复脚本执行完毕');
    } catch (err) {
        console.error("全局错误:", err);
    } finally {
        process.exit();
    }
}

fix();
