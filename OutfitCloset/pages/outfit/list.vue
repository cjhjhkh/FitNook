<template>
  <view class="container">
    <van-search
        v-model="searchKeyword"
        placeholder="搜索穿搭名称/标签"
        @search="onSearch"
        shape="round"
        background="#f7f8fa"
    />

    <view class="outfit-grid" v-if="outfitList.length > 0">
        <view 
            class="outfit-item" 
            v-for="(item, index) in outfitList" 
            :key="item.id"
            @click="onItemClick(item)"
        >
            <image :src="item.image_url" mode="aspectFill" class="cover-image"></image>
            <view class="info">
                <text class="name">{{ item.name || '未命名搭配' }}</text>
                <view class="tags">
                     <van-tag v-if="item.scene" plain type="primary" size="mini" custom-class="tag-item">{{ item.scene }}</van-tag>
                     <van-tag v-if="item.season" plain type="success" size="mini" custom-class="tag-item">{{ item.season }}</van-tag>
                </view>
            </view>
            
            <!-- 如果是普通模式，显示删除按钮 -->
            <view class="delete-btn" v-if="mode === 'view'" @click.stop="onDeleteClick(item, index)">
                <van-icon name="delete-o" color="#ee0a24" size="16px"/>
            </view>
        </view>
    </view>
    
    <van-empty v-else-if="!loading" description="暂无搭配记录" />
    
    <view class="loading-more" v-if="loading">
        <van-loading size="24px" type="spinner">加载中...</van-loading>
    </view>
    <view class="no-more" v-if="!hasMore && outfitList.length > 0 && !loading">
        <text>— 没有更多数据了 —</text>
    </view>

    <!-- 添加按钮 (仅View模式) -->
    <view class="fab-btn" v-if="mode === 'view'" @click="goCreate">
        <van-icon name="plus" color="#fff" size="24px" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onReachBottom, onShow } from '@dcloudio/uni-app';
import { getOutfitList, deleteOutfit, addToCalendar } from '@/api/outfit';

const mode = ref('view'); // 'view' | 'select' | 'select_one'
const targetDate = ref('');
const searchKeyword = ref('');
const outfitList = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const hasMore = ref(true);

const selectionMode = ref(false); // 是否处于选择模式

onLoad((options: any) => {
    if (options.mode) {
        mode.value = options.mode;
    }

    if (mode.value === 'select') {
        selectionMode.value = true;
        uni.setNavigationBarTitle({ title: '选择穿搭加入日历' });
    } else if (mode.value === 'select_one') {
        selectionMode.value = true;
        uni.setNavigationBarTitle({ title: '选择一套搭配' });
    } else {
        uni.setNavigationBarTitle({ title: '我的搭配库' });
    }

    if (options.targetDate) {
        targetDate.value = options.targetDate;
    }
    refreshList();
});

onShow(() => {
    refreshList();
});

const refreshList = () => {
    page.value = 1;
    outfitList.value = [];
    hasMore.value = true;
    loadData();
};

const loadData = async () => {
    if (loading.value || !hasMore.value) return;
    
    loading.value = true;
    try {
        const userInfo = uni.getStorageSync('userInfo');
        const account = userInfo ? userInfo.account : '';
        
        if (!account) {
            // 防止未登录导致死循环或错误调用
            loading.value = false;
            return;
        }

        const params = {
            account, // API might need account to filter user's outfits
            page: page.value,
            pageSize: pageSize.value,
            keyword: searchKeyword.value
        };
        const res = await getOutfitList(params);
        if (res.code === 200) {
            // 兼容后端可能返回 { list: [], total: 0 } 或者直接 []
            let newItems = [];
            if (Array.isArray(res.data)) {
                newItems = res.data;
            } else if (res.data && Array.isArray(res.data.list)) {
                newItems = res.data.list;
            }
            
            if (newItems.length < pageSize.value) {
                hasMore.value = false;
            }
            
            if (page.value === 1) {
                outfitList.value = newItems;
            } else {
                outfitList.value = [...outfitList.value, ...newItems];
            }
            page.value++;
        }
    } catch (e) {
        console.error(e);
        uni.showToast({ title: '加载失败', icon: 'none' });
    } finally {
        loading.value = false;
    }
};

