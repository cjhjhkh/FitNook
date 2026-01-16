<template>
    <view class="wardrobe-page">
        <view class="sticky-header">
            <view class="top-tool-row">
                <view class="search-box">
                    <van-search v-model="searchKeyword" placeholder="搜索单品" shape="round" background="transparent"
                        class="custom-search" @search="loadClothesList" />
                </view>

                <scroll-view class="season-scroll" scroll-x enhanced :show-scrollbar="false">
                    <view class="season-wrap">
                        <view v-for="s in seasons" :key="s.name" class="season-item"
                            :class="{ active: activeSeason === s.name }" @tap="handleSeasonChange(s.name)">
                            <view class="item-content" :style="activeSeason === s.name ? { backgroundColor: s.backgroundColor, boxShadow: '0 2rpx 8rpx rgba(0,0,0,0.05)' } : {}">
                                <view class="icon-box" :style="{ backgroundColor: activeSeason === s.name ? '#ffffff' : s.backgroundColor }">
                                    <van-icon :name="s.icon" size="14px" class="s-icon" :color="activeSeason === s.name ? '#333' : '#666'" />
                                </view>
                                <text v-if="activeSeason === s.name" class="s-text">{{ s.name }}</text>
                            </view>
                        </view>
                    </view>
                </scroll-view>

                <view class="layout-toggle" @tap="toggleLayout">
                    <van-icon :name="isGridLayout ? 'apps-o' : 'orders-o'" size="22px" color="#666" style="pointer-events: none;" />
                </view>
                
                <!-- 新增：标签管理入口 -->
                <view class="layout-toggle" @tap="openTagManager" style="margin-left: 16rpx;">
                    <van-icon name="setting-o" size="22px" color="#666" />
                </view>
            </view>
        </view>

        <view class="filter-action-bar">
            <view class="left-tools" @tap="showFilter = true">
                <van-icon name="filter-o" size="18px" />
                <text class="filter-text">筛选</text>
                <view class="filter-dot"></view>
            </view>
            <view class="center-status">
                <template v-if="!isSelectMode">
                    <!-- 如果有筛选标签，显示标签列表 -->
                    <scroll-view v-if="activeFilterTags.length > 0" scroll-x class="filter-tags-scroll" :show-scrollbar="false">
                        <view class="filter-tags-row">
                            <view v-for="tag in activeFilterTags" :key="`${tag.type}-${tag.id}`" class="active-filter-tag" @tap="removeFilterTag(tag)">
                                <text>{{ tag.name }}</text>
                                <van-icon name="cross" size="12px" class="close-icon" />
                            </view>
                        </view>
                    </scroll-view>
                    <!-- 否则显示默认标题 -->
                    <text v-else class="status-tag">{{ activeSeason }}衣物</text>
                </template>
            </view>
            <view class="right-tools" @tap="toggleSelectMode">
                <view class="select-trigger" :class="{ editing: isSelectMode }">
                    {{ isSelectMode ? '取消' : '选择' }}
                </view>
            </view>
        </view>

        <scroll-view class="main-list" scroll-y @scrolltolower="onScrollToLower">
            <view v-for="group in clothGroups" :key="group.category" class="group-section">
                <view class="group-title">
                    {{ group.category }} <text class="num">{{ group.list.length }}</text>
                </view>

                <view v-if="isGridLayout" class="grid-container transition-fade">
                    <view v-for="item in group.list" :key="item.id" class="cloth-card-grid" @tap="handleCardTap(item)">
                        <view class="img-wrapper">
                            <image :src="item.image" mode="aspectFill" class="cloth-img" />

                            <!-- 选择模式下的半透明蒙板，点击切换选中 -->
                            <view v-if="isSelectMode" class="select-mask" @tap.stop="() => toggleSelectByTap(item.id)">
                                <!-- 右上角显示圆形选中图标 -->
                                <view class="select-icon" :class="{ checked: selectedIds.includes(item.id) }"
                                    @tap.stop="() => toggleSelectByTap(item.id)">
                                    <van-icon v-if="selectedIds.includes(item.id)" name="success" color="#fff"
                                        size="18px" />
                                </view>
                            </view>

                            <view v-if="isSelectMode" class="check-overlay">
                                <van-checkbox :name="item.id" icon-size="16px" shape="round"
                                    :checked="selectedIds.includes(item.id)" @change="bindSelectHandler(item.id)" />
                            </view>
                        </view>
                        
                        <!-- 标签行：单行显示，超出省略 -->
                        <view class="tag-row">
                            <text v-for="tag in item.tags" :key="tag.name" class="mini-tag"
                                :style="{ backgroundColor: tag.color }">{{ tag.name }}</text>
                        </view>
                    </view>
                </view>

                <view v-else class="list-container transition-fade">
                    <view v-for="item in group.list" :key="item.id" class="cloth-card-list" @tap="handleCardTap(item)">
                        <view class="list-img-box">
                            <image :src="item.image" mode="aspectFill" class="cloth-img-l" />

                            <!-- 列表布局也加入选择蒙板 -->
                            <view v-if="isSelectMode" class="select-mask" @tap.stop="() => toggleSelectByTap(item.id)">
                                <view class="select-icon" :class="{ checked: selectedIds.includes(item.id) }"
                                    @tap.stop="() => toggleSelectByTap(item.id)">
                                    <van-icon v-if="selectedIds.includes(item.id)" name="success" color="#fff"
                                        size="18px" />
                                </view>
                            </view>

                            <view v-if="isSelectMode" class="check-overlay-l">
                                <van-checkbox :name="item.id" icon-size="18px" :checked="selectedIds.includes(item.id)"
                                    @change="bindSelectHandler(item.id)" />
                            </view>
                        </view>
                        <view class="cloth-details">
                            <view class="price-row">
                                <text class="cost-per">¥{{ item.costPerTime.toFixed(2) }}/次</text>
                                <text class="item-price">¥{{ item.price }}</text>
                            </view>
                            <view class="info-row">
                                <text>已穿 {{ item.times }} 次 · 导入于 {{ item.date }}</text>
                            </view>
                            <view class="tag-row-l">
                                <view v-for="tag in item.tags" :key="tag.name" class="tag-label"
                                    :style="{ color: tag.color, borderColor: tag.color }">
                                    {{ tag.name }}
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
            </view>
            <view class="loading-status" v-if="isLoading || isFinished">
                <van-loading v-if="isLoading" size="24px" type="spinner">加载中...</van-loading>
                <text v-else-if="isFinished && clothingList.length > 0" class="no-more">没有更多了</text>
            </view>
            <view class="safe-area-bottom"></view>
        </scroll-view>

        <view v-if="isSelectMode" class="batch-bar animate-slide-up">
            <view class="batch-info">
                已选 {{ selectedIds.length }} 件
            </view>
            <view class="batch-btn del" @tap="batchDeleteSelected">
                <van-icon name="delete-o" />
                <text>批量删除</text>
            </view>
            <view class="batch-btn tag" @tap="openTagPopup">
                <van-icon name="label-o" />
                <text>添加标签</text>
            </view>
        </view>

        <view class="fab-add" @tap="showAddPopup = true">
            <van-icon name="plus" size="28px" color="#FFF" />
        </view>

        <van-action-sheet :show="showAddPopup" @close="showAddPopup = false" @cancel="showAddPopup = false"
            :actions="addActions" cancel-text="取消" @select="onAddSelect" round />

        <!-- 批量添加标签弹窗（居中卡片样式） -->

        <view class="tag-popup-card" v-show="showTagPopup">
            <van-popup :show="showTagPopup" @close="showTagPopup = false" round>
                <view class="card-inner" v-show="showTagPopup">
                    <view class="card-title">
                        <text>批量添加标签</text>
                        <text class="close-btn" @tap="showTagPopup = false">取消</text>
                    </view>

                    <scroll-view scroll-y style="max-height: 600rpx;">
                        <view class="card-section">
                            <text class="card-section-title">季节</text>
                            <view class="options-row">
                                <view v-for="s in displaySeasonOptions" :key="s.id" class="opt-item"
                                    :class="{ active: selectedSeasonIds.includes(s.id) }"
                                    @tap="() => toggleSelectOption('season', s.id)">{{ s.name }}</view>
                            </view>
                        </view>

                        <view class="card-section">
                            <text class="card-section-title">种类</text>
                            <view class="options-row">
                                <view v-for="c in displayCategoryOptions" :key="c.id" class="opt-item"
                                    :class="{ active: selectedCategoryIds.includes(c.id) }"
                                    @tap="() => toggleSelectOption('category', c.id)">{{ c.name }}</view>
                            </view>
                        </view>

                        <view class="card-section">
                            <text class="card-section-title">场景</text>
                            <view class="options-row">
                                <view v-for="sc in displaySceneOptions" :key="sc.id" class="opt-item"
                                    :class="{ active: selectedSceneIds.includes(sc.id) }"
                                    @tap="() => toggleSelectOption('scene', sc.id)">{{ sc.name }}</view>
                            </view>
                        </view>

                        <view class="confirm-btn" @tap="submitBatchTags">确定</view>
                    </scroll-view>
                </view>
            </van-popup>
        </view>

        <!-- 筛选抽屉 -->
        <van-popup :show="showFilter" position="right" custom-style="width: 80%; height: 100%;" @close="showFilter = false">
            <view class="filter-drawer">
                <view class="drawer-title">筛选衣物</view>
                <scroll-view scroll-y class="drawer-content">
                    <!-- Categories -->
                    <view class="filter-section">
                        <view class="section-header">分类</view>
                        <view class="tags-grid">
                            <view v-for="c in displayCategoryOptions" :key="c.id" 
                                class="filter-tag" 
                                :class="{ active: filterForm.category_ids.includes(c.id) }"
                                @tap="toggleFilterOption('category', c.id)">
                                {{ c.name }}
                            </view>
                        </view>
                    </view>
                    <!-- Scenes -->
                    <view class="filter-section">
                        <view class="section-header">场景</view>
                        <view class="tags-grid">
                            <view v-for="s in displaySceneOptions" :key="s.id" 
                                class="filter-tag" 
                                :class="{ active: filterForm.scene_ids.includes(s.id) }"
                                @tap="toggleFilterOption('scene', s.id)">
                                {{ s.name }}
                            </view>
                        </view>
                    </view>
                    <!-- Seasons -->
                    <view class="filter-section">
                        <view class="section-header">季节</view>
                        <view class="tags-grid">
                            <view v-for="s in displaySeasonOptions" :key="s.id" 
                                class="filter-tag" 
                                :class="{ active: filterForm.season_ids.includes(s.id) }"
                                @tap="toggleFilterOption('season', s.id)">
                                {{ s.name }}
                            </view>
                        </view>
                    </view>
                    <!-- Colors -->
                    <view class="filter-section">
                        <view class="section-header">颜色</view>
                        <view class="colors-grid">
                            <view v-for="col in colorOptions" :key="col.value" 
                                class="color-item"
                                :class="{ active: filterForm.color === col.value }"
                                @tap="filterForm.color = (filterForm.color === col.value ? '' : col.value)">
                                <view class="color-circle" :style="{ background: col.hex, border: col.value === '白' ? '1px solid #eee' : 'none' }"></view>
                                <text class="color-name">{{ col.name }}</text>
                            </view>
                        </view>
                    </view>
                </scroll-view>
                <view class="drawer-actions">
                    <van-button type="default" custom-class="action-btn" @tap="resetFilter">重置</van-button>
                    <van-button type="primary" custom-class="action-btn" @tap="applyFilter">确认</van-button>
                </view>
            </view>
        </van-popup>
    </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { 
    getClothesList, 
    batchDeleteClothes, 
    batchAddTags,
    getCategories,
    getScenes,
    getSeasons,
    uploadClothes
} from '@/api/clothes';

