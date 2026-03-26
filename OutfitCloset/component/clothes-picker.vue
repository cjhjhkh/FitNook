<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    custom-style="height: 75%; border-radius: 32rpx 32rpx 0 0; overflow: hidden;"
    @close="onClose"
  >
    <view class="picker-container">
      <!-- 头部区域 -->
      <view class="picker-header">
        <view class="header-top">
            <text class="title">选择搭配单品</text>
            <view class="close-btn" @tap="onClose" hover-class="btn-hover">
                <van-icon name="cross" size="20" color="#999" />
            </view>
        </view>
        <view class="header-tabs">
            <view class="tab-item active">全部</view>
            <view class="tab-item">上装</view>
            <view class="tab-item">下装</view>
            <view class="tab-item">鞋靴</view>
        </view>
      </view>

      <!-- 列表区域 -->
      <scroll-view scroll-y class="picker-body" @scrolltolower="loadMore">
        <view class="grid-layout">
          <view 
            class="grid-item" 
            v-for="(item, index) in list" 
            :key="item.id || index"
            @tap="selectItem(item)"
          >
            <image :src="item.image_url" mode="aspectFill" class="item-img" />
            
            <!-- 选中遮罩 -->
            <transition name="fade">
                <view class="selected-mask" v-if="selectedId === item.id">
                    <view class="check-circle">
                        <van-icon name="success" color="#fff" size="16" />
                    </view>
                </view>
            </transition>
            
            <view class="item-info">
                <text class="item-name">{{ item.name }}</text>
            </view>
          </view>
        </view>
        
        <view v-if="loading" class="loading-more">
            <van-loading type="spinner" size="24px" color="#1989fa" vertical>加载中...</van-loading>
        </view>
        <view v-if="!loading && list.length === 0" class="empty-state">
             <van-empty description="暂无单品，快去衣橱添加吧" />
        </view>
      </scroll-view>

      <!-- 底部按钮区 -->
      <view class="picker-footer safe-area-bottom">
        <view class="confirm-btn" :class="{ disabled: !selectedId }" @tap="confirm" hover-class="btn-active">
            <text>发送给 AI 搭配师</text>
            <van-icon name="share-o" style="margin-left: 8rpx;" />
        </view>
      </view>
    </view>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { getClothesList } from '@/api/clothes';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits(['close', 'confirm']);

const list = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const finished = ref(false);
const selectedId = ref<number | null>(null);
const selectedItemData = ref<any>(null);

// 监听显示，重置并加载数据
watch(() => props.show, (val) => {
    if (val && list.value.length === 0) {
        list.value = []; // 清空可能存在的旧数据? 其实保留也没事，这里选择保留缓存体验更好
        if(list.value.length === 0) fetchData();
    }
});

const fetchData = async () => {
    if (loading.value || finished.value) return;
    loading.value = true;
    
    try {
        const userId = uni.getStorageSync('userInfo')?.id;
        if (!userId) return;

        // 复用已有的衣橱列表接口
        const res:any = await getClothesList({ 
            userId, 
            page: page.value, 
            pageSize: 20 
        });
        
        if (res.code === 200) {
            const newItems = res.data.list || [];
            if (newItems.length < 20) {
                finished.value = true;
            }
            // 简单去重，防止 key 重复报错
            const existingIds = new Set(list.value.map(i => i.id));
            const uniqueNewItems = newItems.filter((i:any) => !existingIds.has(i.id));
            
            list.value = [...list.value, ...uniqueNewItems];
            page.value++;
        }
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const loadMore = () => {
    fetchData();
};

const onClose = () => {
    emit('close');
};

const selectItem = (item: any) => {
    if (selectedId.value === item.id) {
        selectedId.value = null;
        selectedItemData.value = null;
    } else {
        selectedId.value = item.id;
        selectedItemData.value = item;
    }
};

const confirm = () => {
    if (!selectedId.value) return;
    emit('confirm', selectedItemData.value);
    onClose();
    // 每次发送后重置选择
    selectedId.value = null;
    selectedItemData.value = null;
};
</script>

<style lang="scss" scoped>
.picker-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fff;
}

.picker-header {
    flex-shrink: 0;
    padding: 30rpx 30rpx 10rpx;
    background: #fff;
    z-index: 10;
    
    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24rpx;

        .title {
            font-size: 34rpx;
            font-weight: 700;
            color: #333;
        }
        
        .close-btn {
            width: 60rpx;
            height: 60rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f7f8fa;
            border-radius: 50%;
            &.btn-hover { background: #eee; }
        }
    }
    
    .header-tabs {
        display: flex;
        overflow-x: auto;
        padding-bottom: 10rpx;
        
        .tab-item {
            padding: 10rpx 28rpx;
            background: #f5f6f8;
            border-radius: 30rpx;
            font-size: 26rpx;
            color: #666;
            margin-right: 20rpx;
            white-space: nowrap;
            transition: all 0.2s;
            
            &.active {
                background: #eaf4fe;
                color: #1989fa;
                font-weight: 600;
            }
        }
    }
}

.picker-body {
    flex: 1;
    background: #f7f8fa;
    padding: 24rpx;
    box-sizing: border-box; 
}

.grid-layout {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20rpx;
    padding-bottom: 40rpx;
}

.grid-item {
    position: relative;
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    padding-bottom: 100%; /* 保持正方形 */
    height: 0;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.04);
    transition: transform 0.1s;
    
    &:active {
        transform: scale(0.98);
    }
    
    .item-img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    
    .item-info {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
        padding: 20rpx 10rpx 10rpx;
        
        .item-name {
            color: #fff;
            font-size: 22rpx;
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }

    .selected-mask {
        position: absolute;
        top: 0; 
        left: 0; 
        right: 0; 
        bottom: 0;
        background: rgba(25, 137, 250, 0.2);
        border: 4rpx solid #1989fa;
        border-radius: 16rpx;
        z-index: 2;
        
        .check-circle {
            position: absolute;
            top: 10rpx;
            right: 10rpx;
            width: 36rpx;
            height: 36rpx;
            background: #1989fa;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    }
}

.loading-more {
    display: flex;
    justify-content: center;
    padding: 30rpx;
    align-items: center;
}

.picker-footer {
    padding: 20rpx 30rpx;
    padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
    background: #fff;
    border-top: 1rpx solid #f0f0f0;
    
    .confirm-btn {
        height: 88rpx;
        background: linear-gradient(135deg, #1989fa, #3a9efb);
        border-radius: 44rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 30rpx;
        font-weight: 600;
        box-shadow: 0 8rpx 20rpx rgba(25, 137, 250, 0.3);
        transition: all 0.2s;
        
        &.disabled {
            background: #e0e0e0;
            box-shadow: none;
            color: #999;
        }
        &.btn-active {
            opacity: 0.9;
            transform: scale(0.99);
        }
    }
}
</style>