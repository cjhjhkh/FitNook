<template>
    <view class="favorites-page">
        <!-- 顶部导航栏 -->
        <van-tabs :active="activeTab" @change="onTabChange" sticky color="#1989fa" line-width="20px">
            <van-tab title="单品" name="clothing"></van-tab>
            <van-tab title="搭配" name="outfit"></van-tab>
            <van-tab title="帖子" name="post"></van-tab>
        </van-tabs>

        <!-- 内容列表 -->
        <scroll-view scroll-y class="content-scroll" @scrolltolower="onLoadMore">
            <view class="list-container">
                <!-- 单品列表 -->
                <view v-if="activeTab === 'clothing'" class="clothes-grid">
                    <view v-for="item in list" :key="item.item_id" class="grid-item" @click="goToDetail(item)">
                        <image :src="item.image_url" mode="aspectFill" class="cover-img" />
                        <view class="info">
                            <text class="name">{{ item.title || item.name || '未命名' }}</text>
                            <view class="delete-icon" @click.stop="onRemove(item)">
                                <van-icon name="delete-o" color="#ee0a24" />
                            </view>
                        </view>
                    </view>
                </view>

                <!-- 搭配列表 -->
                <view v-else-if="activeTab === 'outfit'" class="outfit-list">
                    <view v-for="item in list" :key="item.item_id" class="list-item" @click="goToDetail(item)">
                        <image :src="item.image_url" mode="aspectFill" class="list-cover" />
                        <view class="list-info">
                            <view class="title-row">
                                <van-tag v-if="item.source === 'INSPIRATION'" type="primary" plain size="mini" style="margin-right: 4px;">灵感</van-tag>
                                <text class="list-title">{{ item.title || item.name || '未命名搭配' }}</text>
                            </view>
                            <text class="list-sub">{{ formatDate(item.created_at) }} 收藏</text>
                        </view>
                        <view class="list-action" @click.stop="onRemove(item)">
                             <van-button size="mini" plain round type="danger">取消收藏</van-button>
                        </view>
                    </view>
                </view>

                <!-- 帖子列表 -->
                <view v-else-if="activeTab === 'post'" class="post-list">
                    <view v-for="item in list" :key="item.item_id" class="list-item" @click="goToDetail(item)">
                        <image :src="item.image_url" mode="aspectFill" class="list-cover" />
                        <view class="list-info">
                            <text class="list-title">{{ item.title || '未命名帖子' }}</text>
                            <text class="list-sub">作者: {{ item.author_name || '未知' }}</text>
                        </view>
                        <view class="list-action" @click.stop="onRemove(item)">
                             <van-icon name="close" color="#999" size="16px" />
                        </view>
                    </view>
                </view>

                <!-- 空状态 -->
                <van-empty v-if="!loading && list.length === 0" description="暂无收藏内容" />
                
                <!-- 加载更多 -->
                <view v-if="loading" class="loading-more">
                    <van-loading type="spinner" size="24px">加载中...</van-loading>
                </view>
                <view v-if="!hasMore && list.length > 0" class="no-more">
                    - 没有更多了 -
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { getFavoriteList, removeFavorite } from '@/api/favorites';

const activeTab = ref('clothing');
const list = ref<any[]>([]);
const page = ref(1);
const loading = ref(false);
const hasMore = ref(true);
const userInfo = ref<any>(uni.getStorageSync('userInfo'));

onShow(() => {
    // 每次进入页面刷新列表
    userInfo.value = uni.getStorageSync('userInfo');
    refreshList();
});

const onTabChange = (event: any) => {
    activeTab.value = event.detail.name;
    refreshList();
};

const refreshList = () => {
    page.value = 1;
    list.value = [];
    hasMore.value = true;
    loadData();
};

const loadData = async () => {
    if (loading.value || !hasMore.value) return;
    if (!userInfo.value || !userInfo.value.id) return;

    loading.value = true;
    try {
        const res: any = await getFavoriteList(userInfo.value.id, activeTab.value, page.value);
        if (res.code === 200) {
            const newItems = res.data.list || [];
            if (page.value === 1) {
                list.value = newItems;
            } else {
                list.value = [...list.value, ...newItems];
            }
            
            if (newItems.length < 20) {
                hasMore.value = false;
            } else {
                page.value++;
            }
        }
    } catch (e) {
        console.error(e);
        uni.showToast({ title: '加载失败', icon: 'none' });
    } finally {
        loading.value = false;
    }
};

const onLoadMore = () => {
    loadData();
};

const onRemove = async (item: any) => {
    uni.showModal({
        title: '提示',
        content: '确定取消收藏吗？',
        success: async (res) => {
            if (res.confirm) {
                try {
                    await removeFavorite({
                        userId: userInfo.value.id,
                        itemType: activeTab.value,
                        itemId: item.item_id // 注意这里取 item_id
                    });
                    uni.showToast({ title: '已移除' });
                    // 从列表中移除
                    const idx = list.value.findIndex(i => i.item_id === item.item_id);
                    if (idx > -1) list.value.splice(idx, 1);
                } catch (e) {
                    uni.showToast({ title: '操作失败', icon: 'none' });
                }
            }
        }
    });
};

const goToDetail = (item: any) => {
    if (activeTab.value === 'clothing') {
        uni.navigateTo({ url: `/pages/wardrobe/detail?id=${item.item_id}` });
    } else if (activeTab.value === 'outfit') {
        // 跳转到穿搭详情（这里假设穿搭详情页是 create?id=...）
        uni.navigateTo({ url: `/pages/outfit/create?id=${item.item_id}&readonly=true` });
    } else if (activeTab.value === 'post') {
        uni.navigateTo({ url: `/pages/social/detail?id=${item.item_id}` });
    }
};

const formatDate = (str: string) => {
    if (!str) return '';
    return str.split('T')[0];
};

</script>

<style lang="scss" scoped>
.favorites-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #f7f8fa;
}

.content-scroll {
    flex: 1;
    height: 0;
}

.list-container {
    padding: 20rpx;
}

/* 单品 - 宫格布局 */
.clothes-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    
    .grid-item {
        background: #fff;
        border-radius: 12rpx;
        overflow: hidden;
        position: relative;
        
        .cover-img {
            width: 100%;
            height: 220rpx;
            display: block;
        }
        
        .info {
            padding: 10rpx;
            display: flex;
            justify-content: space-between;
            align-items: center;
            
            .name {
                font-size: 22rpx;
                color: #333;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                flex: 1;
                margin-right: 8rpx;
            }
        }
    }
}

/* 搭配 & 帖子 - 列表布局 */
.outfit-list, .post-list {
    .list-item {
        display: flex;
        background: #fff;
        padding: 20rpx;
        border-radius: 16rpx;
        margin-bottom: 20rpx;
        align-items: center;
        
        .list-cover {
            width: 120rpx;
            height: 120rpx;
            border-radius: 8rpx;
            background-color: #f0f0f0;
            margin-right: 20rpx;
        }
        
        .list-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            
            .title-row {
                display: flex;
                align-items: center;
                margin-bottom: 8rpx;
            }

            .list-title {
                font-size: 28rpx;
                color: #333;
                font-weight: 500;
            }
            
            .list-sub {
                font-size: 24rpx;
                color: #999;
            }
        }
        
        .list-action {
            padding-left: 20rpx;
        }
    }
}

.loading-more, .no-more {
    text-align: center;
    padding: 30rpx;
    color: #ccc;
    font-size: 24rpx;
}
</style>
