const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// --- 1. 中间件配置 ---
app.use(cors()); // 允许 Uniapp 跨域访问
app.use(express.json()); // 解析 JSON 格式请求体
app.use(express.urlencoded({ extended: true })); // 解析 URL 编码请求体

// 静态资源托管（用于本地备份或临时文件查看）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 2. 导入路由 ---
// 确保 routes 文件夹下有对应的 user.js 和 clothes.js
const userRouter = require('./routes/user');
const clothesRouter = require('./routes/clothes'); 

// --- 3. 挂载路由 ---
// 这里的第一个参数决定了前端请求的基础路径
app.use('/api/user', userRouter);       // 对应前端: http://localhost:3000/api/user/...
app.use('/api/clothes', clothesRouter); // 对应前端: http://localhost:3000/api/clothes/...

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
app.listen(PORT, () => {
    console.log('===========================================');
    console.log(`✅ Chammy，衣橱系统后端启动成功！`);
    console.log(`🚀 服务运行在: http://localhost:${PORT}`);
    console.log(`📂 路由注册状态: `);
    console.log('===========================================');
});