const onSearch = () => {
    refreshList();
};

onReachBottom(() => {
    loadData();
});

const goCreate = () => {
    uni.navigateTo({
        url: '/pages/outfit/create'
    });
};

const onItemClick = async (item: any) => {
    if (selectionMode.value) {
        // 模式1: 社区发布/单选通用模式
        if (mode.value === 'select_one') {
            uni.$emit('outfitSelected', item); // 发送选中事件
            uni.navigateBack();
            return;
        }

        // 模式2: 日历多选模式
        if (!targetDate.value) {
            uni.showToast({ title: '参数缺失：日期', icon: 'none' });
            return;
        }

        // 调用添加日历 API
        uni.showLoading({ title: '添加中...' });
        try {
            const userInfo = uni.getStorageSync('userInfo');
            const account = userInfo ? userInfo.account : '';
            
            const res = await addToCalendar({
                account: account,
                outfit_id: item.id,
                date: targetDate.value
            }) as any;

            if (res.code === 200) {
                uni.showToast({ title: '添加成功', icon: 'success' });
                setTimeout(() => {
                    uni.navigateBack();
                }, 1000);
            } else {
                uni.showToast({ title: res.msg || '添加失败', icon: 'none' });
            }
        } catch (error) {
            console.error(error);
            uni.showToast({ title: '网络错误', icon: 'none' });
        } finally {
            uni.hideLoading();
        }
    } else {
        // 原有逻辑：跳转详情
        uni.navigateTo({
            url: `/pages/outfit/create?id=${item.id}`
        });
    }
};

const onDeleteClick = (item: any, index: number) => {
    uni.showModal({
        title: '删除提示',
        content: '确定要删除这个穿搭方案吗？',
        confirmColor: '#ee0a24',
        success: async (res) => {
            if (res.confirm) {
                try {
                    await deleteOutfit(item.id);
                    uni.showToast({ title: '已删除', icon: 'success' });
                    // 从列表中移除
                    outfitList.value.splice(index, 1);
                } catch (e) {
                    uni.showToast({ title: '删除失败', icon: 'none' });
                }
            }
        }
    });
};
</script>

<style lang="scss">
.container {
    min-height: 100vh;
    background-color: #f7f8fa;
    padding-bottom: 40rpx;
}

.outfit-grid {
    display: flex;
    flex-wrap: wrap;
    padding: 24rpx;
    justify-content: space-between;
}

.outfit-item {
    width: 338rpx; 
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    margin-bottom: 24rpx;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.03);
    position: relative;
    padding-bottom: 16rpx;
    
    .cover-image {
        width: 100%;
        height: 450rpx; 
        background-color: #f0f0f0;
    }
    
    .info {
        padding: 12rpx 16rpx;
        
        .name {
            font-size: 28rpx;
            color: #333;
            font-weight: 500;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 1;
            overflow: hidden;
            margin-bottom: 12rpx;
        }
        
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8rpx;
            min-height: 32rpx;
        }
        
        .tag-item {
            margin-right: 0 !important;
        }
    }
    
    .delete-btn {
        position: absolute;
        top: 10rpx;
        right: 10rpx;
        background: rgba(255,255,255,0.9);
        width: 56rpx;
        height: 56rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
        z-index: 1;
    }
}

.loading-more, .no-more {
    text-align: center;
    padding: 30rpx 0;
    color: #999;
    font-size: 24rpx;
    display: flex;
    justify-content: center;
    align-items: center;
}

.fab-btn {
    position: fixed;
    right: 40rpx;
    bottom: 80rpx;
    width: 100rpx;
    height: 100rpx;
    background-color: #07c160;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, 0.4);
    z-index: 99;
    
    &:active {
        transform: scale(0.95);
        opacity: 0.9;
    }
}
</style>
