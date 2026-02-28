const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /dashboard
 * 核心统计面板数据
 * 包含：各维度计数、季节分布、性价比排行(CPW)、主要色系
 */
router.get('/dashboard', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ code: 400, msg: 'Missing userId' });

    try {
        const [rows] = await db.query('SELECT * FROM clothes_view WHERE user_id = ?', [userId]);

        // 1. 基础计数
        const totalItems = rows.length;
        const totalValue = rows.reduce((acc, cur) => acc + (cur.price || 0), 0);
        
        // 2. 统计搭配总数
        const [outfits] = await db.query('SELECT COUNT(*) as cnt FROM outfits WHERE user_id = ?', [userId]);
        const totalOutfits = outfits[0].cnt;

        // 3. 季节分布 (Mock数据或基于 season_names 分析)
        // 假设 structure: { 'Spring': 10, 'Summer': 20... }
        const seasonStats = { '春': 0, '夏': 0, '秋': 0, '冬': 0 };
        rows.forEach(item => {
            if (item.season_names) {
                // season_names 可能是 "春,夏"
                if (item.season_names.includes('春')) seasonStats['春']++;
                if (item.season_names.includes('夏')) seasonStats['夏']++;
                if (item.season_names.includes('秋')) seasonStats['秋']++;
                if (item.season_names.includes('冬')) seasonStats['冬']++;
            }
        });

        // 4. 计算 CPW (Cost Per Wear)
        // 筛选 CPW 最低的Top 5 (最值回票价) 和 最高的Top 5 (吃灰)
        // 假设 item 有 wear_count
        let itemsWithCpw = rows.map(item => {
            const count = item.wear_count || 1; // 避免除以0，默认为1次
            const price = item.price || 0;
            return {
                id: item.id,
                name: item.name,
                image: item.image_url,
                cpw: price / count,
                wear_count: item.wear_count || 0
            };
        });
        
        // 排序
        itemsWithCpw.sort((a, b) => a.cpw - b.cpw);
        const bestValueItems = itemsWithCpw.slice(0, 5);
        const worstValueItems = itemsWithCpw.slice(-5).reverse(); // 反转，展示最贵的

        // 5. 颜色分布 (Mock: 假设有 color 字段)
        // 简单统计出现最多的颜色
        const colorCount = {};
        let colorItemsCount = 0;

        rows.forEach(item => {
            if (item.color) {
                colorCount[item.color] = (colorCount[item.color] || 0) + 1;
                colorItemsCount++;
            }
        });

        // 转为百分比数组
        const colors = Object.keys(colorCount).map(color => ({
            color: colorToHex(color), // 辅助函数转换中文颜色到Hex
            name: color,
            percent: colorItemsCount > 0 ? (colorCount[color] / colorItemsCount) : 0
        })).sort((a, b) => b.percent - a.percent).slice(0, 5); // 取前5色

        res.json({
            code: 200,
            data: {
                stats: {
                    totalItems,
                    totalOutfits,
                    totalValue
                },
                seasons: seasonStats,
                cpw: {
                    best: bestValueItems,
                    worst: worstValueItems
                },
                colors
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, error: err.message });
    }
});

/**
 * GET /recommendation
 * 首页灵感推荐流
 */
router.get('/recommendation', async (req, res) => {
    // 这里暂时返回 Mock 数据，后续可基于 Python 算法服务
    res.json({
        code: 200,
        data: {
            recommend: [
                { id: 1, title: '唤醒旧衣', reason: '这件牛仔外套你很久没穿了', image_url: '/static/image/clothing1.png', tags: ['旧衣新搭'] },
                { id: 2, title: '明日穿搭', reason: '适合明天的多云天气', image_url: '/static/image/clothing2.png', tags: ['通勤'] }
            ],
            explore: [
                { id: 3, title: '美拉德风', style: '复古/棕色系', image_url: '/static/image/clothing3.png' },
                { id: 4, title: '多巴胺穿搭', style: '高饱和/撞色', image_url: '/static/image/clothing1.png' }
            ]
        }
    });
});

// 辅助：中文颜色转 Hex (简化版)
function colorToHex(cnName) {
    const map = {
        '黑': '#333333', '白': '#F5F5F5', '灰': '#999999',
        '红': '#FF5252', '蓝': '#448AFF', '绿': '#69F0AE',
        '黄': '#FFD740', '紫': '#E040FB', '粉': '#FF80AB',
        '棕': '#795548', '米': '#FFE0B2', '橙': '#FFAB40'
    };
    for (const key in map) {
        if (cnName.includes(key)) return map[key];
    }
    return '#E0E0E0'; // 默认灰
}

module.exports = router;