// --- 状态定义 ---
const searchKeyword = ref('');
const activeSeason = ref('全部');
const isGridLayout = ref(true);
const isSelectMode = ref(false);
const showFilter = ref(false); // 筛选抽屉（暂未实现具体内容，保留状态）
const activeFilterTags = ref<any[]>([]); // 当前选中的筛选标签

const clothingList = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const isLoading = ref(false);
const isFinished = ref(false);

const selectedIds = ref<any[]>([]);

// 季节配置
const seasons = [
    { name: '全部', icon: 'apps-o', backgroundColor: '#f5f5f5' },
    { name: '春', icon: 'flower-o', backgroundColor: '#e8f5e9' },
    { name: '夏', icon: 'fire-o', backgroundColor: '#fff3e0' },
    { name: '秋', icon: 'leaf-o', backgroundColor: '#fbe9e7' },
    { name: '冬', icon: 'snow-o', backgroundColor: '#e3f2fd' }
];

// 添加菜单
const showAddPopup = ref(false);
const addActions = [
    { name: '拍照录入', icon: 'photograph' },
    { name: '相册导入', icon: 'photo' },
    { name: 'DIY搭配', icon: 'edit' } // 把歧义的“手动录入”改个名字更贴切
];

// 批量标签弹窗
const showTagPopup = ref(false);
const displaySeasonOptions = ref<any[]>([]);
const displayCategoryOptions = ref<any[]>([]);
const displaySceneOptions = ref<any[]>([]);
const selectedSeasonIds = ref<any[]>([]);
const selectedCategoryIds = ref<any[]>([]);
const selectedSceneIds = ref<any[]>([]);

