<template>
    <view class="container">
        <!-- 顶部欢迎区 -->
        <view class="home-header">
            <view class="greeting">
                <text class="title">早安，{{ userInfo.nickname || 'FitNook用户' }}</text>
                <text class="subtitle">今天想穿什么呢？</text>
            </view>
        </view>

        <!-- 今日穿搭卡片 -->
        <view class="section-card today-outfit">
            <view class="card-header">
                <text class="card-title">今日穿搭</text>
                <view class="more-link" @tap="goToDiary">
                    <text>查看日历</text>
                    <van-icon name="arrow" />
                </view>
            </view>
            
            <view v-if="todayOutfit" class="outfit-content" @tap="goToOutfitDetail(todayOutfit.outfit_id)">
                <image :src="todayOutfit.cover" mode="aspectFill" class="outfit-img" />
                <view class="outfit-info">
                    <text class="name">{{ todayOutfit.name }}</text>
                    <view class="tags">
                        <van-tag plain type="primary" v-if="todayOutfit.scene">{{ todayOutfit.scene }}</van-tag>
                    </view>
                </view>
            </view>
            <view v-else class="empty-state" @tap="goToDiary">
                <view class="add-icon">
                    <van-icon name="plus" size="24px" color="#ccc" />
                </view>
                <text>添加今日穿搭计划</text>
            </view>
        </view>

        <!-- 快捷功能入口 -->
        <view class="quick-actions">
            <view class="action-item" @tap="goToWardrobe">
                <view class="icon-box blue">
                    <van-icon name="bag-o" size="28px" color="#fff" />
                </view>
                <text>我的衣橱</text>
            </view>
            <view class="action-item" @tap="goToOutfitCreate">
                <view class="icon-box pink">
                    <van-icon name="magic-stick" size="28px" color="#fff" />
                </view>
                <text>去搭配</text>
            </view>
            <view class="action-item" @tap="goToOutfitList">
                <view class="icon-box orange">
                    <van-icon name="apps-o" size="28px" color="#fff" />
                </view>
                <text>灵感库</text>
            </view>
        </view>

        <guide-card :visible="showGuide" @close="showGuide = false" @submit="onGuideSubmit" />
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import GuideCard from '@/component/guide-card/guide-card.vue';
import { request } from '@/utils/request';
import { getCalendarList } from '@/api/outfit';

const showGuide = ref(false);
const userInfo = ref<any>({});
const todayOutfit = ref<any>(null);

onLoad((options) => {
    // 逻辑：如果是新用户，显示引导卡片
    if (options.isNewUser === 'true') {
        showGuide.value = true;
    }
});

onShow(() => {
    const storedUser = uni.getStorageSync('userInfo');
    if (storedUser) {
        userInfo.value = storedUser;
        fetchTodayOutfit();
    }
});

const fetchTodayOutfit = async () => {
    if (!userInfo.value.account) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const dateKey = `${year}-${month}-${date}`;

    try {
        const res: any = await getCalendarList({
            account: userInfo.value.account,
            year,
            month
        });
        if (res.code === 200 && res.data[dateKey] && res.data[dateKey].length > 0) {
            // 取当天的第一套搭配
            todayOutfit.value = res.data[dateKey][0];
        } else {
            todayOutfit.value = null;
        }
    } catch (e) {
        console.error('获取今日穿搭失败', e);
    }
};

// 处理引导卡片提交的数据
const onGuideSubmit = async (formData: any) => {
    uni.showLoading({ title: '正在同步资料...' });
    try {
        // 调用后端刚才写的 PUT 接口
        const res: any = await request({
            url: '/user/profile',
            method: 'PUT',
            data: {
                account: userInfo.value.account,
                ...formData
            }
        });

        if (res.code === 200) {
            uni.showToast({ title: '开启个性化穿搭', icon: 'success' });
            showGuide.value = false;

            // 更新本地存储
            const updatedUser = { ...userInfo.value, is_profile_completed: 1 };
            uni.setStorageSync('userInfo', updatedUser);
            userInfo.value = updatedUser;
        }
    } catch (err) {
        console.error('同步失败', err);
        uni.showToast({ title: '同步失败，请重试', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};

// --- 导航跳转 ---
const goToDiary = () => {
    uni.navigateTo({ url: '/pages/outfit/diary' });
};

const goToOutfitDetail = (id: number) => {
    uni.navigateTo({ url: `/pages/outfit/create?id=${id}` });
};

const goToWardrobe = () => {
    uni.switchTab({ url: '/pages/wardrobe/index' });
};

const goToOutfitCreate = () => {
    uni.navigateTo({ url: '/pages/outfit/create' });
};

const goToOutfitList = () => {
    uni.navigateTo({ url: '/pages/outfit/index' });
};

</script>

<style lang="scss" scoped>
.container {
    min-height: 100vh;
    background-color: #f7f8fa;
    padding: 30rpx;
    box-sizing: border-box;
}

.home-header {
    margin-bottom: 40rpx;
    .greeting {
        .title {
            font-size: 40rpx;
            font-weight: bold;
            color: #333;
            display: block;
            margin-bottom: 10rpx;
        }
        .subtitle {
            font-size: 28rpx;
            color: #999;
        }
    }
}

.section-card {
    background: #fff;
    border-radius: 24rpx;
    padding: 30rpx;
    margin-bottom: 30rpx;
    box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24rpx;

        .card-title {
            font-size: 32rpx;
            font-weight: 600;
            color: #333;
        }

        .more-link {
            display: flex;
            align-items: center;
            font-size: 24rpx;
            color: #999;
        }
    }
}

.today-outfit {
    .outfit-content {
        display: flex;
        align-items: center;
        background: #f9f9f9;
        padding: 20rpx;
        border-radius: 16rpx;

        .outfit-img {
            width: 120rpx;
            height: 120rpx;
            border-radius: 12rpx;
            margin-right: 24rpx;
            background: #eee;
        }

        .outfit-info {
            flex: 1;
            .name {
                font-size: 30rpx;
                font-weight: 500;
                color: #333;
                margin-bottom: 12rpx;
                display: block;
            }
        }
    }

    .empty-state {
        height: 160rpx;
        border: 2rpx dashed #eee;
        border-radius: 16rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #ccc;
        font-size: 26rpx;

        .add-icon {
            margin-bottom: 10rpx;
        }
    }
}

.quick-actions {
    display: flex;
    justify-content: space-between;
    
    .action-item {
        flex: 1;
        background: #fff;
        border-radius: 24rpx;
        padding: 30rpx 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-right: 20rpx;
        box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);

        &:last-child {
            margin-right: 0;
        }

        .icon-box {
            width: 90rpx;
            height: 90rpx;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16rpx;
            
            &.blue { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
            &.pink { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%); }
            &.orange { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); }
        }

        text {
            font-size: 26rpx;
            color: #333;
            font-weight: 500;
        }
    }
}
</style>