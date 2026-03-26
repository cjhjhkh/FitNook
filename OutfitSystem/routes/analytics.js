const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { callQwen } = require('../utils/ai');

// 辅助函数：颜色名称转 Hex (简化版映射)
function colorToHex(colorNameInput) {
    if (!colorNameInput) return '#CCCCCC';
    const colorName = colorNameInput.trim();
    const map = {
        '黑': '#333333', '白': '#F5F5F5', '灰': '#808080',
        '红': '#FF4D4F', '橙': '#FA8C16', '黄': '#FADB14',
        '绿': '#52C41A', '蓝': '#1890FF', '紫': '#722ED1',
        '粉': '#EB2F96', '卡其': '#D4B192', '棕': '#8B4513',
        '米': '#F5F5DC', '金': '#FFD700', '银': '#C0C0C0'
    };
    for (const key in map) {
        if (colorName.includes(key)) return map[key];
    }
    return '#E8E8E8'; // 默认浅灰
}

/**
 * GET /dashboard
 * 面板核心数据接口
 * 返回：衣橱总览、CPW分析、颜色分布、AI 诊断报告
 */
router.get('/dashboard', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ code: 400, msg: 'Missing userId' });
    }

    try {
        // 1. 获取基础数据 (并行查询以提升速度)
        // 修正：使用 JOIN 获取分类信息，同时获取季节和场景标签
        // 使用 GROUP_CONCAT 允许一件衣服有多个标签（如"春秋"）
        const sql = `
            SELECT c.*, 
                   GROUP_CONCAT(DISTINCT CASE WHEN t.tag_type = 'CATEGORY' THEN t.tag_name ELSE NULL END) as categories_str,
                   GROUP_CONCAT(DISTINCT CASE WHEN t.tag_type = 'SEASON' THEN t.tag_name ELSE NULL END) as seasons_str,
                   GROUP_CONCAT(DISTINCT CASE WHEN t.tag_type = 'SCENE' THEN t.tag_name ELSE NULL END) as scenes_str
            FROM clothes c
            LEFT JOIN entity_tag_relation etr ON c.id = etr.entity_id AND etr.entity_type = 'ITEM'
            LEFT JOIN tags t ON etr.tag_id = t.tag_id
            WHERE c.user_id = ?
            GROUP BY c.id
        `;
        const [clothesRows] = await db.query(sql, [userId]);
        
        const [outfitCountRows] = await db.query('SELECT COUNT(*) as cnt FROM outfits WHERE user_id = ?', [userId]);
        const totalOutfits = outfitCountRows[0].cnt;

        const totalItems = clothesRows.length;

        // 如果没有数据，直接返回空状态
        if (totalItems === 0) {
            return res.json({
                code: 200,
                data: {
                    stats: { totalItems: 0, totalValue: 0, totalOutfits: 0, wearRate: '0%' },
                    cpw: { best: [], worst: [] },
                    colors: [],
                    categories: [], 
                    seasons: [], // 新增
                    scenes: [], // 新增
                    aiDiagnosis: "您的衣橱还是空的，快去添加第一件衣服吧！FitNook 会帮你记录它的每一次闪亮登场。"
                }
            });
        }

        // 2. 数据处理与计算
        let totalValue = 0;
        let unwornCount = 0;
        const colorStats = {};
        const categoryStats = {};
        const seasonStats = {}; // 新增
        const sceneStats = {};  // 新增
        
        // 处理单品列表，计算 CPW
        const analyzedItems = clothesRows.map(item => {
            const price = parseFloat(item.price) || 0;
            const wearCount = parseInt(item.wear_count) || 0;
            
            // 累加总价值
            totalValue += price;
            
            // 统计未穿过的衣服
            if (wearCount === 0) unwornCount++;

            // 统计颜色
            if (item.color) {
                let mainColor = item.color; 
                colorStats[mainColor] = (colorStats[mainColor] || 0) + 1;
            }

            // 辅助统计函数
            const countTags = (str, statsObj) => {
                if (str) {
                    const tags = str.split(',');
                    tags.forEach(t => {
                        const val = t.trim();
                        if (val) statsObj[val] = (statsObj[val] || 0) + 1;
                    });
                } else {
                    const unknown = '未定义';
                    statsObj[unknown] = (statsObj[unknown] || 0) + 1;
                }
            };

            // 统计分类 (category)
            countTags(item.categories_str, categoryStats);
            // 统计季节 (season)
            countTags(item.seasons_str, seasonStats);
            // 统计场景 (scene)
            countTags(item.scenes_str, sceneStats);

            // 计算 CPW (Cost Per Wear)
            let cpw = 0;
            if (wearCount > 0) {
                cpw = price / wearCount;
            } else {
                cpw = price; // 没穿过，成本就是原价
            }

            return {
                id: item.id,
                name: item.name,
                image_url: item.image, // 修正：前端使用 image_url
                price: price,
                wearCount: wearCount,
                cpw: cpw
            };
        });

        // 计算穿着率
        const wearRate = totalItems > 0 ? Math.round(((totalItems - unwornCount) / totalItems) * 100) : 0;

        // 3. 生成榜单
        const sortedByVal = [...analyzedItems];
        
        const bestValue = sortedByVal
            .filter(i => i.wearCount > 0)
            .sort((a, b) => a.cpw - b.cpw)
            .slice(0, 3);

        const worstValue = sortedByVal
            .filter(i => i.price > 50) 
            .sort((a, b) => {
                if (a.wearCount === 0 && b.wearCount > 0) return -1; 
                if (a.wearCount > 0 && b.wearCount === 0) return 1;
                if (a.wearCount === 0 && b.wearCount === 0) return b.price - a.price;
                return b.cpw - a.cpw;
            })
            .slice(0, 3);

        // 4. 颜色分布 (取 Top 5)
        const topColors = Object.entries(colorStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({
                name,
                count,
                percent: Math.round((count / totalItems) * 100),
                color: colorToHex(name)
            }));

        // 5. 分类分布 (用于圆盘图)
        const categories = Object.entries(categoryStats)
            .map(([name, count]) => ({
                name,
                count,
                value: count
            }))
            .sort((a, b) => b.count - a.count);
        
        // --- 数据预处理：为 AI 准备结构化数据 ---
        const topScenes = Object.entries(sceneStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `${name}(${count})`);
            
        const topSeasons = Object.entries(seasonStats)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => `${name}(${count})`);

        // 6. AI 诊断 (构建 Prompt)
        let aiDiagnosis = {
            category: "正在分析您的穿搭数据...",
            scene: "正在分析您的场景需求...",
            season: "正在分析您的季节储备..."
        };
        
        // 获取当前月份，帮助 AI 判断
        const currentMonth = new Date().getMonth() + 1;
        const currentSeasonStr = currentMonth >= 3 && currentMonth <= 5 ? '春季' : 
                                 currentMonth >= 6 && currentMonth <= 8 ? '夏季' :
                                 currentMonth >= 9 && currentMonth <= 11 ? '秋季' : '冬季';

        // 构造提示词
        const systemPrompt = `你是一位既专业又幽默的时尚博主/衣橱管家，擅长用轻松、略带调侃但充满建设性的语气点评衣橱。当前时间是${currentMonth}月(${currentSeasonStr})。
请根据用户的衣橱数据，分别从【种类】、【场景】、【季节】三个维度给出建议。

**核心要求**：
1. **拒绝枯燥的统计汇报**（如“上衣过多，下装过少”），请转化为更有趣的表达（如“上衣都在开会，下装却在缺席？是时候补几件百搭裤装来解锁新造型了！👖”）。
2. **语气要生动有趣**，像朋友聊天一样，适当使用Emoji。
3. **要有互动感**，提出具体的搭配灵感或行动呼吁。

用户数据如下：
- 总库存：${totalItems}件
- 种类前三：${JSON.stringify(categories.slice(0, 3).map(c => c.name))}
- 场景前三：${JSON.stringify(topScenes.slice(0, 3))}
- 季节分布：${JSON.stringify(topSeasons)}
- 颜色前三：${JSON.stringify(topColors.slice(0, 3).map(c => c.name))}

请必须且只能返回一段纯 JSON 代码，格式严格如下（不要包含Markdown代码块标记）：
{
  "category": "针对种类的趣味点评",
  "scene": "针对场景的互动建议",
  "season": "针对季节的贴心提醒（结合当前月份）"
}`;

        try {
            const aiResponse = await callQwen([
                { role: 'system', content: '你是一个只输出JSON格式数据的助手。' },
                { role: 'user', content: systemPrompt }
            ]);
            
            // 清理可能存在的 Markdown 标记
            let jsonStr = aiResponse.trim();
            // 去除可能包裹的 ```json ... ```
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '');
            }
            
            aiDiagnosis = JSON.parse(jsonStr);
        } catch (err) {
            console.error('AI Diagnosis Failed:', err);
            // 保持默认值或设置错误提示
            aiDiagnosis = {
                category: "AI 分析暂时不可用，请稍后再试。",
                scene: "AI 分析暂时不可用，请稍后再试。",
                season: "AI 分析暂时不可用，请稍后再试。"
            };
        }

        // 7. 返回结果
        const responseData = {
            stats: { 
                totalItems: totalItems,
                totalValue: Math.round(totalValue),
                activeOutfits: totalOutfits, // 前端可能用 totalOutfits，也可能用 activeOutfits，这里保持一致
                wearRate: `${wearRate}%`
            },
            // CPW (Cost Per Wear) 分析
            cpw: { 
                best: bestValue.map(item => ({
                    id: item.id,
                    name: item.name,
                    image_url: item.image_url || 'https://via.placeholder.com/150', // 确保字段名为 image_url
                    price: item.price,
                    wearCount: item.wearCount,
                    metric: `¥${item.cpw.toFixed(1)}/次`
                })),
                worst: worstValue.map(item => ({
                    id: item.id,
                    name: item.name,
                    image_url: item.image_url || 'https://via.placeholder.com/150',
                    price: item.price,
                    wearCount: item.wearCount,
                    metric: item.wearCount === 0 ? '从未' : `¥${item.cpw.toFixed(1)}/次`
                }))
            },
            // 颜色分布
            colors: Object.entries(colorStats)
                .map(([name, count]) => ({
                    name,
                    value: count, // 图表库通常使用 value
                    color: colorToHex(name)
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8), // 只取前8个颜色
            // 类别分布 (新增)
            categories: Object.entries(categoryStats)
                .map(([name, count]) => ({
                    name,
                    value: count
                }))
                .sort((a, b) => b.value - a.value),
            // 季节分布 (新增)
            seasons: Object.entries(seasonStats)
                .map(([name, count]) => ({
                    name,
                    value: count
                }))
                .sort((a, b) => b.value - a.value),
            // 场景分布 (新增)
            scenes: Object.entries(sceneStats)
                .map(([name, count]) => ({
                    name,
                    value: count
                }))
                .sort((a, b) => b.value - a.value),
            // AI 诊断建议 (现在是一个对象)
            aiDiagnosis: aiDiagnosis 
        };

        res.json({
            code: 200,
            msg: 'success',
            data: responseData
        });

    } catch (err) {
        console.error('Error in /dashboard:', err);
        res.status(500).json({ code: 500, msg: 'Internal Server Error' });
    }
});