// 筛选表单
const filterForm = ref({
    category_ids: [] as number[],
    scene_ids: [] as number[],
    season_ids: [] as number[],
    color: ''
});

const colorOptions = [
    { name: '黑', value: '黑', hex: '#000000' },
    { name: '白', value: '白', hex: '#FFFFFF' },
    { name: '灰', value: '灰', hex: '#808080' },
    { name: '红', value: '红', hex: '#FF0000' },
    { name: '橙', value: '橙', hex: '#FFA500' },
    { name: '黄', value: '黄', hex: '#FFFF00' },
    { name: '绿', value: '绿', hex: '#008000' },
    { name: '蓝', value: '蓝', hex: '#0000FF' },
    { name: '紫', value: '紫', hex: '#800080' },
    { name: '粉', value: '粉', hex: '#FFC0CB' },
    { name: '棕', value: '棕', hex: '#A52A2A' },
    { name: '米', value: '米', hex: '#F5F5DC' },
];

// --- 生命周期 ---
onShow(() => {
    // 每次显示页面刷新列表
    loadClothesList(true);
    fetchTagOptions();
});

onReachBottom(() => {
    onScrollToLower();
});

// --- 核心逻辑 ---

// 加载列表
const loadClothesList = async (reset = false) => {
    if (reset) {
        page.value = 1;
        clothingList.value = [];
        isFinished.value = false;
    }
    
    if (isFinished.value || isLoading.value) return;
    
    isLoading.value = true;
    
    try {
        const params: any = {
            page: page.value,
            page_size: pageSize.value,
            keyword: searchKeyword.value
        };
        
        // 季节筛选
        if (activeSeason.value !== '全部') {
            const seasonObj = displaySeasonOptions.value.find((s: any) => s.name === activeSeason.value);
            if (seasonObj) {
                params.season_id = seasonObj.id;
            }
        }

        // 高级筛选
        if (filterForm.value.category_ids.length > 0) params.category_id = filterForm.value.category_ids.join(',');
        if (filterForm.value.scene_ids.length > 0) params.scene_id = filterForm.value.scene_ids.join(',');
        if (filterForm.value.season_ids.length > 0) params.season_id = filterForm.value.season_ids.join(',');
        if (filterForm.value.color) params.color = filterForm.value.color;
        
        // 获取用户信息
        const userInfo = uni.getStorageSync('userInfo');
        if (userInfo && userInfo.account) {
            params.account = userInfo.account;
        }

        const res = await getClothesList(params) as any;
        if (res.code === 200) {
            const list = res.data.list.map((item: any) => {
                // 处理标签：只展示【场景】标签
                // 1. 获取场景标签
                let sceneTags = (item.scene_names || []).map((n: string) => ({ name: n, color: '#fff3e0' }));
                
                // 2. 如果没有场景标签，默认展示【通用】
                // 注意：其他如分类、季节标签不再展示
                if (sceneTags.length === 0) {
                    sceneTags = [{ name: '通用', color: '#f5f5f5' }];
                }

                return {
                    id: item.id,
                    name: item.name,
                    image: item.image_url,
                    price: item.price,
                    times: item.wear_count || 0,
                    date: item.created_at ? item.created_at.split('T')[0] : '',
                    // 增加默认值0，并强制转换为 Number，防止 toFixed 报错
                    costPerTime: Number((item.price && item.wear_count) ? (item.price / item.wear_count) : (item.price || 0)),
                    tags: sceneTags,
                    category: (item.category_names && item.category_names.length > 0) ? item.category_names[0] : '未分类'
                };
            });
            
            if (list.length < pageSize.value) {
                isFinished.value = true;
            }
            
            clothingList.value = [...clothingList.value, ...list];
            total.value = res.data.total;
            page.value++;
        }
    } catch (e) {
        console.error(e);
        uni.showToast({ title: '加载失败', icon: 'none' });
    } finally {
        isLoading.value = false;
    }
};

