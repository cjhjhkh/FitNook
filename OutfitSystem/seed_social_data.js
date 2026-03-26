const db = require('./config/db');

async function seed() {
    try {
        console.log('开始检查数据...');
        
        // 1. 确保至少有一个用户
        let [users] = await db.query('SELECT id, account FROM users LIMIT 1');
        let userId;
        if (users.length === 0) {
            console.log('未找到用户，创建默认用户...');
            const [res] = await db.query('INSERT INTO users (account, password) VALUES (?, ?)', ['admin', '123456']);
            userId = res.insertId;
            // 创建 profile
            await db.query('INSERT INTO user_profiles (user_id, nickname, avatar_url) VALUES (?, ?, ?)', 
                [userId, 'FitNook官方', '/static/logo.png']);
        } else {
            userId = users[0].id;
            console.log('使用现有用户 ID:', userId);
        }

        // 2. 确保至少有一个搭配
        let [outfits] = await db.query('SELECT id FROM outfits LIMIT 1');
        let outfitId;
        if (outfits.length === 0) {
            console.log('未找到搭配，创建默认搭配...');
            const [res] = await db.query('INSERT INTO outfits (user_id, name, image_url, created_at) VALUES (?, ?, ?, NOW())', 
                [userId, '春日休闲风', '/static/image/clothing1.png']); // 使用项目里的静态资源作为占位
            outfitId = res.insertId;
        } else {
            outfitId = outfits[0].id;
            console.log('使用现有搭配 ID:', outfitId);
        }

        // 3. 检查是否有帖子，如果没有则插入示例帖子
        const [posts] = await db.query('SELECT COUNT(*) as count FROM social_posts');
        if (posts[0].count === 0) {
            console.log('社交动态为空，插入种子数据...');
            
            const seedPosts = [
                {
                    content: '今天天气真好，穿这套去公园野餐正合适！大家觉得怎么样？�� #春日穿搭 #野餐',
                    image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80', // 网络图，模拟
                    view_count: 128,
                    like_count: 45
                },
                {
                    content: '极简主义穿搭，黑白灰永远的神。Working mode on. 💼',
                    image_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
                    view_count: 356,
                    like_count: 89
                },
                {
                    content: '尝试了一下叠穿，好像还不错？',
                    image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80',
                    view_count: 56,
                    like_count: 12
                }
            ];

            for (const post of seedPosts) {
                // 插入帖子
                const [res] = await db.query(
                    'INSERT INTO social_posts (user_id, outfit_id, content, image_url, view_count, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [userId, outfitId, post.content, post.image_url, post.view_count]
                );
                
                // 插入一些点赞数据 (给自己点赞，或者随机)
                if (post.like_count > 0) {
                   // 简单起见，仅插入一条真实的点赞记录来激活 is_liked 状态测试，
                   // 其它数量由 display 字段或者手动改库，这里不再模拟几十条 insert
                   await db.query('INSERT IGNORE INTO social_likes (user_id, post_id) VALUES (?, ?)', [userId, res.insertId]);
                }
            }
            console.log('✅ 成功插入 3 条示例动态！');
        } else {
            console.log('ℹ️ 社交动态已有数据，跳过种子插入。');
        }

        process.exit(0);
    } catch (e) {
        console.error('❌ 脚本执行出错:', e);
        process.exit(1);
    }
}

seed();
