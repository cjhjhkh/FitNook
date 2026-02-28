<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    custom-style="height: 70%;"
    @close="onClose"
  >
    <view class="picker-container">
      <view class="picker-header">
        <text class="title">选择单品</text>
        <view class="actions">
            <!-- 简单的分类筛选，为了简化暂只做 UI -->
            <van-tag type="primary" plain style="margin-right: 10rpx;">全部</van-tag>
            <van-tag plain>上装</van-tag>
        </view>
        <van-icon name="cross" size="20" @click="onClose" color="#999" />
      </view>

      <scroll-view scroll-y class="picker-body" @scrolltolower="loadMore">
        <view class="grid-layout">
          <view 
            class="grid-item" 
            v-for="(item, index) in list" 
            :key="item.id"
            @click="selectItem(item)"
          >
            <image :src="item.image_url" mode="aspectFill" class="item-img" />
            <view class="item-name">{{ item.name }}</view>
            <!-- 选中态遮罩 -->
            <view class="selected-mask" v-if="selectedId === item.id">
                <van-icon name="success" color="#fff" size="24" />
            </view>
          </view>
        </view>
        
        <view v-if="loading" class="loading-more">
            <van-loading type="spinner" size="20px">加载中...</van-loading>
        </view>
        <van-empty v-if="!loading && list.length === 0" description="暂无单品" />
      </scroll-view>

      <view class="picker-footersafe">
        <van-button type="info" block round @click="confirm">发送给 AI</van-button>
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
        fetchData();
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
            list.value = [...list.value, ...newItems];
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
    if (!selectedId.value) {
        uni.showToast({ title: '请先选择一件单品', icon: 'none' });
        return;
    }
    emit('confirm', selectedItemData.value);
    onClose();
};
</script>

<style lang="scss" scoped>
.picker-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 30rpx;
    border-bottom: 2rpx solid #eee;

    .title {
        font-size: 32rpx;
        font-weight: bold;
    }
    .actions {
        flex: 1;
        margin-left: 20rpx;
    }
}

.picker-body {
    flex: 1;
    background: #f7f8fa;
    padding: 20rpx;
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
    border-radius: 12rpx;
    overflow: hidden;
    height: 240rpx;
    
    .item-img {
        width: 100%;
        height: 100%;
    }
    
    .item-name {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.5);
        color: #fff;
        font-size: 20rpx;
        padding: 8rpx;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .selected-mask {
        position: absolute;
        top: 0; 
        left: 0; 
        right: 0; 
        bottom: 0;
        background: rgba(25, 137, 250, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 4rpx solid #1989fa;
    }
}

.picker-footersafe {
    padding: 20rpx 30rpx 40rpx; 
    background: #fff;
    border-top: 2rpx solid #eee;
}

.loading-more {
    display: flex;
    justify-content: center;
    padding: 20rpx;
}
</style>