const onScrollToLower = () => {
    loadClothesList();
};

// 分组逻辑
const clothGroups = computed(() => {
    const groups: any = {};
    clothingList.value.forEach((item: any) => {
        const cat = item.category || '未分类';
        if (!groups[cat]) {
            groups[cat] = { category: cat, list: [] };
        }
        groups[cat].list.push(item);
    });
    return Object.values(groups);
});

// --- 交互处理 ---

const handleSeasonChange = (name: string) => {
    activeSeason.value = name;
    loadClothesList(true);
};

const toggleLayout = () => {
    isGridLayout.value = !isGridLayout.value;
};

const openTagManager = () => {
    uni.navigateTo({ url: '/pages/wardrobe/tag-manager' });
};

const handleCardTap = (item: any) => {
    if (isSelectMode.value) {
        toggleSelectByTap(item.id);
    } else {
        uni.navigateTo({ url: `/pages/wardrobe/detail?id=${item.id}` });
    }
};

// 选择模式
const toggleSelectMode = () => {
    isSelectMode.value = !isSelectMode.value;
    selectedIds.value = [];
};

const toggleSelectByTap = (id: number) => {
    const index = selectedIds.value.indexOf(id);
    if (index > -1) {
        selectedIds.value.splice(index, 1);
    } else {
        selectedIds.value.push(id);
    }
};

