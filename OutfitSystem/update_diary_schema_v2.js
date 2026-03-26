const db = require('./config/db');

async function updateDiarySchema() {
  try {
    console.log('开始检查 diaries 表结构...');
    
    // 检查 linked_items 字段是否存在 (简单起见，直接尝试添加列，如果报错说明已存在，或者查一下)
    // 这里使用 INFORMATION_SCHEMA 更稳妥
    const [rows] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'diaries' AND COLUMN_NAME = 'linked_items'
    `);

    if (rows.length === 0) {
      console.log('正在添加 linked_items 字段...');
      await db.query(`
        ALTER TABLE diaries
        ADD COLUMN linked_items JSON NULL COMMENT '关联的物品列表'
      `);
      console.log('linked_items 字段添加成功');
    } else {
      console.log('linked_items 字段已存在，跳过');
    }

    console.log('数据库结构更新完成');
    process.exit(0);
  } catch (err) {
    console.error('更新失败:', err);
    process.exit(1);
  }
}

updateDiarySchema();
