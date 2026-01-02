const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs'); // 用于密码加密
const jwt = require('jsonwebtoken');   // 用于生成登录令牌

const JWT_SECRET = 'closet_secret_key_2024';// 自定义密钥，用于加密 Token

/**
 * [注册接口]
 * 逻辑：接收参数 -> 校验一致性 -> 查重 -> 加密 -> 存库
 */
router.post('/register', async (req, res) => {
    const { account, password, confirmPassword } = req.body;

    // 1. 基础校验
    if (!account || !password || !confirmPassword) {
        return res.json({ code: 400, msg: '输入不能为空' });
    }
    if (password !== confirmPassword) {
        return res.json({ code: 400, msg: '两次密码输入不一致' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 2. 检查账号是否被占用
        const [userExists] = await connection.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userExists.length > 0) {
            await connection.rollback();
            return res.json({ code: 400, msg: '该账号已被注册' });
        }

        // 3. 密码加密
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. 存入 users 表 (移除 is_profile_completed)
        const [result] = await connection.query(
            'INSERT INTO users (account, password) VALUES (?, ?)', 
            [account, hashedPassword]
        );
        const newUserId = result.insertId;

        // 5. 初始化 user_profiles 表 (确保每个用户都有一行画像记录)
        await connection.query('INSERT INTO user_profiles (user_id, nickname) VALUES (?, ?)', [newUserId, `用户${account.slice(-4)}`]);

        await connection.commit();
        res.json({ code: 200, msg: '注册成功' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message });
    } finally {
        connection.release();
    }
});

/**
 * [登录接口]
 * 逻辑：查库 -> 校验加密密码 -> 生成 Token
 */
router.post('/login', async (req, res) => {
    const { account, password } = req.body;

    try {
        // 1. 根据账号找人 (联表查询获取昵称和画像信息)
        // 增加查询 style_preference 以判断资料是否完善
        const [rows] = await db.query(`
            SELECT u.*, p.nickname, p.avatar_url, p.style_preference
            FROM users u 
            LEFT JOIN user_profiles p ON u.id = p.user_id 
            WHERE u.account = ?
        `, [account]);

        if (rows.length === 0) {
            return res.json({ code: 400, msg: '用户不存在' });
        }

        const user = rows[0];

        // 2. 校验密码
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ code: 400, msg: '密码错误' });
        }

        // 3. 生成身份 Token
        const token = jwt.sign(
            { id: user.id, account: user.account },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 动态判断是否完成资料：如果 style_preference 有值，则认为已完成
        const isProfileCompleted = user.style_preference ? 1 : 0;

        res.json({
            code: 200,
            msg: '登录成功',
            token,
            userInfo: {
                id: user.id,
                account: user.account,
                nickname: user.nickname || `用户${user.account}`,
                avatar_url: user.avatar_url,
                is_profile_completed: isProfileCompleted
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '登录失败' });
    }
});

/**
 * [完善个人资料接口]
 * 逻辑：接收身材偏好数据 -> 更新 user_profiles
 */
router.put('/profile', async (req, res) => {
    // 1. 获取前端传来的数据
    const { 
        account, 
        nickname, 
        gender, 
        height, 
        weight, 
        body_shape, 
        style_preference 
    } = req.body;

    if (!account) {
        return res.json({ code: 400, msg: '参数错误：账号不能为空' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 2. 获取用户ID
        const [userRows] = await connection.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userRows.length === 0) {
            await connection.rollback();
            return res.json({ code: 404, msg: '未找到对应账号' });
        }
        const userId = userRows[0].id;

        // 3. 更新 user_profiles 表
        const updateProfileSql = `
            UPDATE user_profiles 
            SET nickname = ?, 
                gender = ?, 
                height = ?, 
                weight = ?, 
                body_shape = ?, 
                style_preference = ?
            WHERE user_id = ?
        `;
        await connection.query(updateProfileSql, [
            nickname || null, 
            gender || 'SECRET', 
            height || null, 
            weight || null, 
            body_shape || null, 
            style_preference || null, 
            userId
        ]);

        await connection.commit();
        res.json({
            code: 200,
            msg: '个人资料同步成功！'
        });

    } catch (err) {
        await connection.rollback();
        console.error('更新资料出错：', err);
        res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;