const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fitnook.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 检查 source 字段
    db.all("PRAGMA table_info(outfits)", (err, columns) => {
        if (err) {
            console.error("无法获取表信息:", err);
            return;
        }
        
        const hasSource = columns.some(col => col.name === 'source');
        
        if (!hasSource) {
            console.log("正在添加 source 字段到 outfits 表...");
            db.run("ALTER TABLE outfits ADD COLUMN source TEXT DEFAULT 'USER'", (err) => {
                if (err) {
                    console.error("添加字段失败:", err.message);
                } else {
                    console.log("成功添加 source 字段");
                }
            });
        } else {
            console.log("source 字段已存在");
        }
    });
});

db.close();