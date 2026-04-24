const fs = require('fs');
const filePath = '/Users/chammy/Documents/毕设项目/FitNook/OutfitCloset/pages/social/index.vue';
let content = fs.readFileSync(filePath, 'utf8');

// replace the single image / multi image toggle with just the grid
const searchStr = `                            <!-- 单图展示 -->
                            <image 
                                v-if="getImages((item.image_urls || item.image_url)).length === 1" 
                                :src="getImages((item.image_urls || item.image_url))[0]" 
                                mode="widthFix" 
                                class="outfit-img-single"
                                @tap.stop="previewImage(getImages((item.image_urls || item.image_url)), 0)"
                            />
                            <!-- 多图展示 -->
                            <view v-else class="image-grid">
                                <image 
                                    v-for="(img, idx) in getImages((item.image_urls || item.image_url))" 
                                    :key="idx" 
                                    :src="img" 
                                    mode="aspectFill" 
                                    class="grid-img"
                                    @tap.stop="previewImage(getImages((item.image_urls || item.image_url)), idx)"
                                />
                            </view>`;

const replaceStr = `                            <view class="image-grid">
                                <image 
                                    v-for="(img, idx) in getImages((item.image_urls || item.image_url))" 
                                    :key="idx" 
                                    :src="img" 
                                    mode="aspectFill" 
                                    class="grid-img"
                                    @tap.stop="previewImage(getImages((item.image_urls || item.image_url)), idx)"
                                />
                            </view>`;

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content);
    console.log('Fixed grid successfully');
} else {
    console.log('String not found');
}
