<template>
    <view class="wardrobe-container">
        <view class="toolbar">
            <van-search class="clothing-search" v-model="searchKey" placeholder="搜索我的衣橱" />
            <van-icon :name="layout === 'layout-grid' ? 'list-switching' : 'apps-o'" size="22px" @click="toggleLayout" />
        </view>

        <view class="decorative-box">
            <text class="box-text">场景化穿搭电子衣橱</text>
        </view>

        <view class="nav-section">
            <van-tabs :active="activeCategoryIndex" @change="onCategoryChange" color="#1989fa" :border="false">
                <van-tab v-for="cat in mainCategories" :key="cat" :title="cat" />
            </van-tabs>

            <view class="filter-bar-container">
                <scroll-view scroll-x class="selected-tags-scroll">
                    <view class="tags-wrapper">
                        <text v-if="selectedTypes.length === 0 && selectedScenes.length === 0"
                            class="default-all-text">全部</text>
                        <van-tag v-for="t in selectedTypes" :key="'t' + t" closeable type="primary" class="mini-tag"
                            @close="toggleTag('type', t)">{{ t }}</van-tag>
                        <van-tag v-for="s in selectedScenes" :key="'s' + s" closeable type="success" class="mini-tag"
                            @close="toggleTag('scene', s)">{{ s }}</van-tag>
                    </view>
                </scroll-view>

                <view class="manage-btn" @click="toggleManageMode">
                    <text>{{ isManageMode ? '取消' : '选择' }}</text>
                </view>

                <view class="expand-filter-btn" :class="{ 'is-active': isExpand }" @click="isExpand = !isExpand">
                    <text>筛选</text>
                    <van-icon :name="isExpand ? 'arrow-up' : 'filter-o'" size="14px" />
                </view>
            </view>

            <view :class="['dropdown-panel', { 'panel-show': isExpand }]">
                <scroll-view scroll-y class="panel-scroll">
                    <view class="panel-content">
                        <view class="filter-group">
                            <view class="group-header"><text class="group-title">衣物细分 (标签)</text></view>
                            <view class="tag-grid">
                                <view v-for="type in filterOptions.types" :key="type" class="tag-chip type-chip"
                                    :class="{ 'type-active': selectedTypes.includes(type) }"
                                    @click="toggleTag('type', type)">{{ type }}</view>
                            </view>
                        </view>
                        <view class="filter-group">
                            <view class="group-header"><text class="group-title">使用场景</text></view>
                            <view class="tag-grid">
                                <view v-for="scene in filterOptions.scenes" :key="scene" class="tag-chip scene-chip"
                                    :class="{ 'scene-active': selectedScenes.includes(scene) }"
                                    @click="toggleTag('scene', scene)">{{ scene }}</view>
                            </view>
                        </view>
                    </view>
                </scroll-view>
                <view class="panel-footer">
                    <button class="footer-btn reset-btn" @click="resetFilters">重置</button>
                    <button class="footer-btn confirm-btn" @click="isExpand = false">确定</button>
                </view>
                <view class="mask" v-if="isExpand" @click="isExpand = false"></view>
            </view>
        </view>

        <scroll-view scroll-y class="list-scroll">
            <view :class="['clothing-grid', layout]">
                <view class="clothing-card" v-for="item in displayList" :key="item.id" @click="handleItemClick(item)">
                    <view class="img-wrapper">
                        <image :src="item.img" mode="aspectFill" class="clothing-img" />
                        <view v-if="isManageMode" class="selection-overlay"
                            :class="{ 'is-selected': isItemSelected(item.id) }">
                            <van-icon :name="isItemSelected(item.id) ? 'checked' : 'circle'"
                                :color="isItemSelected(item.id) ? '#1989fa' : '#fff'" size="24px" />
                        </view>
                    </view>

                    <view class="clothing-info">
                        <text class="name">{{ item.name }}</text>
                        <view class="tag-row">
                            <van-tag type="primary" plain size="mini">{{ item.category }}</van-tag>
                            <van-tag v-if="item.price > 0" type="warning" plain size="mini" custom-style="margin-left: 8rpx">¥{{ item.price }}</van-tag>
                        </view>
                    </view>
                </view>
            </view>
            <van-empty v-if="displayList.length === 0" description="衣橱里空空如也" />
        </scroll-view>

        <view class="fab-btn" @click="handleFabClick">
            <van-icon :name="isManageMode ? 'ellipsis' : 'plus'" size="24px" color="#fff" />
        </view>

        <van-action-sheet :show="showBatchActions" :actions="batchActions" cancel-text="取消" description="请选择批量操作项"
            @select="onBatchActionSelect" @close="showBatchActions = false" />

        <van-action-sheet :show="showAddActions" :actions="addActions" cancel-text="取消" description="录入新单品"
            @select="onAddActionSelect" @close="showAddActions = false" :z-index="10000" />

        <van-action-sheet :show="showProcessActions" :actions="processActions" cancel-text="放弃上传"
            description="AI 智能抠图可使搭配效果更佳" @select="onProcessActionSelect" @close="showProcessActions = false"
            :z-index="10001" />
    </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// --- 状态变量 ---
