const db = require('./config/db');

async function addLinkedItemsColumn() {
  try {
    const [columns] = await db.query("SHOW COLUMNS FROM diaries LIKE 'linked_items'");
    if (columns.length === 0) {
      console.log('正在添加 linked_items 字段...');
      await db.query("ALTER TABLE diaries ADD COLUMN linked_items JSON COMMENT '关联的穿搭ID列表'");
      console.log('添加成功');
    } else {
      console.log('linked_items 字段已存在，跳过');
    }
    process.exit(0);
  } catch (err) {
    console.error('数据库更新失败:', err);
    process.exit(1);
  }
}

addLinkedItemsColumn();
