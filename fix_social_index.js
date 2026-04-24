const fs = require('fs');
const filePath = '/Users/chammy/Documents/毕设项目/FitNook/OutfitCloset/pages/social/index.vue';
let content = fs.readFileSync(filePath, 'utf8');

// The backend returns \`image_urls\`, we should parse it or just fall back to \`image_url\`
content = content.replace(/item\.image_url/g, '(item.image_urls || item.image_url)');

fs.writeFileSync(filePath, content);
console.log('Fixed index.vue fields');