const allClothes = ref<any[]>([]);
const searchKey = ref('');
const activeCategoryIndex = ref(0);
const isExpand = ref(false);
const layout = ref('layout-grid');
const selectedTypes = ref<string[]>([]);
const selectedScenes = ref<string[]>([]);

// 管理模式
const isManageMode = ref(false);
const selectedItemIds = ref<number[]>([]);
const showBatchActions = ref(false);

const batchActions = [
    { name: '移除衣物', color: '#ee0a24', id: 'remove' },
    { name: '添加到行李箱', color: '#1989fa', id: 'suitcase' }
];

// --- 基础数据配置 (建议与数据库 categories 表 ID 对应) ---
const mainCategories = ['上装', '下装', '裙装', '鞋包'];
const filterOptions = {
    types: ['衬衫', 'T恤', '卫衣', '西装', '针织'],
    scenes: ['职场通勤', '周末休闲', '约会派对', '户外运动']
};

// --- 初始化获取列表 ---
const loadClothesList = () => {
    const userInfo = uni.getStorageSync('userInfo');
    const account = userInfo?.account;

    if (!account) return;

    uni.request({
        url: 'http://localhost:3000/api/clothes/list',
        method: 'GET',
        data: { account: account },
        success: (res: any) => {
            if (res.data.code === 200) {
                allClothes.value = res.data.data.map((item: any) => ({
                    id: item.id,
                    name: item.notes || '我的单品',
                    img: item.image_url,
                    category: item.category_name || '未分类',
                    price: item.price,
                    // 兼容旧数据的显示逻辑
                    type: item.notes || '', 
                    scene: '' 
                }));
            }
        }
    });
};

onMounted(() => { loadClothesList(); });

// --- 过滤逻辑 ---
const displayList = computed(() => {
    return allClothes.value.filter(item => {
        // 1. 匹配大类
        const matchCat = item.category === mainCategories[activeCategoryIndex.value];
        // 2. 匹配搜索关键词
        const matchSearch = item.name.toLowerCase().includes(searchKey.value.toLowerCase());
        // 3. 标签筛选 (如果有标签系统)
        const matchType = selectedTypes.value.length === 0 || selectedTypes.value.includes(item.category);
        
        return matchCat && matchSearch && matchType;
    });
});

// --- 交互逻辑 ---
const toggleManageMode = () => {
    isManageMode.value = !isManageMode.value;
    selectedItemIds.value = [];
};

const isItemSelected = (id: number) => selectedItemIds.value.includes(id);

const handleItemClick = (item: any) => {
    if (isManageMode.value) {
        const index = selectedItemIds.value.indexOf(item.id);
        if (index > -1) selectedItemIds.value.splice(index, 1);
        else selectedItemIds.value.push(item.id);
    } else {
        uni.navigateTo({ url: `/pages/wardrobe/detail?id=${item.id}` });
    }
};

const handleFabClick = () => {
    if (isManageMode.value) {
        if (selectedItemIds.value.length === 0) {
            uni.showToast({ title: '请选择衣物', icon: 'none' });
            return;
        }
        showBatchActions.value = true;
    } else {
        showAddActions.value = true;
    }
};

// --- 批量删除 ---
const onBatchActionSelect = async (event: any) => {
    const action = event.detail || event;
    showBatchActions.value = false;

    if (action.id === 'remove') {
        uni.showModal({
            title: '批量删除',
            content: `确定删除这 ${selectedItemIds.value.length} 件单品吗？`,
            confirmColor: '#ee0a24',
            success: async (res) => {
                if (res.confirm) {
                    uni.showLoading({ title: '正在移除...' });
                    uni.request({
                        url: 'http://localhost:3000/api/clothes/batch-delete',
                        method: 'POST',
                        data: { ids: selectedItemIds.value },
                        success: (res: any) => {
                            if (res.data.code === 200) {
                                uni.showToast({ title: '删除成功' });
                                allClothes.value = allClothes.value.filter(i => !selectedItemIds.value.includes(i.id));
                                toggleManageMode();
                            }
                        },
                        complete: () => uni.hideLoading()
                    });
                }
            }
        });
    }
};

// --- 上传录入逻辑 ---
const showAddActions = ref(false);
const showProcessActions = ref(false);
const tempImagePath = ref('');
const addActions = [{ name: '拍照上传', icon: 'photograph' }, { name: '从相册选择', icon: 'photo' }];
const processActions = [{ name: '导入并自动抠图', id: 'ai-remove', color: '#1989fa' }, { name: '直接导入', id: 'direct' }];

const onAddActionSelect = (event: any) => {
    const action = event.detail || event;
    showAddActions.value = false;
    uni.chooseImage({
        count: 1,
        sourceType: [action.name === '拍照上传' ? 'camera' : 'album'],
        success: (res) => {
            tempImagePath.value = res.tempFilePaths[0];
            showProcessActions.value = true;
        }
    });
};

