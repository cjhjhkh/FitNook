<template>
    <view class="daily-rec-card">
        <view class="rec-header">
            <text class="title">今日穿搭灵感</text>
            <view class="strategies">
                <view v-for="s in strategies" :key="s.value" 
                    class="strategy-tag" 
                    :class="{ active: currentStrategy === s.value }"
                    @tap="changeStrategy(s.value)">
                    {{ s.label }}
                </view>
            </view>
        </view>

        <!-- 加载中状态 -->
        <view v-if="loading" class="loading-box">
             <!-- 使用 vant loading (需确保已引入，或者用简单的文字替代) -->
            <van-loading v-if="hasVantLoading" type="spinner" size="24px" color="#1989fa" vertical>AI 正在构思...</van-loading>
            <text v-else class="simple-loading">AI 正在构思...</text>
        </view>

        <!-- 空衣橱状态 -->
        <view v-else-if="isEmpty" class="empty-state">
            <view class="empty-icon">🧥</view>
            <text class="empty-text">衣橱空空如也，先去添加几件衣服吧！</text>
            <van-button 
                round 
                type="info" 
                size="small" 
                custom-class="add-btn"
                @click="goToAddClothes">
                去添加
            </van-button>
        </view>

        <!-- 推荐内容 -->
        <view v-else class="rec-content">
            <!-- AI 文案 -->
            <view class="ai-speech">
                <view class="ai-avatar">🤖</view>
                <view class="bubble">
                    <text class="style-tag" v-if="recommendation.style">#{{ recommendation.style }}</text>
                    {{ recommendation.reason || '让我想想今天穿什么...' }}
                </view>
            </view>

            <!-- 衣物展示 -->
            <view class="collage-container" 
                  :class="'layout-' + getLayoutType(recommendation.items)" 
                  v-if="recommendation.items && recommendation.items.length">
                
                <view v-for="(item, index) in getDisplayItems(recommendation.items)" 
                    :key="item.id || index" 
                    class="collage-item" 
                    :class="'item-' + index"
                    @tap="previewImage(item.image_url, recommendation.items)">
                    <image :src="item.image_url" mode="aspectFill" class="collage-img" />
                </view>
            </view>

            <!-- 操作区 -->
            <view class="action-area">
                <view class="try-btn-wrapper" @click="handleTryOn">
                    <view class="try-btn">
                        <van-icon name="magic-stick" size="16px" style="margin-right: 4px;" />
                        <text>一键试穿</text>
                    </view>
                </view>
                
                <view class="feedback-btns">
                    <view class="fb-btn" @tap="sendFeedback('like')">
                        <van-icon name="good-job-o" size="18px" />
                    </view>
                    <view class="fb-btn" @tap="refresh">
                        <van-icon name="replay" size="18px" />
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { getDailyRecommendation } from '@/api/recommendation';

const props = defineProps<{
    weather?: string
}>();

const strategies = [
    { label: '🎲 随机', value: 'random' },
    { label: '🔥 热门', value: 'hot' },
    { label: '🎨 风格', value: 'style' }
];

const currentStrategy = ref('random');
const loading = ref(false);
const recommendation = ref<any>({});
const isEmpty = ref(false);
const hasVantLoading = ref(true); // 假设全局引入了

const userInfo =  ref<any>({});

const fetchRecommendation = async () => {
    userInfo.value = uni.getStorageSync('userInfo') || {};
    if (!userInfo.value.account) {
        isEmpty.value = true;
        return;
    }
    
    loading.value = true;
    isEmpty.value = false;
    
    try {
        const res: any = await getDailyRecommendation({
            account: userInfo.value.account,
            userId: userInfo.value.id,
            strategy: currentStrategy.value,
            weather: props.weather || '晴'
        });
        
        if (res.code === 200 && res.data) {
            recommendation.value = res.data;
            if (!res.data.items || res.data.items.length === 0) {
                 isEmpty.value = true;
            }
        } else {
            // 如果返回404或列表为空
            if(res.code === 404 || (res.data && res.data.length === 0)) {
                 isEmpty.value = true;
            }
        }
    } catch (e) {
        console.error('获取推荐失败', e);
        // 如果是首次加载且失败，显示空状态比较安全
        if (!recommendation.value.items) {
             isEmpty.value = true;
        }
    } finally {
        loading.value = false;
    }
};

const changeStrategy = (val: string) => {
    if (currentStrategy.value === val) return;
    currentStrategy.value = val;
    fetchRecommendation();
};

const refresh = () => {
    fetchRecommendation();
};

const handleTryOn = () => {
    if (!recommendation.value.items || recommendation.value.items.length === 0) return;
    
    // 将当前推荐的衣物存入缓存，传递给 create 页面
    uni.setStorageSync('temp_try_on_items', recommendation.value.items);
    
    uni.navigateTo({
        url: '/pages/outfit/create?mode=tryon'
    });
};

const sendFeedback = (type: string) => {
    uni.showToast({ title: '已收到反馈', icon: 'none' });
};

const goToAddClothes = () => {
    uni.switchTab({
        url: '/pages/wardrobe/index'
    });
};