const bindSelectHandler = (id: number) => {
    toggleSelectByTap(id);
};

// 批量删除
const batchDeleteSelected = () => {
    if (selectedIds.value.length === 0) return;
    
    uni.showModal({
        title: '确认删除',
        content: `确定要删除选中的 ${selectedIds.value.length} 件衣物吗？`,
        success: (res) => {
            if (res.confirm) {
                batchDeleteClothes(selectedIds.value).then((res: any) => {
                    if (res.code === 200) {
                        uni.showToast({ title: '删除成功' });
                        isSelectMode.value = false;
                        loadClothesList(true);
                    }
                });
            }
        }
    });
};

// 批量标签
const openTagPopup = () => {
    if (selectedIds.value.length === 0) {
        uni.showToast({ title: '请先选择衣物', icon: 'none' });
        return;
    }
    selectedSeasonIds.value = [];
    selectedCategoryIds.value = [];
    selectedSceneIds.value = [];
    showTagPopup.value = true;
};

const fetchTagOptions = () => {
    Promise.all([getCategories(), getScenes(), getSeasons()]).then(([resCat, resScene, resSeason]: any[]) => {
        displayCategoryOptions.value = resCat.data || [];
        displaySceneOptions.value = resScene.data || [];
        displaySeasonOptions.value = resSeason.data || [];
    });
};

const toggleSelectOption = (type: string, id: number) => {
    let target: any[];
    if (type === 'season') target = selectedSeasonIds.value;
    else if (type === 'category') target = selectedCategoryIds.value;
    else target = selectedSceneIds.value;
    
    const idx = target.indexOf(id);
    if (idx > -1) target.splice(idx, 1);
    else target.push(id);
};

const submitBatchTags = () => {
    const data = {
        ids: selectedIds.value,
        category_ids: selectedCategoryIds.value,
        scene_ids: selectedSceneIds.value,
        season_ids: selectedSeasonIds.value
    };
    
    batchAddTags(data).then((res: any) => {
        if (res.code === 200) {
            uni.showToast({ title: '添加成功' });
            showTagPopup.value = false;
            isSelectMode.value = false;
            loadClothesList(true);
        }
    });
};

// 添加菜单
const onAddSelect = (e: any) => {
    if (e.detail.name === 'DIY搭配') {
        uni.navigateTo({ url: '/pages/outfit/create' });
    } else {
        let sourceType: 'camera' | 'album' = 'album';
        if (e.detail.name === '拍照录入') {
            sourceType = 'camera';
        } else if (e.detail.name === '相册导入') {
            sourceType = 'album';
        }
        handleUpload(sourceType);
    }
    showAddPopup.value = false;
};

// 处理上传逻辑
const handleUpload = (sourceType: 'camera' | 'album') => {
    uni.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: [sourceType],
        success: (res) => {
            const tempFilePath = res.tempFilePaths[0];
            doUpload(tempFilePath);
        },
        fail: (err) => {
            console.log('选择图片取消或失败', err);
        }
    });
};

