const fs = require('fs');
const path = './OutfitCloset/pages.json';
const data = fs.readFileSync(path, 'utf8');

// The file might contain comments since it's pages.json (JSON with comments, or Hjson).
// But for simple replacements we can use regex or plain string replacement.

let newData = data.replace(/"tabBar": \{[\s\S]*?\n\t\}/, `"tabBar": {
\t\t"color": "#7A7E83",
\t\t"selectedColor": "#8e72dc",
\t\t"borderStyle": "black",
\t\t"backgroundColor": "#ffffff",
\t\t"list": [
\t\t\t{
\t\t\t\t"pagePath": "pages/index/index",
\t\t\t\t"text": "首页"
\t\t\t},
\t\t\t{
\t\t\t\t"pagePath": "pages/wardrobe/index",
\t\t\t\t"text": "衣橱"
\t\t\t},
\t\t\t{
\t\t\t\t"pagePath": "pages/outfit/index",
\t\t\t\t"text": "穿搭"
\t\t\t},
\t\t\t{
\t\t\t\t"pagePath": "pages/my/index",
\t\t\t\t"text": "我的"
\t\t\t}
\t\t]
\t}`);

fs.writeFileSync(path, newData, 'utf8');
console.log('done!');