const getLayoutType = (items: any[]) => {
    if (!items) return 1;
    const len = items.length;
    if (len === 1) return 1;
    if (len === 2) return 2;
    if (len === 3) return 3;
    return 4; // 4及以上
};

const getDisplayItems = (items: any[]) => {
    if (!items) return [];
    return items.slice(0, 4);
};

const previewImage = (current: string, items: any[] = []) => {
    if(!current) return;
    const urls = items.length ? items.map(i => i.image_url) : [current];
    uni.previewImage({
        current,
        urls
    });
}

// 监听 weather 变化，如果有变化则重新请求
watch(() => props.weather, (newVal) => {
    if(newVal) fetchRecommendation();
});


onMounted(() => {
    // 延迟一点加载，也就是等待父组件传递 weather
    setTimeout(() => {
        fetchRecommendation();
    }, 500);
});
</script>

<style lang="scss" scoped>
.daily-rec-card {
    background: #fff;
    border-radius: 24rpx; /* 统一圆角 */
    padding: 30rpx; /* 统一内边距 */
    margin-bottom: 40rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.03); /* 统一阴影 */
    transition: all 0.3s;
    /* 移除左右 margin，由父容器 padding 控制宽度 */

    .rec-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24rpx;

        .title {
            font-size: 32rpx; /* 统一标题大小 */
            font-weight: bold;
            color: #333;
            position: relative;
            padding-left: 0;
            
            &::before {
                display: none; /* 移除原来的绿色竖条，保持简洁或使用统一风格 */
            }
        }

        .strategies {
            display: flex;
            gap: 12rpx;
            
            .strategy-tag {
                font-size: 24rpx;
                padding: 8rpx 20rpx;
                background: #f7f8fa;
                border-radius: 20rpx;
                color: #666;
                transition: all 0.2s;

                &.active {
                    background: rgba(114, 50, 221, 0.1); /* 改为统一的紫色系 */
                    color: #7232dd;
                    font-weight: 600;
                }
            }
        }
    }

    .loading-box {
        padding: 40rpx 0;
        display: flex;
        justify-content: center;
        align-items: center;
        
        .simple-loading {
            color: #999;
            font-size: 14px;
        }
    }

    .empty-state {
        padding: 20px 0;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        
        .empty-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }
        
        .empty-text {
            display: block;
            font-size: 13px;
            color: #999;
            margin-bottom: 12px;
        }
    }

    .rec-content {
        .ai-speech {
            display: flex;
            align-items: flex-start;
            gap: 20rpx;
            margin-bottom: 24rpx;

            .ai-avatar {
                width: 72rpx;
                height: 72rpx;
                border-radius: 50%;
                background: linear-gradient(135deg, #eef2ff 0%, #f0e6ff 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36rpx;
                flex-shrink: 0;
                box-shadow: 0 4rpx 12rpx rgba(114, 50, 221, 0.1);
            }

            .bubble {
                flex: 1;
                background: #f8f9fc;
                padding: 24rpx;
                border-radius: 4rpx 24rpx 24rpx 24rpx;
                font-size: 28rpx;
                color: #444; 
                line-height: 1.7;
                position: relative;
                
                .style-tag {
                    color: #7232dd; /* 紫色 */
                    font-weight: 600;
                    margin-right: 8rpx;
                }
            }
        }

        .collage-container {
            width: 100%;
            height: 280px;
            display: grid;
            gap: 4px;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            
            &.layout-1 {
                grid-template-columns: 1fr;
            }
            &.layout-2 {
                grid-template-columns: repeat(2, 1fr);
            }
            &.layout-3 {
                grid-template-columns: 1.6fr 1fr; 
                grid-template-rows: repeat(2, 1fr);
                
                .collage-item.item-0 {
                    grid-row: 1 / span 2;
                }
            }
            &.layout-4 {
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(2, 1fr);
            }

            .collage-item {
                position: relative;
                width: 100%;
                height: 100%;
                background: #f8f8f8;
                overflow: hidden;
                transition: opacity 0.2s;

                &:active {
                    opacity: 0.9;
                }

                .collage-img {
                    width: 100%;
                    height: 100%;
                    display: block; 
                }
            }
        }

        .action-area {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 24rpx;

            .try-btn-wrapper {
                flex: 1;
                margin-right: 24rpx;
                
                .try-btn {
                    background: linear-gradient(135deg, #7232dd 0%, #5e23b8 100%); /* 紫色渐变按钮 */
                    color: #fff;
                    height: 80rpx; /* 加高按钮 */
                    border-radius: 40rpx;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 30rpx;
                    font-weight: 600;
                    box-shadow: 0 8rpx 20rpx rgba(114, 50, 221, 0.25);
                    transition: transform 0.1s;
                    
                    &:active {
                        opacity: 0.95;
                        transform: scale(0.98);
                    }
                }
            }

            .feedback-btns {
                display: flex;
                gap: 20rpx;

                .fb-btn {
                    width: 80rpx;
                    height: 80rpx;
                    border-radius: 50%;
                    background: #fff;
                    border: 2rpx solid #f0f0f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.03);
                    
                    &:active {
                        background: #f9f9f9;
                    }
                }
            }
        }
    }
}
</style>
