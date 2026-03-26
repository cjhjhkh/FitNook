const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fitnook.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. 确保 social_comments 表存在
    db.run(`CREATE TABLE IF NOT EXISTS social_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES social_posts(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error("创建 social_comments 表失败:", err.message);
        } else {
            console.log("social_comments 表检查完成（已存在或已创建）");
        }
    });

    // 2. 确保 favorites 表存在 (双重检查)
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_type TEXT NOT NULL, -- 'clothing', 'outfit', 'post'
        item_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_type, item_id)
    )`, (err) => {
        if (err) {
            console.error("创建 favorites 表失败:", err.message);
        } else {
            console.log("favorites 表检查完成");
        }
    });

    // 3. 确保 social_likes 表存在
    db.run(`CREATE TABLE IF NOT EXISTS social_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
    )`, (err) => {
         if (err) {
            console.error("创建 social_likes 表失败:", err.message);
        } else {
            console.log("social_likes 表检查完成");
        }
    });
});

db.close();