const doUpload = (filePath: string) => {
    uni.showLoading({ title: '正在入库...', mask: true });
    uploadClothes(filePath).then((res: any) => {
        uni.hideLoading();
        if (res.code === 200) {
            uni.showToast({ title: '录入成功', icon: 'success' });
            // 上传成功后（假设后端返回了新创建的 ID），跳转到详情页进行编辑完善
            // 假设回包结构是 res.data.id 或者 res.data 就是 id，根据 api/clothes.ts 里的解析
            const newId = res.data.id || res.data; 
            
            // 延迟一点跳转，让用户看到成功提示
            setTimeout(() => {
                uni.navigateTo({ 
                    url: `/pages/wardrobe/detail?id=${newId}&edit=true`
                });
            }, 800);
            
            // 刷新列表以便返回时能看到
            loadClothesList(true);
        } else {
            uni.showToast({ title: res.message || '上传失败', icon: 'none' });
        }
    }).catch((err) => {
        uni.hideLoading();
        uni.showToast({ title: '网络异常，请重试', icon: 'none' });
        console.error('Upload Error:', err);
    });
};

// 筛选标签（暂未实现逻辑）
const removeFilterTag = (tag: any) => {
    if (tag.type === 'category') {
        const idx = filterForm.value.category_ids.indexOf(tag.id);
        if (idx > -1) filterForm.value.category_ids.splice(idx, 1);
    } else if (tag.type === 'scene') {
        const idx = filterForm.value.scene_ids.indexOf(tag.id);
        if (idx > -1) filterForm.value.scene_ids.splice(idx, 1);
    } else if (tag.type === 'season') {
        const idx = filterForm.value.season_ids.indexOf(tag.id);
        if (idx > -1) filterForm.value.season_ids.splice(idx, 1);
    } else if (tag.type === 'color') {
        filterForm.value.color = '';
    }
    applyFilter();
};

const toggleFilterOption = (type: string, id: number) => {
    let target: number[];
    if (type === 'category') target = filterForm.value.category_ids;
    else if (type === 'scene') target = filterForm.value.scene_ids;
    else target = filterForm.value.season_ids;

    const idx = target.indexOf(id);
    if (idx > -1) target.splice(idx, 1);
    else target.push(id);
};

const resetFilter = () => {
    filterForm.value = {
        category_ids: [],
        scene_ids: [],
        season_ids: [],
        color: ''
    };
    activeFilterTags.value = [];
    loadClothesList(true);
};

const applyFilter = () => {
    showFilter.value = false;
    
    // 更新显示的筛选标签
    const tags: any[] = [];
    
    filterForm.value.category_ids.forEach((id: number) => {
        const item = displayCategoryOptions.value.find((c: any) => c.id === id);
        if (item) tags.push({ type: 'category', id: id, name: item.name });
    });
    
    filterForm.value.scene_ids.forEach((id: number) => {
        const item = displaySceneOptions.value.find((s: any) => s.id === id);
        if (item) tags.push({ type: 'scene', id: id, name: item.name });
    });
    
    filterForm.value.season_ids.forEach((id: number) => {
        const item = displaySeasonOptions.value.find((s: any) => s.id === id);
        if (item) tags.push({ type: 'season', id: id, name: item.name });
    });
    
    if (filterForm.value.color) {
        tags.push({ type: 'color', id: 0, name: filterForm.value.color });
    }
    
    activeFilterTags.value = tags;
    loadClothesList(true);
};

</script>

<style lang="scss" scoped>
.wardrobe-page {
    min-height: 100vh;
    background-color: #f7f8fa;
    padding-bottom: 120rpx;
}

.sticky-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background-color: #fff;
    padding-bottom: 10rpx;
}

.top-tool-row {
    display: flex;
    align-items: center;
    padding: 10rpx 20rpx;
    
    .search-box {
        flex: 1;
    }
    
    .season-scroll {
        width: 300rpx;
        margin: 0 20rpx;
        white-space: nowrap;
        
        .season-wrap {
            display: flex;
            align-items: center;
        }
        
        .season-item {
            display: inline-flex;
            /* 移除 flex-direction: column，改为默认 row 或在 item-content 中控制 */
            align-items: center;
            margin-right: 12rpx; /*稍微减小间距*/
            opacity: 0.8; /*调整默认透明度*/
            transition: all 0.3s;
            
            &.active {
                opacity: 1;
                /* 选中时不放大整体，避免布局跳动过大 */
                /* transform: scale(1.1); */
            }
            
            .item-content {
                display: flex;
                flex-direction: row; /* 关键：改为水平排列 */
                align-items: center;
                background-color: transparent;
                border-radius: 30rpx;
                padding: 4rpx;
                transition: all 0.3s;

                /* 选中态样式优化：给整个胶囊加个背景色可能更好看，但目前先保持文字同行的需求 */
            }

            .icon-box {
                width: 50rpx; /* 稍微调小一点 */
                height: 50rpx;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                /* margin-bottom removed */
            }
            
            .s-text {
                font-size: 26rpx; /* 字体加大 */
                color: #333;
                margin-left: 10rpx; /* 文字和图标的间距 */
                font-weight: 500;
            }
        }
    }
    
    .layout-toggle {
        padding: 10rpx;
    }
}

