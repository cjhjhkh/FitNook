const fs = require('fs');
const filePath = '/Users/chammy/Documents/毕设项目/FitNook/OutfitCloset/pages/social/publish.vue';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `        const postData = {
            user_id: currentUser.id,
            outfit_id: selectedOutfit.value.id,
            content: content.value,
            image_url: finalImageUrl || '[]'
        };`;

const newCode = `        const postData = {
            user_id: currentUser.id,
            outfit_id: selectedOutfit.value.id,
            content: content.value,
            image_urls: finalImageUrl ? JSON.parse(finalImageUrl) : [],
            image_url: finalImageUrl || '[]'
        };`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(filePath, content);
console.log('Fixed publish.vue');
