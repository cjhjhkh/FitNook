<template>
    <view class="detail-page">
        <van-skeleton title avatar row="10" :loading="loading">
            <view v-if="details" class="content">
                <view class="image-box">
                    <image :src="details.image_url" mode="aspectFill" class="main-img" @click="previewImg" />
                </view>

                <view class="info-card">
                    <view class="header">
                        <text class="title">{{ details.description || '未命名单品' }}</text>
                        <van-tag type="primary" size="medium">{{ details.category_name }}</van-tag>
                    </view>

                    <view class="detail-list">
                        <view class="item">
                            <text class="label">适用季节</text>
                            <text class="value">{{ details.season || '四季' }}</text>
                        </view>
                        <view class="item">
                            <text class="label">材质/面料</text>
                            <text class="value">{{ details.material || '常规' }}</text>
                        </view>
                        <view class="item">
                            <text class="label">入库时间</text>
                            <text class="value">{{ formatDate(details.created_at) }}</text>
                        </view>
                    </view>
                </view>

                <view class="bottom-bar">
                    <button class="action-btn delete-btn" @click="handleDelete">
                        <van-icon name="delete-o" /> 删除单品
                    </button>
                    <button class="action-btn edit-btn" @click="handleEdit">
                        <van-icon name="edit" /> 编辑信息
                    </button>
                </view>
            </view>

            <van-empty v-else description="该衣物信息已丢失" />
        </van-skeleton>
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const details = ref<any>(null);
const loading = ref(true);

onLoad((options) => {
    // 调试用：确认是否收到 ID
    console.log('收到页面参数:', options);
    const clothesId = options?.id;
    if (clothesId) {
        fetchClothesDetail(clothesId);
    } else {
        uni.showToast({ title: '参数无效', icon: 'none' });
    }
});

// --- 核心业务逻辑 ---

const fetchClothesDetail = (id: string) => {
    loading.value = true;
    uni.request({
        url: `http://localhost:3000/api/clothes/detail/${id}`,
        method: 'GET',
        header: {
            'Authorization': `Bearer ${uni.getStorageSync('token')}`
        },
        success: (res: any) => {
            if (res.data.code === 200) {
                // 注意：Vue3 setup 中直接给 ref 赋值，不使用 this
                details.value = res.data.data;
            } else {
                uni.showToast({ title: res.data.message || '查询失败', icon: 'none' });
            }
        },
        fail: () => {
            uni.showToast({ title: '网络请求失败', icon: 'none' });
        },
        complete: () => {
            loading.value = false;
        }
    });
};

// --- 功能操作 ---

// 预览大图
const previewImg = () => {
    uni.previewImage({
        urls: [details.value.image_url]
    });
};

// 删除逻辑（复用你的批量删除逻辑，只传一个 ID）
const handleDelete = () => {
    uni.showModal({
        title: '确认删除',
        content: '确定要从衣橱中移除这件单品吗？',
        confirmColor: '#ee0a24',
        success: (res) => {
            if (res.confirm) {
                uni.request({
                    url: 'http://localhost:3000/api/clothes/batch-delete',
                    method: 'POST',
                    data: { ids: [details.value.id] },
                    success: (resData: any) => {
                        if (resData.data.code === 200) {
                            uni.showToast({ title: '删除成功' });
                            // 返回列表页
                            setTimeout(() => uni.navigateBack(), 1000);
                        }
                    }
                });
            }
        }
    });
};

const handleEdit = () => {
    uni.showToast({ title: '编辑功能开发中', icon: 'none' });
};

// 简单的日期格式化
const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};
</script>

<style lang="scss" scoped>
.detail-page {
    min-height: 100vh;
    background-color: #f7f8fa;
    padding-bottom: 120rpx;

    .image-box {
        width: 100%;
        height: 750rpx;
        background-color: #fff;
        .main-img {
            width: 100%;
            height: 100%;
        }
    }

    .info-card {
        margin: -40rpx 20rpx 20rpx;
        background: #fff;
        border-radius: 24rpx;
        padding: 40rpx;
        position: relative;
        box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05);

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40rpx;
            .title {
                font-size: 36rpx;
                font-weight: bold;
                color: #323233;
            }
        }

        .detail-list {
            .item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 25rpx;
                font-size: 28rpx;
                .label { color: #969799; }
                .value { color: #323233; font-weight: 500; }
            }
        }
    }

    .bottom-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 100rpx;
        background: #fff;
        display: flex;
        padding: 10rpx 30rpx;
        padding-bottom: env(safe-area-inset-bottom);
        border-top: 1rpx solid #ebedf0;

        .action-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28rpx;
            border-radius: 50rpx;
            margin: 0 10rpx;
            &::after { border: none; }

            &.delete-btn {
                background: #fff;
                color: #ee0a24;
                border: 1px solid #ee0a24;
            }
            &.edit-btn {
                background: #1989fa;
                color: #fff;
            }
        }
    }
}
</style>