.filter-action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 30rpx;
    background-color: #fff;
    border-bottom: 1rpx solid #eee;
    
    .left-tools {
        display: flex;
        align-items: center;
        font-size: 28rpx;
        color: #333;
        .filter-text { margin-left: 8rpx; }
    }
    
    .center-status {
        flex: 1;
        text-align: center;
        font-size: 28rpx;
        color: #666;
        font-weight: bold;
    }
    
    .right-tools {
        .select-trigger {
            font-size: 28rpx;
            color: #1989fa;
            &.editing { color: #ee0a24; }
        }
    }
}

.main-list {
    height: calc(100vh - 200rpx);
    padding: 20rpx;
    box-sizing: border-box;
}

.group-section {
    margin-bottom: 30rpx;
    
    .group-title {
        font-size: 30rpx;
        font-weight: bold;
        margin-bottom: 20rpx;
        padding-left: 10rpx;
        color: #333;
        
        .num {
            font-size: 24rpx;
            color: #999;
            margin-left: 10rpx;
            font-weight: normal;
        }
    }
}

.grid-container {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx; /* 缩小间隙以适应三列 */
    padding: 0 4rpx; /* 微调左右留白 */
    
    .cloth-card-grid {
        width: calc((100% - 24rpx) / 3); /* 3列布局精确计算：(100% - 2个间隙) / 3 */
        background: #fff;
        border-radius: 12rpx;
        overflow: hidden;
        padding-bottom: 12rpx;
        box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.02); /* 轻微阴影增加层次感 */
        
        .img-wrapper {
            position: relative;
            width: 100%;
            height: 220rpx; /* 缩小图片高度适配三列 */
            background-color: #f9f9f9;
            
            .cloth-img {
                width: 100%;
                height: 100%;
                will-change: transform; /* 优化渲染 */
            }
            
            .select-mask {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.1);
                z-index: 10;
                
                .select-icon {
                    position: absolute;
                    top: 8rpx; right: 8rpx;
                    width: 32rpx; height: 32rpx;
                    border-radius: 50%;
                    border: 2rpx solid #fff;
                    background: rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    
                    &.checked {
                        background: #1989fa;
                        border-color: #1989fa;
                    }
                    
                    /* 适配 van-icon 大小 */
                    :deep(.van-icon) {
                        font-size: 12px; 
                    }
                }
            }
            
            .check-overlay {
                position: absolute;
                bottom: 8rpx;
                right: 8rpx;
                z-index: 11;
            }
        }
        
        .name-row {
            font-size: 24rpx; /* 缩小字体 */
            color: #333;
            padding: 12rpx 10rpx 4rpx; /* 调整内边距 */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center; /* 三列通常居中对齐更好看 */
        }
        
        .tag-row {
            padding: 4rpx 10rpx;
            display: flex;
            flex-wrap: wrap;
            gap: 6rpx;
            justify-content: center; /* 标签居中 */
            height: 36rpx; /* 固定高度防止卡片参差不齐 */
            overflow: hidden;
            
            .mini-tag {
                font-size: 18rpx; /* 极小字体 */
                padding: 2rpx 6rpx;
                border-radius: 4rpx;
                color: #666;
                background-color: #f0f0f0;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    }
}

.list-container {
    .cloth-card-list {
        display: flex;
        background: #fff;
        padding: 20rpx;
        border-radius: 16rpx;
        margin-bottom: 20rpx;
        
        .list-img-box {
            position: relative;
            width: 160rpx;
            height: 160rpx;
            margin-right: 20rpx;
            border-radius: 8rpx;
            overflow: hidden;
            
            .cloth-img-l {
                width: 100%;
                height: 100%;
            }
            
            .select-mask {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.1);
                z-index: 10;
                
                .select-icon {
                    position: absolute;
                    top: 8rpx; right: 8rpx;
                    width: 36rpx; height: 36rpx;
                    border-radius: 50%;
                    border: 2rpx solid #fff;
                    background: rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    
                    &.checked {
                        background: #1989fa;
                        border-color: #1989fa;
                    }
                }
            }
        }
        
        .cloth-details {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            
            .list-header {
                display: flex;
                justify-content: space-between;
                .item-name { font-size: 30rpx; font-weight: bold; color: #333; }
            }
            
            .price-row {
                display: flex;
                align-items: baseline;
                gap: 16rpx;
                .cost-per { font-size: 24rpx; color: #ff976a; }
                .item-price { font-size: 24rpx; color: #999; text-decoration: line-through; }
            }
            
            .info-row {
                font-size: 22rpx;
                color: #999;
            }
            
            .tag-row-l {
                display: flex;
                flex-wrap: wrap;
                gap: 10rpx;
                .tag-label {
                    font-size: 20rpx;
                    padding: 2rpx 8rpx;
                    border: 1rpx solid #eee;
                    border-radius: 4rpx;
                }
            }
        }
    }
}

.batch-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100rpx;
    background: #fff;
    display: flex;
    align-items: center;
    padding: 0 30rpx;
    box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05);
    z-index: 200;
    padding-bottom: env(safe-area-inset-bottom);
    
    .batch-info {
        flex: 1;
        font-size: 28rpx;
        color: #333;
    }
    
    .batch-btn {
        display: flex;
        align-items: center;
        margin-left: 30rpx;
        font-size: 28rpx;
        
        &.del { color: #ee0a24; }
        &.tag { color: #1989fa; }
        
        text { margin-left: 8rpx; }
    }
}

.fab-add {
    position: fixed;
    right: 40rpx;
    bottom: 140rpx;
    width: 100rpx;
    height: 100rpx;
    background: #1989fa;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 16rpx rgba(25, 137, 250, 0.4);
    z-index: 90;
}

.tag-popup-card {
    .card-inner {
        width: 600rpx;
        background: #fff;
        border-radius: 16rpx;
        padding: 30rpx;
        
        .card-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 32rpx;
            font-weight: bold;
            margin-bottom: 30rpx;
            
            .close-btn {
                font-size: 28rpx;
                color: #999;
                font-weight: normal;
            }
        }
        
        .card-section {
            margin-bottom: 30rpx;
            .card-section-title {
                font-size: 28rpx;
                color: #666;
                margin-bottom: 16rpx;
                display: block;
            }
            
            .options-row {
                display: flex;
                flex-wrap: wrap;
                gap: 16rpx;
                
                .opt-item {
                    padding: 10rpx 24rpx;
                    background: #f5f5f5;
                    border-radius: 30rpx;
                    font-size: 24rpx;
                    color: #333;
                    
                    &.active {
                        background: #e3f2fd;
                        color: #1989fa;
                    }
                }
            }
        }
        
        .confirm-btn {
            width: 100%;
            height: 80rpx;
            background: #1989fa;
            color: #fff;
            border-radius: 40rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30rpx;
            margin-top: 20rpx;
        }
    }
}

.filter-drawer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fff;

    .drawer-title {
        padding: 44px 16px 16px;
        font-size: 18px;
        font-weight: 600;
        border-bottom: 1px solid #eee;
    }

    .drawer-content {
        flex: 1;
        padding: 16px;
        overflow-y: auto;

        .filter-section {
            margin-bottom: 24px;

            .section-header {
                font-size: 15px;
                font-weight: 500;
                margin-bottom: 12px;
                color: #333;
            }

            .tags-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;

                .filter-tag {
                    padding: 6px 16px;
                    background: #f5f5f5;
                    border-radius: 4px;
                    font-size: 13px;
                    color: #666;

                    &.active {
                        background: #e8f0fe;
                        color: #1989fa;
                    }
                }
            }

            .colors-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 16px;

                .color-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;

                    .color-circle {
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                    }

                    .color-name {
                        font-size: 12px;
                        color: #666;
                    }

                    &.active {
                        .color-circle {
                            transform: scale(1.1);
                            border: 2px solid #1989fa;
                        }
                        .color-name {
                            color: #1989fa;
                            font-weight: 500;
                        }
                    }
                }
            }
        }
    }

    .drawer-actions {
        padding: 16px;
        border-top: 1px solid #eee;
        display: flex;
        gap: 12px;
        padding-bottom: calc(16px + env(safe-area-inset-bottom));

        .action-btn {
            flex: 1;
        }
    }
}
</style>