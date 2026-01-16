<template>
    <view class="tag-manager-page">
        <van-tabs :active="activeTab" @change="onTabChange" color="#1989fa" animated sticky>
            <van-tab title="种类" name="CATEGORY">
                <view class="tab-content">
                    <view class="tag-grid">
                        <view v-for="item in categories" :key="item.id" class="tag-item">
                            <text>{{ item.name }}</text>
                            <view class="del-btn" @tap.stop="confirmDelete(item.id)">
                                <van-icon name="cross" size="10px" color="#fff" />
                            </view>
                        </view>
                        <view class="tag-item add" @tap="showAddDialog('CATEGORY')">
                            <van-icon name="plus" size="16px" />
                            <text>新增</text>
                        </view>
                    </view>
                </view>
            </van-tab>
            <van-tab title="场景" name="SCENE">
                <view class="tab-content">
                    <view class="tag-grid">
                        <view v-for="item in scenes" :key="item.id" class="tag-item">
                            <text>{{ item.name }}</text>
                            <view class="del-btn" @tap.stop="confirmDelete(item.id)">
                                <van-icon name="cross" size="10px" color="#fff" />
                            </view>
                        </view>
                        <view class="tag-item add" @tap="showAddDialog('SCENE')">
                            <van-icon name="plus" size="16px" />
                            <text>新增</text>
                        </view>
                    </view>
                </view>
            </van-tab>
            <van-tab title="季节" name="SEASON">
                <view class="tab-content">
                    <view class="tag-grid">
                        <view v-for="item in seasons" :key="item.id" class="tag-item">
                            <text>{{ item.name }}</text>
                            <!-- 季节通常比较固定，但也允许删除自定义的 -->
                            <view class="del-btn" @tap.stop="confirmDelete(item.id)">
                                <van-icon name="cross" size="10px" color="#fff" />
                            </view>
                        </view>
                        <view class="tag-item add" @tap="showAddDialog('SEASON')">
                            <van-icon name="plus" size="16px" />
                            <text>新增</text>
                        </view>
                    </view>
                </view>
            </van-tab>
        </van-tabs>

        <!-- 新增标签弹窗：改为使用 van-popup 自定义，以确保稳定显示 -->
        <van-popup
            :show="isShowAdd"
            round
            custom-style="width: 80%; overflow: hidden;"
            @close="isShowAdd = false"
        >
            <view class="custom-dialog">
                <view class="dialog-title">新增标签</view>
                <view class="dialog-content">
                    <input
                        class="custom-input"
                        placeholder="请输入标签名称"
                        :value="newTagName"
                        @input="onInputChange"
                        :focus="isShowAdd"
                    />
                </view>
                <view class="dialog-footer">
                    <view class="dialog-btn cancel" @tap="isShowAdd = false">取消</view>
                    <view class="dialog-btn confirm" @tap="submitAdd">确定</view>
                </view>
            </view>
        </van-popup>
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { 
    getCategories, 
    getScenes, 
    getSeasons, 
    addTag, 
    batchDeleteTags 
} from '@/api/clothes';

const activeTab = ref('CATEGORY');
const categories = ref<any[]>([]);
const scenes = ref<any[]>([]);
const seasons = ref<any[]>([]);

const isShowAdd = ref(false);
const newTagName = ref('');
const currentAddType = ref<'CATEGORY' | 'SCENE' | 'SEASON'>('CATEGORY');

onShow(() => {
    fetchAllTags();
});

const fetchAllTags = () => {
    getCategories().then((res: any) => {
        categories.value = res.data || [];
    });
    getScenes().then((res: any) => {
        scenes.value = res.data || [];
    });
    getSeasons().then((res: any) => {
        seasons.value = res.data || [];
    });
};

const onTabChange = (e: any) => {
    activeTab.value = e.detail.name;
};

const showAddDialog = (type: 'CATEGORY' | 'SCENE' | 'SEASON') => {
    currentAddType.value = type;
    newTagName.value = '';
    isShowAdd.value = true;
};

const onInputChange = (e: any) => {
    // 原生 input 事件，使用 e.detail.value 获取值
    newTagName.value = e.detail.value;
};

const submitAdd = () => {
    if (!newTagName.value || !newTagName.value.trim()) {
        uni.showToast({ title: '名称不能为空', icon: 'none' });
        return;
    }
    
    addTag({ 
        names: newTagName.value, 
        type: currentAddType.value 
    }).then((res: any) => {
        if (res.code === 200) {
            uni.showToast({ title: '添加成功' });
            isShowAdd.value = false;
            fetchAllTags();
        } else {
             uni.showToast({ title: res.msg || '添加失败', icon: 'none' });
        }
    });
};

const confirmDelete = (id: number) => {
    uni.showModal({
        title: '提示',
        content: '确定要删除该标签吗？',
        success: (res) => {
            if (res.confirm) {
                batchDeleteTags([id]).then((resp: any) => {
                    if (resp.code === 200) {
                        uni.showToast({ title: '删除成功' });
                        fetchAllTags();
                    }
                });
            }
        }
    });
};
</script>

<style lang="scss" scoped>
.tag-manager-page {
    min-height: 100vh;
    background-color: #f7f8fa;
}

.tab-content {
    padding: 30rpx;
}

.tag-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20rpx;
}

.tag-item {
    position: relative;
    height: 72rpx;
    padding: 0 30rpx;
    background: #fff;
    border-radius: 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    color: #333;
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
    
    .del-btn {
        position: absolute;
        top: -10rpx;
        right: -10rpx;
        width: 32rpx;
        height: 32rpx;
        background: #ee0a24;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
    }
    
    &.add {
        background: #f0f9ff;
        color: #1989fa;
        border: 1px dashed #1989fa;
        
        text {
            margin-left: 8rpx;
        }
    }
}

.dialog-input-wrap {
    padding: 40rpx 30rpx;
}

/* 自定义弹窗样式 */
.custom-dialog {
    background: #fff;
    
    .dialog-title {
        padding: 40rpx 0 20rpx;
        text-align: center;
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
    }
    
    .dialog-content {
        padding: 20rpx 40rpx 40rpx;
    }
    
    .custom-input {
        width: 100%;
        height: 80rpx;
        background: #f7f8fa;
        border-radius: 8rpx;
        padding: 0 24rpx;
        box-sizing: border-box;
        font-size: 28rpx;
        color: #333;
    }
    
    .dialog-footer {
        display: flex;
        border-top: 2rpx solid #f5f5f5;
        
        .dialog-btn {
            flex: 1;
            height: 96rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30rpx;
            
            &.cancel {
                color: #666;
                border-right: 2rpx solid #f5f5f5;
            }
            
            &.confirm {
                color: #1989fa;
                font-weight: bold;
            }
            
            &:active {
                background-color: #f9f9f9;
            }
        }
    }
}
</style>