/**
 * GET /recommendation
 * 获取首页推荐灵感和风格探索
 */
router.get('/recommendation', async (req, res) => {
    try {
        // 1. 模拟今日推荐 (Look of the Day)
        const recommendList = [
            {
                id: 1,
                title: '职场通勤风',
                image_url: '/static/image/clothing1.png', 
                reason: '干练优雅，适合周一会议',
                tags: ['职场', '简约', '秋季']
            },
            {
                id: 2,
                title: '周末休闲',
                image_url: '/static/image/clothing2.png',
                reason: '舒适自在，去公园走走吧',
                tags: ['休闲', '牛仔', '舒适']
            },
            {
                id: 3,
                title: '约会穿搭',
                image_url: '/static/image/clothing3.png',
                reason: '温柔显气质，让他怦然心动',
                tags: ['约会', '裙装', '温柔']
            }
        ];

        // 2. 模拟风格探索 (Style Explore)
        const exploreList = [
            {
                id: 101,
                title: '极简主义',
                style: 'Minimalist',
                image_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=300&auto=format&fit=crop'
            },
            {
                id: 102,
                title: '复古风',
                style: 'Vintage',
                image_url: 'https://images.unsplash.com/photo-1550614000-4b9519e02d8e?q=80&w=300&auto=format&fit=crop'
            },
            {
                id: 103,
                title: '街头潮流',
                style: 'Streetwear',
                image_url: 'https://images.unsplash.com/photo-1523396884774-3385ccd01f6e?q=80&w=300&auto=format&fit=crop'
            },
            {
                id: 104,
                title: '商务休闲',
                style: 'Smart Casual',
                image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=300&auto=format&fit=crop'
            }
        ];

        res.json({
            code: 200,
            msg: 'success',
            data: {
                recommend: recommendList,
                explore: exploreList
            }
        });
    } catch (err) {
        console.error('Error in /recommendation:', err);
        res.status(500).json({ code: 500, msg: 'Internal Server Error' });
    }
});

module.exports = router;