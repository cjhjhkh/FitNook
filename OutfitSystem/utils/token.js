const jwt = require('jsonwebtoken');
// 简单的密钥配置，实际项目中建议放入环境变量或配置文件
const SECRET_KEY = 'fitnook_secret_key_2026'; 

const generateToken = (payload) => {
    // Token 有效期 7 天
    return jwt.sign(payload, SECRET_KEY, { expiresIn: '7d' });
};

const verifyToken = (token) => {
    try {
        if (!token) return null;
        // 兼容 Bearer 开头的 token
        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length).trim();
        }
        return jwt.verify(token, SECRET_KEY);
    } catch (err) {
        return null; // 验证失败或过期
    }
};

// Express 中间件：验证 Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // 允许 "/daily" 接口在没有 token 时也能访问 (可选)
    // 或者严格要求：前端 daily-recommendation.vue 必须带 token
    // 目前看 403 Forbidden 说明带了 token 但是验证失败，或者后端没拿到 token。
    
    // 调试日志
    // console.log('Auth Header:', authHeader);

    if (!token) {
        // 对于部分页面可能是游客访问，这里严格要求登录，返回 401
        return res.sendStatus(401);
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('Token Verify Error:', err.message);
            return res.sendStatus(403); // 禁止访问 (Token 无效)
        }
        req.user = user;
        next();
    });
};

module.exports = {
    generateToken,
    verifyToken,
    authenticateToken, // 导出中间件
    SECRET_KEY
};
