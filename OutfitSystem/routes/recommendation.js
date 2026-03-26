const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { callQwenJson } = require('../utils/ai');

// 辅助函数：随机打乱数组
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

const STYLES = ['极简主义', '复古港风', '多巴胺穿搭', '清新日系', '美式街头', '法式优雅', '商务休闲', '机能风', '新中式'];

/**
 * 基于规则的推荐（兜底策略）
 * 生成 count 套推荐
 */
function getRuleBasedRecommendations(clothes, count = 3) {
    if (!clothes || clothes.length === 0) return [];
    
    // 确保 count 是有效数字
    count = Math.max(1, count);
    const results = [];

    // 简单分类映射
    const tops = clothes.filter(c => /Top|Shirt|Blouse|T-shirt|上装|上衣|衬衫|T恤|卫衣|外套|毛衣/i.test(c.category));
    const bottoms = clothes.filter(c => /Bottom|Pants|Skirt|Jeans|下装|裤|裙|半身裙|牛仔/i.test(c.category));
    const onepieces = clothes.filter(c => /OnePiece|Dress|Suit|连体|连衣裙|套装/i.test(c.category));
    const shoes = clothes.filter(c => /Shoe|Boot|Sneaker|鞋|靴/i.test(c.category));
    const accessories = clothes.filter(c => /Accessory|Hat|Bag|配饰|帽|包|围巾|眼镜/i.test(c.category));

    // 辅助函数：随机取一个
    const pickOne = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;

    for (let i = 0; i < count; i++) {
        let finalOutfit = [];
        let reason = "日常百搭";
        let style = "休闲";
        
        let validOutfit = false;

        // 策略 A: 连体衣 (20% 概率，前提是有)
        const useOnePiece = onepieces.length > 0 && Math.random() > 0.8;

        if (useOnePiece) {
            const op = pickOne(onepieces);
            if (op) {
                finalOutfit.push(op);
                reason = "一件搞定，轻松出门";
                style = "简约";
                validOutfit = true;
            }
        } 
        
        // 策略 B: 上装 + 下装 (如果没有连体衣，或没选中)
        if (!validOutfit && tops.length > 0 && bottoms.length > 0) {
            const t = pickOne(tops);
            const b = pickOne(bottoms);
            if (t && b) {
                finalOutfit.push(t);
                finalOutfit.push(b);
                reason = "经典上下装搭配";
                style = "日常";
                validOutfit = true;
            }
        } 
        
        // 策略 C: 随机兜底 (实在凑不齐)
        if (!validOutfit) {
            if (clothes.length > 0) {
                 finalOutfit.push(pickOne(clothes));
                 validOutfit = true;
            }
            if (clothes.length > 1) {
                let second = pickOne(clothes);
                // 简单去重
                if (second && finalOutfit[0] && second.id !== finalOutfit[0].id) {
                    finalOutfit.push(second);
                }
            }
            reason = "随心搭配";
            style = "混搭";
        }
        
        if (!validOutfit) continue; 

        // 必选：鞋子 (如果有)
        const s = pickOne(shoes);
        if (s) finalOutfit.push(s);

        // 可选：配饰 (30% 概率)
        if (Math.random() > 0.7) {
            const acc = pickOne(accessories);
            if (acc) finalOutfit.push(acc);
        }

        // 确保不包含重复对象 (基于ID)并过滤空值
        const uniqueItems = [];
        const seenIds = new Set();
        for (const item of finalOutfit) {
            if (item && item.id && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                uniqueItems.push(item);
            }
        }

        results.push({
            reason: reason,
            style: style,
            items: uniqueItems
        });
    }
    return results;
}

/**
 * [GET] /daily - 获取今日 AI 推荐
 * Query: account, userId, strategy, weather, count(默认5)
 */
