const fs = require('fs');
const filePath = '/Users/chammy/Documents/毕设项目/FitNook/OutfitCloset/pages/social/publish.vue';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `        // 优先使用穿搭合成图，如果没有，则尝试使用第一个单品的图片
        let finalImageUrl = selectedOutfit.value.image_url;
        if (!finalImageUrl && selectedOutfit.value.items && selectedOutfit.value.items.length > 0) {
            finalImageUrl = selectedOutfit.value.items[0].image_url;
        }

        const postData = {
            user_id: currentUser.id,
            outfit_id: selectedOutfit.value.id,
            content: content.value,
            image_url: finalImageUrl || '' // 确保有图传给后端
        };`;

const newCode = `        let finalImageUrl = selectedOutfit.value.image_url;
        
        if (!finalImageUrl && selectedOutfit.value.items && selectedOutfit.value.items.length > 0) {
            const urls = selectedOutfit.value.items.map((item) => item.image_url).filter(Boolean);
            finalImageUrl = JSON.stringify(urls);
        } else if (finalImageUrl) {
            try {
                const parsed = JSON.parse(finalImageUrl);
                if (!Array.isArray(parsed)) throw new Error();
            } catch {
                finalImageUrl = JSON.stringify([finalImageUrl]);
            }
        }

        const postData = {
            user_id: currentUser.id,
            outfit_id: selectedOutfit.value.id,
            content: content.value,
            image_url: finalImageUrl || '[]'
        };`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(filePath, content);
console.log('Done!');
