const fs = require('fs');
const filePath = '/Users/chammy/Documents/毕设项目/FitNook/OutfitCloset/pages/social/index.vue';
let content = fs.readFileSync(filePath, 'utf8');

const oldFuncRegex = /const getImages = \([\s\S]*?\}\s*catch\s*\{[\s\S]*?\}\s*;/;

const newFunc = `const getImages = (imageUrl) => {
    if (!imageUrl || imageUrl === '[]') return [];
    if (Array.isArray(imageUrl)) return imageUrl.filter(Boolean);
    try {
        const parsed = JSON.parse(imageUrl);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [imageUrl];
    } catch {
        return typeof imageUrl === 'string' ? imageUrl.split(',').filter(Boolean) : [];
    }
};`;

content = content.replace(oldFuncRegex, newFunc);
fs.writeFileSync(filePath, content);
console.log('Fixed getImages in index.vue');
