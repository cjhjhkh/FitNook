const db = require('./config/db');

async function forceSeed() {
    try {
        console.log('🔄 开始重置社区演示数据...');
        
        // 1. 清空现有社交数据
        await db.query('DELETE FROM social_likes');
        await db.query('DELETE FROM social_posts');
        console.log('🗑️  已清空旧帖子数据');

        // 2. 获取或创建基础用户 (作为发布者)
        let userId;
        const [users] = await db.query('SELECT id FROM users LIMIT 1');
        if (users.length > 0) {
            userId = users[0].id;
        } else {
            const [res] = await db.query('INSERT INTO users (account, password) VALUES (?, ?)', ['demo_user', '123456']);
            userId = res.insertId;
            await db.query('INSERT INTO user_profiles (user_id, nickname) VALUES (?, ?)', [userId, '时尚达人']);
        }

        // 3. 获取或创建基础搭配 (作为外键关联)
        let outfitId;
        const [outfits] = await db.query('SELECT id FROM outfits LIMIT 1');
        if (outfits.length > 0) {
            outfitId = outfits[0].id;
        } else {
            const [res] = await db.query('INSERT INTO outfits (user_id, name, created_at) VALUES (?, ?, NOW())', [userId, '默认搭配']);
            outfitId = res.insertId;
        }

        // 4. 插入高质量演示数据
        const demoPosts = [
            {
                content: '周末的海边漫步穿搭，蓝白配色永远看不腻 🌊 这件衬衫的质感真的绝了！',
                image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
                views: 1205,
                hoursAgo: 2
            },
            {
                content: '今日份通勤 Look 💼 西装外套是提升气场的利器，搭配阔腿裤走路带风~',
                image: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&q=80',
                views: 890,
                hoursAgo: 5
            },
            {
                content: '简单的白T牛仔裤，回归最舒适的状态。Less is more. 👖',
                image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80',
                views: 567,
                hoursAgo: 12
            },
            {
                content: '尝试了一下复古风，大家觉得这个色调怎么样？🎞️ #VintageStyle',
                image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
                views: 2341,
                hoursAgo: 24
            }
        ];

        console.log('🌱 正在插入新数据...');
        for (const post of demoPosts) {
            const [res] = await db.query(
                `INSERT INTO social_posts (user_id, outfit_id, content, image_url, view_count, created_at) 
                 VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))`,
                [userId, outfitId, post.content, post.image, post.views, post.hoursAgo]
            );
            
            // 随机给一些赞 (为了测试 is_liked = true，给第一个帖子点赞)
            if (post.views > 1000) {
                 await db.query('INSERT INTO social_likes (user_id, post_id, created_at) VALUES (?, ?, NOW())', [userId, res.insertId]);
            }
        }

        console.log('✅ 成功插入 4 条演示动态！');
        process.exit(0);
    } catch (e) {
        console.error('❌ 脚本执行出错:', e);
        process.exit(1);
    }
}
forceSeed();
