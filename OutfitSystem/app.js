const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db'); // 引入数据库连接

const app = express();

// --- 自动修复脚本：启动时检查并修复旧的图片链接 ---
async function autoFixImageUrls() {
    console.log('🔄 开始执行图片链接自动修复...');
    try {
        const connection = await db.getConnection();
        
        // 查找所有包含 :9000 或 :20012 的旧记录
        const [clothes] = await connection.query('SELECT id, image_url FROM clothes WHERE image_url LIKE "%:9000%" OR image_url LIKE "%:20012%"');
        
        if (clothes.length > 0) {
            console.log(`🛠️ 发现 ${clothes.length} 条旧链接，正在批量替换...`);
            for (const item of clothes) {
                // 原链接示例: http://127.0.0.1:9000/wardrobe/111/filename.png
                // 我们只需要最后的文件名
                const parts = item.image_url.split('/');
                const filename = parts[parts.length - 1];
                
                // 新链接: http://localhost:3000/uploads/wardrobe/filename.png
                // 注意：这里假设您新上传的文件是扁平化存放的，没有子目录
                const newUrl = `http://localhost:3000/uploads/wardrobe/${filename}`;
                
                await connection.query('UPDATE clothes SET image_url = ? WHERE id = ?', [newUrl, item.id]);
                console.log(`   - 修复 ID ${item.id}: .../${filename}`);
            }
        } else {
            console.log('✅ 数据库中未发现需要修复的旧链接。');
        }

        // 同时也修复 outfit_items 表
        const [items] = await connection.query('SELECT id, image_url FROM outfit_items WHERE image_url LIKE "%:9000%" OR image_url LIKE "%:20012%"');
        if (items.length > 0) {
             console.log(`🛠️ 修复 ${items.length} 条搭配单品链接...`);
             for (const item of items) {
                const parts = item.image_url.split('/');
                const filename = parts[parts.length - 1];
                const newUrl = `http://localhost:3000/uploads/wardrobe/${filename}`;
                await connection.query('UPDATE outfit_items SET image_url = ? WHERE id = ?', [newUrl, item.id]);
            }
        }

        connection.release();
    } catch (e) {
        console.error('❌ 自动修复失败:', e.message);
    }
}

// 执行修复 (不阻塞启动，但在接收请求前执行)
autoFixImageUrls();

// -----------------------------------------------------------

// --- 1. 中间件配置 ---
app.use(cors()); // 允许 Uniapp 跨域访问
app.use(express.json()); // 解析 JSON 格式请求体
app.use(express.urlencoded({ extended: true })); // 解析 URL 编码请求体

// 静态资源托管（用于本地备份或临时文件查看）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 配置静态资源服务 (关键：确保上传的图片可以访问)
const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

// --- 2. 导入路由 ---
// 确保 routes 文件夹下有对应的 user.js 和 clothes.js
const userRouter = require('./routes/user');
const clothesRouter = require('./routes/clothes'); 
const outfitRouter = require('./routes/outfit'); 
const uploadRouter = require('./routes/upload'); // 引入上传路由
const diaryRouter = require('./routes/diary'); // 引入日记路由
const suitcaseApiRouter = require('./routes/suitcase_api'); // 引入行李箱简单路由
const chatRouter = require('./routes/chat'); // 引入 AI 对话路由
const analyticsRouter = require('./routes/analytics'); // 引入统计与灵感路由
const recommendationRouter = require('./routes/recommendation'); // 引入推荐路由
const socialRouter = require('./routes/social'); // 引入社交模块路由
const favoritesRouter = require('./routes/favorites'); // 引入收藏夹路由

// --- 3. 挂载路由 ---
// 这里的第一个参数决定了前端请求的基础路径
app.use('/api/user', userRouter);       // 对应前端: http://localhost:3000/api/user/...
app.use('/api/clothes', clothesRouter); // 对应前端: http://localhost:3000/api/clothes/...
app.use('/api/outfits', outfitRouter);  
app.use('/api/upload', uploadRouter);   // 挂载上传接口
app.use('/api/diary', diaryRouter);     // 日记接口
app.use('/api/suitcases', suitcaseApiRouter); // 行李箱接口
app.use('/api/chat', chatRouter);       // 挂载 AI 对话接口
app.use('/api/analytics', analyticsRouter); // 挂载统计与灵感接口
app.use('/api/recommendation', recommendationRouter); // 挂载推荐接口
app.use('/api/social', socialRouter);   // 挂载社交接口
app.use('/api/favorites', favoritesRouter); // 挂载收藏夹接口

// --- 4. 404 捕获 (处理未定义的路径) ---
app.use((req, res, next) => {
    res.status(404).json({ code: 404, msg: '请求的接口路径不存在' });
});

// --- 5. 全局错误处理 ---
app.use((err, req, res, next) => {
    console.error('服务器运行报错:', err.stack);
    res.status(500).json({
        code: 500,
        msg: '服务器内部错误',
        error: err.message
    });
});

// --- 6. 启动服务 ---
const PORT = 3000;
app.listen(PORT, async () => { // 增加 async
    console.log('===========================================');
    console.log(`✅ Chammy，衣橱系统后端启动成功！`);
    console.log(`🚀 服务运行在: http://localhost:${PORT}`);
    console.log(`📂 路由注册状态: `);
    console.log('===========================================');
});