const onProcessActionSelect = async (event: any) => {
    const action = event.detail || event;
    showProcessActions.value = false;

    uni.showLoading({ title: '正在录入...' });

    const userInfo = uni.getStorageSync('userInfo');
    const categoryId = activeCategoryIndex.value + 1; // 对应数据库 ID

    uni.uploadFile({
        url: 'http://localhost:3000/api/clothes/add',
        filePath: tempImagePath.value,
        name: 'image',
        formData: {
            'account': userInfo?.account || '',
            'category_id': categoryId.toString(),
            'price': '0',
            'notes': action.id === 'ai-remove' ? 'AI抠图单品' : '相册导入单品',
            'scene_ids': '1' // 默认日常场景
        },
        success: (uploadRes) => {
            const resData = JSON.parse(uploadRes.data);
            if (resData.code === 200) {
                uni.showToast({ title: '录入成功', icon: 'success' });
                setTimeout(() => { loadClothesList(); }, 800);
            }
        },
        complete: () => uni.hideLoading()
    });
};

// --- UI辅助逻辑 ---
const toggleTag = (category: 'type' | 'scene', value: string) => {
    const targetArr = category === 'type' ? selectedTypes : selectedScenes;
    const index = targetArr.value.indexOf(value);
    if (index > -1) targetArr.value.splice(index, 1);
    else targetArr.value.push(value);
};
const onCategoryChange = (e: any) => { activeCategoryIndex.value = e.detail.index; };
const resetFilters = () => { selectedTypes.value = []; selectedScenes.value = []; };
const toggleLayout = () => { layout.value = layout.value === 'layout-grid' ? 'layout-column' : 'layout-grid'; };
</script>

<style lang="scss" scoped>
/* 样式部分保持您的原样，已确认无冲突 */
.wardrobe-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #f7f8fa;

    .toolbar {
        display: flex;
        align-items: center;
        padding: 10rpx 25rpx;
        background: #fff;
        .clothing-search { flex: 1; margin-right: 20rpx; }
    }

    .decorative-box {
        height: 100rpx;
        background: linear-gradient(to right, #eceef1, #f7f8fa);
        display: flex;
        align-items: center;
        padding-left: 40rpx;
        .box-text { font-size: 24rpx; color: #909399; }
    }

    .nav-section {
        position: relative;
        z-index: 1000;
        background: #fff;
        .filter-bar-container {
            display: flex;
            align-items: center;
            padding: 15rpx 20rpx;
            background: #fff;
            border-bottom: 1rpx solid #f2f2f2;
            .selected-tags-scroll {
                flex: 1;
                white-space: nowrap;
                .tags-wrapper { display: flex; align-items: center; gap: 10rpx; height: 50rpx; .default-all-text { font-size: 24rpx; color: #999; } }
            }
            .manage-btn { padding: 10rpx 20rpx; font-size: 26rpx; color: #1989fa; }
            .expand-filter-btn {
                display: flex; align-items: center; gap: 4rpx; font-size: 26rpx; color: #646566;
                &.is-active { color: #1989fa; font-weight: bold; }
            }
        }

        .dropdown-panel {
            position: absolute; top: 100%; left: 0; width: 100%; max-height: 0; overflow: hidden; transition: all 0.3s ease; background: #fff;
            &.panel-show { max-height: 80vh; box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.1); }
            .panel-footer {
                padding: 20rpx 30rpx; display: flex; gap: 20rpx; border-top: 1rpx solid #f2f2f2;
                .footer-btn { flex: 1; height: 70rpx; line-height: 70rpx; font-size: 26rpx; border-radius: 35rpx;
                    &.confirm-btn { background: #1989fa; color: #fff; }
                }
            }
        }
        .mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); z-index: -1; }
    }

    .list-scroll {
        flex: 1; padding: 20rpx;
        .clothing-grid {
            display: grid; gap: 20rpx;
            &.layout-grid { grid-template-columns: 1fr 1fr; }
            &.layout-column { grid-template-columns: 1fr; }
        }
        .clothing-card {
            background: #fff; border-radius: 12rpx; overflow: hidden; position: relative;
            .img-wrapper {
                position: relative; width: 100%; height: 320rpx;
                .clothing-img { width: 100%; height: 100%; }
                .selection-overlay {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.3);
                    display: flex; align-items: center; justify-content: center;
                    &.is-selected { background: rgba(25, 137, 250, 0.2); }
                }
            }
            .clothing-info { padding: 15rpx; .name { font-size: 26rpx; margin-bottom: 8rpx; display: block; } }
        }
    }
}

.fab-btn {
    position: fixed; right: 40rpx; bottom: 140rpx; width: 100rpx; height: 100rpx; background-color: #1989fa;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8rpx 20rpx rgba(25, 137, 250, 0.4); z-index: 99;
}
</style>