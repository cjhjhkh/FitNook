const fs = require('fs');
const filePath = '/Users/chammy/Documents/毕设项目/FitNook/OutfitCloset/pages/social/index.vue';
let content = fs.readFileSync(filePath, 'utf8');

const tplOld = `<view class="outfit-preview" v-if="item.image_url">
							<image :src="item.image_url" mode="widthFix" class="outfit-img"/>
							<view class="outfit-tag">
								<van-icon name="bag-o" size="12px" color="#fff" style="margin-right: 4px"/>
								<text>{{ item.outfit_name }}</text>
							</view>
						</view>`;

const tplNew = `<view class="outfit-preview" v-if="getImages(item.image_url).length > 0">
                            <!-- 单图展示 -->
                            <image 
                                v-if="getImages(item.image_url).length === 1" 
                                :src="getImages(item.image_url)[0]" 
                                mode="widthFix" 
                                class="outfit-img-single"
                                @tap.stop="previewImage(getImages(item.image_url), 0)"
                            />
                            <!-- 多图展示 -->
                            <view v-else class="image-grid">
                                <image 
                                    v-for="(img, idx) in getImages(item.image_url)" 
                                    :key="idx" 
                                    :src="img" 
                                    mode="aspectFill" 
                                    class="grid-img"
                                    @tap.stop="previewImage(getImages(item.image_url), idx)"
                                />
                            </view>

							<view class="outfit-tag" v-if="item.outfit_name">
								<van-icon name="bag-o" size="12px" color="#fff" style="margin-right: 4px"/>
								<text>{{ item.outfit_name }}</text>
							</view>
						</view>`;

content = content.replace(tplOld, tplNew);

const scriptOld = `const currentUser = uni.getStorageSync('userInfo') || {};

onLoad(() => {`;

const scriptNew = `const currentUser = uni.getStorageSync('userInfo') || {};

// 获取解析后的图片数组
const getImages = (imageUrl) => {
    if (!imageUrl || imageUrl === '[]') return [];
    try {
        const parsed = JSON.parse(imageUrl);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [imageUrl];
    } catch {
        return imageUrl.split(',').filter(Boolean);
    }
};

// 预览图片
const previewImage = (images, current) => {
    if (!images || images.length === 0) return;
    uni.previewImage({
        urls: images,
        current: current
    });
};

onLoad(() => {`;

content = content.replace(scriptOld, scriptNew);

const styleOld = `.outfit-preview {
            background: #f8f9fa;
            border-radius: 16rpx;
            overflow: hidden;
            position: relative;
            
            .outfit-img {
                width: 100%;
                display: block;
                // height is auto
            }
            
            .outfit-tag {`;

const styleNew = `.outfit-preview {
            border-radius: 16rpx;
            overflow: hidden;
            position: relative;
            margin-top: 10rpx;
            
            .outfit-img-single {
                width: 100%;
                display: block;
                border-radius: 16rpx;
                background: #f8f9fa;
            }
            
            .image-grid {
                display: flex;
                flex-wrap: wrap;
                margin: -4rpx;
                
                .grid-img {
                    width: calc(33.33% - 8rpx);
                    height: 220rpx;
                    margin: 4rpx;
                    border-radius: 12rpx;
                    background: #f8f9fa;
                }
            }
            
            .outfit-tag {`;

content = content.replace(styleOld, styleNew);

fs.writeFileSync(filePath, content);
console.log('Update Success!');