router.get('/daily', async (req, res) => {
    let connection;
    try {
        const { account, strategy, userId, weather } = req.query;
        let count = parseInt(req.query.count) || 5;
        
        // 限制最大数量
        if (count > 10) count = 10;
        if (count < 1) count = 1;

        if (!account && !userId) return res.status(400).json({ msg: '参数缺失' });

        connection = await db.getConnection();

        // 0. 获取用户画像信息 (新增)
        let userProfileStr = "";
        if (userId) {
            const [profiles] = await connection.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
            if (profiles && profiles.length > 0) {
                const p = profiles[0];
                const parts = [];
                if (p.gender) parts.push(`性别:${p.gender}`);
                if (p.body_shape) parts.push(`体型:${p.body_shape}`);
                if (p.style_preference) parts.push(`风格偏好:${p.style_preference}`);
                if (p.skin_tone) parts.push(`肤色:${p.skin_tone}`);
                if (parts.length > 0) {
                    userProfileStr = "用户画像特征：[" + parts.join(', ') + "]。请在搭配时充分考虑这些身体特征和偏好。";
                }
            }
        }

        // 1. 获取用户衣橱所有衣物
        let query = 'SELECT * FROM clothes WHERE account = ?';
        let params = [account];
        if (userId) {
            query = 'SELECT * FROM clothes WHERE user_id = ?';
            params = [userId];
        }

        const [clothes] = await connection.query(query, params);
        
        // 2. 空衣橱处理
        if (!clothes || clothes.length === 0) {
            connection.release();
            return res.json({
                code: 200, 
                message: '衣橱为空',
                data: [] 
            });
        }

        // 3. 准备 AI 上下文
        // 随机打乱，避免每次都取前几个
        const shuffledClothes = shuffle([...clothes]);
        
        // 只取前 40 件传给 AI，减少 Token 消耗，提高响应速度
        const clothesContext = shuffledClothes.slice(0, 40).map(c => ({
            id: c.id,
            name: c.name,
            category: c.category || 'unknown',
            color: c.color || 'unknown',
            season: c.season || ''
        }));
        
        // 策略调整：AI 生成比较慢，默认生成 2 套 AI + 3 套规则
        let aiGenCount = Math.min(count, 2); 

        let promptContext = "";
        let styleGuide = "";
        
        // 根据策略构建 Prompt
        switch (strategy) {
            case 'hot': 
                promptContext = `请挖掘最适合${weather || '当季'}的热门风格。重点展现时尚感。`;
                styleGuide = "风格如：复古、韩系、层次感";
                break;
            case 'style':
                promptContext = `请尝试打破常规，搭配出风格鲜明的方案。`;
                styleGuide = `风格如：${STYLES.slice(0, 4).join('、')}`;
                break;
            case 'random':
            default:
                promptContext = `请根据天气（${weather || '舒适'}）生成实用得体的日常搭配。`;
                styleGuide = "风格如：通勤、休闲、简约";
                break;
        }

        // 构造 System Prompt
        const systemPrompt = `你是一个专业的时尚搭配师。
任务：从给定的【衣物列表】中挑选单品，组合成 ${aiGenCount} 套搭配。
要求：
1. 输出必须是合法的 JSON 格式，结构：{ "recommendations": [ { "reason": "...", "style": "...", "item_ids": [id1, id2...] } ] }
2. 搭配完整性（核心原则）：
   - 必须是一套完整的出门装扮。
   - 【强制】必须包含鞋子 (Shoe/Boot/Sneaker)。
   - 【强制】如果是上装，必须搭配下装；或者是连体衣/连衣裙。
   - 【强烈建议】添加最少1件配饰（包、帽、眼镜、首饰等），使整套搭配丰富完整。
   - 每套搭配的单品数量目标为 4-5 件（例如：上装+下装+鞋子+包+帽子）。
3. 审美要求：风格统一，色调和谐。
4. 这里的 item_ids 必须来自输入的 id 列表，不能编造。`; 

        const userMessage = `衣物列表 JSON：${JSON.stringify(clothesContext)}`;

        let finalResults = [];
        const usedItemIdsInSession = new Set(); // 记录本次推荐已使用的单品，避免重复

        // --- AI 生成阶段 ---
        if (aiGenCount > 0) {
            try {
                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ];
                
                // console.log('AI Request:', JSON.stringify(messages).slice(0, 200) + '...');
                const aiResult = await callQwenJson(messages);
                // console.log('AI Response:', aiResult);

                // 容错处理：提取 recommendations 数组
                let aiRecs = [];
                if (aiResult && Array.isArray(aiResult.recommendations)) {
                    aiRecs = aiResult.recommendations;
                } else if (aiResult && Array.isArray(aiResult.item_ids)) {
                     // 单个结果的情况
                     aiRecs = [aiResult];
                } else if (Array.isArray(aiResult)) {
                    // 直接返回数组的情况
                    aiRecs = aiResult;
                }

                // 将 AI 返回的 ID 转换为 真实对象
                for (let rec of aiRecs) {
                    let items = [];
                    // 确保 item_ids 存在且是数组
                    if (!rec.item_ids && rec.items) rec.item_ids = rec.items; // 容错
                    
                    if (rec.item_ids && Array.isArray(rec.item_ids)) {
                        for (const id of rec.item_ids) {
                            const found = clothes.find(c => c.id == id);
                            if (found) items.push(found);
                        }
                    }

                    // --- 智能补全逻辑 (关键优化) ---
                    
                    // 辅助函数：获取当前搭配的主要季节
                    const getDominantSeason = (currentItems) => {
                        const seasons = currentItems.map(i => i.season).filter(s => s);
                        // 如果无法从衣物推断，尝试从 weather 参数推断
                        if (seasons.length === 0) {
                            if (weather) {
                                if (/热|暑|夏|Summer|Hot/i.test(weather)) return 'Summer';
                                if (/冷|寒|冬|Winter|Cold/i.test(weather)) return 'Winter';
                                if (/春|秋|Spring|Autumn/i.test(weather)) return 'Spring/Autumn';
                            }
                            return null;
                        }
                        return seasons.sort((a,b) =>
                              seasons.filter(v => v===a).length
                            - seasons.filter(v => v===b).length
                        ).pop();
                    };

                    // 辅助函数：简单的颜色匹配（黑白灰百搭，其他尝试同色系）
                    const isColorMatch = (itemColor, targetColors) => {
                        if (!itemColor) return true; // 无颜色信息则视为匹配
                        if (/黑|白|灰|Black|White|Grey/i.test(itemColor)) return true; // 百搭色
                        if (!targetColors || targetColors.length === 0) return true;
                        // 简单检查是否有重叠字符 (比如 "深蓝" 和 "蓝")
                        return targetColors.some(c => c && (c.includes(itemColor) || itemColor.includes(c)));
                    };

                    const dominantSeason = getDominantSeason(items);
                    const currentColors = items.map(i => i.color).filter(c => c);

                    // 1. 检查是否缺鞋子 (这是最常见的缺失)
                    const hasShoes = items.some(c => /Shoe|Boot|Sneaker|鞋|靴/i.test(c.category));
                    if (!hasShoes) {
                        let allShoes = clothes.filter(c => /Shoe|Boot|Sneaker|鞋|靴/i.test(c.category));
                        
                        if (allShoes.length > 0) {
                            // 优先尝试未使用过的鞋子
                            let unusedShoes = allShoes.filter(s => !usedItemIdsInSession.has(s.id));
                            let pool = unusedShoes.length > 0 ? unusedShoes : allShoes;

                            // 优先筛选季节符合的
                            let candidateShoes = dominantSeason 
                                ? pool.filter(s => !s.season || s.season.includes(dominantSeason))
                                : pool;
                            
                            // 如果筛选后没有了，就回退
                            if (candidateShoes.length === 0) candidateShoes = pool;

                            // 尝试筛选颜色符合的
                            let colorMatchShoes = candidateShoes.filter(s => isColorMatch(s.color, currentColors));
                            if (colorMatchShoes.length === 0) colorMatchShoes = candidateShoes; // 回退

                            // 随机选一双
                            const shoe = colorMatchShoes[Math.floor(Math.random() * colorMatchShoes.length)];
                            items.push(shoe);
                        }
                    }

                    // 2. 检查是否只有上装没下装 (且不是连体衣)
                    const hasTop = items.some(c => /Top|Shirt|Blouse|T-shirt|上装|上衣|衬衫|T恤|卫衣|外套|毛衣/i.test(c.category));
                    const hasBottom = items.some(c => /Bottom|Pants|Skirt|Jeans|下装|裤|裙|半身裙|牛仔/i.test(c.category));
                    const hasOnePiece = items.some(c => /OnePiece|Dress|Suit|连体|连衣裙|套装/i.test(c.category));

                    if (hasTop && !hasBottom && !hasOnePiece) {
                        const allBottoms = clothes.filter(c => /Bottom|Pants|Skirt|Jeans|下装|裤|裙/i.test(c.category));
                        
                        // 优先尝试未使用的
                        let unused = allBottoms.filter(c => !usedItemIdsInSession.has(c.id));
                        let pool = unused.length > 0 ? unused : allBottoms;

                        if (pool.length > 0) {
                            // 季节 + 颜色 筛选
                            let candidates = dominantSeason 
                                ? pool.filter(i => !i.season || i.season.includes(dominantSeason))
                                : pool;
                            if (candidates.length === 0) candidates = pool;
                            
                            let finalCandidates = candidates.filter(i => isColorMatch(i.color, currentColors));
                            if (finalCandidates.length === 0) finalCandidates = candidates;

                            items.push(finalCandidates[Math.floor(Math.random() * finalCandidates.length)]);
                        }
                    } else if (!hasTop && hasBottom && !hasOnePiece) {
                        const allTops = clothes.filter(c => /Top|Shirt|Blouse|T-shirt|上装|上衣/i.test(c.category));

                        // 优先尝试未使用的
                        let unused = allTops.filter(c => !usedItemIdsInSession.has(c.id));
                        let pool = unused.length > 0 ? unused : allTops;

                        if (pool.length > 0) {
                             // 季节 + 颜色 筛选
                             let candidates = dominantSeason 
                                ? pool.filter(i => !i.season || i.season.includes(dominantSeason))
                                : pool;
                            if (candidates.length === 0) candidates = pool;

                            let finalCandidates = candidates.filter(i => isColorMatch(i.color, currentColors));
                            if (finalCandidates.length === 0) finalCandidates = candidates;

                            items.push(finalCandidates[Math.floor(Math.random() * finalCandidates.length)]);
                        }
                    }

                    // 3. 丰富度补全：如果总数少于 4 件，尝试补配饰/包包
                    if (items.length < 4) {
                        const allAccessories = clothes.filter(c => /Accessory|Hat|Bag|配饰|帽|包|围巾|眼镜|首饰/i.test(c.category));
                        // 过滤掉已有的
                        const currentIds = new Set(items.map(i => i.id));
                        const availableAcc = allAccessories.filter(a => !currentIds.has(a.id));
                        
                        let needed = 4 - items.length;
                        // 最多补 2 件，避免太杂
                        if (needed > 2) needed = 2;

                        for (let k = 0; k < needed; k++) {
                            if (availableAcc.length > 0) {
                                const idx = Math.floor(Math.random() * availableAcc.length);
                                items.push(availableAcc[idx]);
                                availableAcc.splice(idx, 1); // 避免重复选同一个
                            }
                        }
                    }
                    
                    if (items.length > 0) {
                        // 记录使用过的单品 ID
                        items.forEach(i => usedItemIdsInSession.add(i.id));

                        finalResults.push({
                            reason: rec.reason || "AI 灵感推荐", 
                            style: rec.style || "时尚",
                            items: items,
                            is_ai: true
                        });
                    }
                }
            } catch (e) {
                console.error("AI调用失败或解析错误，降级为规则推荐:", e.message);
                // 失败不中断，继续走下面的规则补齐
            }
        }

        // --- 规则补齐阶段 ---
        // 如果 AI 生成失败，或生成的数量少于预期
        if (finalResults.length < count) {
            const needed = count - finalResults.length;
            // 再次打乱
            const fallbackItems = getRuleBasedRecommendations(shuffle([...clothes]), needed);
            finalResults.push(...fallbackItems);
        }
        
        connection.release();

        return res.json({
            code: 200,
            data: finalResults
        });

    } catch (err) {
        if (connection) connection.release();
        console.error('推荐接口致命错误:', err);
        return res.status(500).json({ msg: '服务器内部错误', error: err.toString() });
    }
});

// [POST] /feedback - 收集用户反馈
router.post('/feedback', async (req, res) => {
    // 简单打点，不阻断流程
    const { recommendation_id, action, items } = req.body;
    console.log(`[Recommendation Feedback] Action: ${action}, RecId: ${recommendation_id}`);
    
    // 如果是 like 操作，未来可以考虑自动调整用户画像权重
    
    return res.json({ code: 200, msg: 'feedback received' });
});

module.exports = router;