<template>
    <view class="outfit-editor">
        <!-- 顶部标题 -->
        <view class="page-header">
            <view class="back-btn" @tap="goBack">
                <van-icon name="arrow-left" size="22px" color="#333" />
            </view>
            <text>{{ outfitId ? (isReadOnly ? '搭配详情' : '编辑搭配') : 'DIY搭配' }}</text>
            
            <view class="header-right" style="display: flex; align-items: center;">
                <!-- 收藏按钮 -->
                <view v-if="outfitId" class="favorite-btn" @tap="toggleFavorite" style="padding: 8px;">
                     <van-icon :name="isFavorite ? 'like' : 'like-o'" size="22px" :color="isFavorite ? '#ee0a24' : '#333'" />
                </view>

                <!-- 删除按钮 -->
                <view v-if="outfitId && !isReadOnly" class="delete-outfit-btn" @tap="handleDelete">
                    <van-icon name="delete-o" size="22px" color="#ee0a24" />
                </view>
            </view>
        </view>

        <!-- 顶部工具栏 -->
        <view class="top-bar" v-if="!isReadOnly">
            <view class="bg-selector">
                <view v-for="(color, index) in bgColors" :key="index" class="color-dot"
                    :class="{ active: currentBg === color }" :style="{ background: color }" @tap="currentBg = color">
                </view>
            </view>
            
            <view class="right-actions">
                <view class="action-btn clear-btn" @tap="confirmClear">清空</view>
                <view class="action-btn save-btn" @tap="handleSave">保存</view>
            </view>
        </view>

        <!-- 离屏 Canvas，用于生成合成图 (移出屏幕外) -->
        <!-- 修复：将 left 改为 0 且 z-index 设为负数，防止因移出屏幕导致 draw 回调不执行 -->
        <canvas canvas-id="snapshotCanvas" id="snapshotCanvas" :style="{
            width: snapshotWidth + 'px',
            height: snapshotHeight + 'px',
            position: 'fixed',
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -9999
        }" />

        <!-- 画布区域 -->
        <view class="canvas-container" :style="{ background: currentBg }" @tap="collapsePanel">
            <view v-for="(item, index) in canvasItems" :key="item.uuid" class="canvas-item"
                :class="{ active: activeUuid === item.uuid }" :style="{
                    left: item.x + 'px',
                    top: item.y + 'px',
                    width: item.width + 'px',
                    height: item.height + 'px',
                    transform: `translate(-50%, -50%) rotate(${item.rotate}deg) scale(${item.scale})`,
                    zIndex: item.zIndex
                }" @touchstart.stop="onTouchStart(item, $event)" @touchmove.stop="onTouchMove"
                @touchend.stop="onTouchEnd" @tap.stop>
                <image :src="item.image_url" mode="aspectFit" class="item-img"
                    :style="{ transform: item.isFlipped ? 'scaleX(-1)' : 'none' }" />

                <!-- 选中状态下的操作控件 -->
                <view v-if="activeUuid === item.uuid && !item.locked && !isReadOnly" class="controls">
                    <!-- 删除按钮 (左上角) -->
                    <!-- 修复：使用 touchend.stop.prevent 确保在移动端能灵敏触发，避免 tap 被拖拽检测打断 -->
                    <view class="ctrl-btn delete-btn" @touchend.stop.prevent="deleteItem(item)" @touchstart.stop="noop">
                        <van-icon name="cross" size="14px" color="#fff" style="pointer-events: none;" />
                    </view>
                    <!-- 翻转按钮 (右上角) -->
                    <view class="ctrl-btn flip-btn" @touchend.stop.prevent="flipItem(item)" @touchstart.stop="noop">
                        <van-icon name="replay" size="14px" color="#fff" style="pointer-events: none;" />
                    </view>
                    <!-- 旋转/缩放手柄 (右下角) -->
                    <view class="ctrl-btn transform-handle" 
                        @touchstart.stop="onHandleStart(item, $event)" 
                        @touchmove.stop="onHandleMove" 
                        @touchend.stop="onHandleEnd">
                        <van-icon name="expand-o" size="14px" color="#fff" style="transform: rotate(45deg); pointer-events: none;" />
                    </view>
                    <!-- 层级调整按钮 (左下角) -->
                    <!-- 修改功能为：在最顶层和最底层之间切换 -->
                    <view class="ctrl-btn layer-btn" @touchend.stop.prevent="toggleLayer(item)" @touchstart.stop="noop">
                         <van-icon name="exchange" size="14px" color="#fff" style="transform: rotate(90deg); pointer-events: none;" />
                    </view>
                    <!-- 锁定按钮 (左侧中间) -->
                    <view class="ctrl-btn lock-btn" @touchend.stop.prevent="lockItem(item)" @touchstart.stop="noop">
                         <van-icon name="lock" size="14px" color="#fff" style="pointer-events: none;" />
                    </view>
                </view>

                <!-- 锁定状态下的提示/解锁按钮 (右上角) -->
                <view v-if="activeUuid === item.uuid && item.locked && !isReadOnly" class="controls locked-controls">
                    <view class="ctrl-btn unlock-btn" @touchend.stop.prevent="unlockItem(item)" @touchstart.stop="noop">
                        <van-icon name="lock" color="#f44" size="12px" style="pointer-events: none;" />
                    </view>
                </view>
            </view>

            <view v-if="canvasItems.length === 0" class="empty-tip">
                {{ isReadOnly ? '暂无衣物' : '点击下方选择衣物' }}
            </view>
        </view>

        <!-- 底部衣橱面板 -->
        <view class="bottom-panel" :class="{ expanded: isPanelExpanded, hidden: isReadOnly }" @tap="onPanelClick">
            <!-- 拖拽手柄条 -->
            <view class="panel-handle"></view>

            <!-- 分类 Tab -->
            <view class="category-tabs">
                <scroll-view scroll-x class="tabs-scroll" :show-scrollbar="false">
                    <view class="tab-item" :class="{ active: currentCatId === 0 }" @tap.stop="switchCategory(0)">全部</view>
                    <view v-for="cat in categories" :key="cat.id" class="tab-item"
                        :class="{ active: currentCatId === cat.id }" @tap.stop="switchCategory(cat.id)">
                        {{ cat.name }}
                    </view>
                </scroll-view>
                <view class="filter-icon" @tap.stop="showFilterPopup = true">
                    <van-icon name="filter-o" size="20px" />
                </view>
            </view>

            <!-- 衣物列表 -->
            <!-- 去掉 @tap.stop，让点击事件冒泡到 bottom-panel，利用 onPanelClick 统一处理面板的展开/收起 -->
            <scroll-view scroll-y class="clothes-scroll" @scrolltolower="loadMoreClothes">
                <view class="clothes-list">
                    <view v-for="item in clothesList" :key="item.id" class="clothes-card" @tap.stop="addToCanvas(item)">
                        <image :src="item.image_url" mode="aspectFill" class="c-img" />
                    </view>
                </view>
                <van-empty v-if="clothesList.length === 0 && !listLoading" description="暂无衣物" />
                <!-- 底部垫高，防止被安全区遮挡 -->
                <view class="safe-area-spacer"></view>
            </scroll-view>
        </view>

        <!-- 只读模式下的操作栏 (针对灵感/推荐内容) -->
        <view v-if="isReadOnly" class="readonly-actions safe-area-bottom">
            <button class="action-btn primary-btn" @tap="applyInspiration">
                <van-icon name="magic-wand" style="margin-right: 4px;" />
                一键试穿
            </button>
        </view>

        <!-- 保存弹窗 -->
        <van-popup :show="showSavePopup" round position="bottom" @close="cancelSave" z-index="20000">
            <view class="save-popup">
                <view class="popup-title">保存搭配</view>
                <van-field :value="form.name" label="名称" placeholder="请输入搭配名称" @change="form.name = $event.detail" />
                <view class="tags-section">
                    <view class="section-title">适用场景</view>
                    <view class="tags-wrapper">
                        <view v-for="s in scenes" :key="s.id" class="tag-touch-area"
                            @tap="toggleSaveTag('scene', s.id)">
                            <van-tag :plain="!form.scene_ids.includes(s.id)"
                                :type="form.scene_ids.includes(s.id) ? 'primary' : 'default'" size="medium"
                                custom-class="my-tag">{{ s.name }}</van-tag>
                        </view>
                        <!-- 添加标签按钮 -->
                        <view class="add-tag-btn" @tap="handleAddSceneTag">
                            <van-icon name="plus" size="14px" color="#999" />
                        </view>
                    </view>
                </view>
                <view class="tags-section">
                    <view class="section-title">适用季节</view>
                    <view class="tags-wrapper">
                        <view v-for="s in seasons" :key="s.id" class="tag-touch-area"
                            @tap="toggleSaveTag('season', s.id)">
                            <van-tag :plain="!form.season_ids.includes(s.id)"
                                :type="form.season_ids.includes(s.id) ? 'primary' : 'default'" size="medium"
                                custom-class="my-tag">{{ s.name }}</van-tag>
                        </view>
                    </view>
                </view>
                <view class="tags-section">
                    <view class="section-title">天气 & 温度</view>
                    <view class="selectors-row">
                        <picker mode="selector" :range="weatherOptions" @change="onWeatherChange" class="picker-item">
                            <view class="picker-display">
                                <text class="label">天气</text>
                                <text class="value">{{ form.weather || '请选择' }}</text>
                                <van-icon name="arrow-down" color="#999" />
                            </view>
                        </picker>

                        <picker mode="selector" :range="temperatureOptions" @change="onTemperatureChange"
                            class="picker-item">
                            <view class="picker-display">
                                <text class="label">温度</text>
                                <text class="value">{{ form.temperature || '请选择' }}</text>
                                <van-icon name="arrow-down" color="#999" />
                            </view>
                        </picker>
                    </view>
                </view>
                <van-field :value="form.remarks" label="备注" placeholder="请输入备注"
                    @change="form.remarks = $event.detail" />
                <view class="btn-area">
                    <van-button block type="primary" @click="confirmSave">确认保存</van-button>
                </view>
            </view>
        </van-popup>

        <!-- 筛选弹窗 -->
        <van-popup :show="showFilterPopup" position="right" custom-style="width: 80%; height: 100%;"
            @close="showFilterPopup = false" z-index="20001">
            <view class="filter-container">
                <view class="filter-title">筛选衣物</view>

                <scroll-view scroll-y class="filter-content">
                    <view class="filter-section">
                        <view class="section-header">场景</view>
                        <view class="tags-grid">
                            <view v-for="s in scenes" :key="s.id" class="filter-tag"
                                :class="{ active: filterForm.scene_ids.includes(s.id) }"
                                @tap="toggleFilter(filterForm.scene_ids, s.id)">
                                {{ s.name }}
                            </view>
                        </view>
                    </view>

                    <view class="filter-section">
                        <view class="section-header">季节</view>
                        <view class="tags-grid">
                            <view v-for="s in seasons" :key="s.id" class="filter-tag"
                                :class="{ active: filterForm.season_ids.includes(s.id) }"
                                @tap="toggleFilter(filterForm.season_ids, s.id)">
                                {{ s.name }}
                            </view>
                        </view>
                    </view>

                    <view class="filter-section">
                        <view class="section-header">颜色</view>
                        <view class="colors-grid">
                            <view v-for="c in colorOptions" :key="c.value" class="color-item"
                                :class="{ active: filterForm.color === c.value }"
                                @tap="filterForm.color = (filterForm.color === c.value ? '' : c.value)">
                                <view class="color-circle"
                                    :style="{ background: c.hex, border: c.value === '白' ? '1px solid #eee' : 'none' }">
                                </view>
                                <text class="color-name">{{ c.name }}</text>
                            </view>
                        </view>
                    </view>
                </scroll-view>

                <view class="filter-actions">
                    <van-button type="default" custom-class="action-btn" @tap="resetFilter">重置</van-button>
                    <van-button type="primary" custom-class="action-btn" @tap="applyFilter">确认</van-button>
                </view>
            </view>
        </van-popup>

    </view>

</template>

<script setup lang="ts">
import { ref, onMounted, getCurrentInstance, onUnmounted } from 'vue';
// @ts-ignore
import { onLoad, onReady } from '@dcloudio/uni-app';
import { getCategories, getScenes, getScenes as getTags, getSeasons, getClothesList, addTag } from '@/api/clothes';
import { createOutfit, getOutfitDetail, updateOutfit, deleteOutfit, addToCalendar, uploadSnapshot } from '@/api/outfit';
import { checkFavorite, addFavorite, removeFavorite } from '@/api/favorites';

// --- 工具函数 ---
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- 类型定义 ---
interface CanvasItem {
    uuid: string; // 唯一标识
    id: number;   // 衣物ID
    image_url: string;
    x: number; // 像素坐标 (渲染用)
    y: number; // 像素坐标 (渲染用)
    // 增加相对坐标字段，用于保存/回显 (0-1)
    rx?: number;
    ry?: number;
    width: number;
    height: number;
    scale: number;
    rotate: number;
    zIndex: number;
    isFlipped?: boolean;
    locked?: boolean;
}

// --- 状态 ---
const bgColors = ['#ffffff', '#f7f8fa', '#fff0f5', '#f0f8ff', '#f5f5dc', '#e6e6fa'];
const currentBg = ref(bgColors[1]);

// 获取当前组件实例，供后续异步操作使用
const instance = getCurrentInstance();

// 空函数，用于拦截 touchstart 冒泡
const noop = () => {};

const goBack = () => {
    uni.navigateBack();
};

const handleDelete = () => {
    uni.showModal({
        title: '提示',
        content: '确定要删除这个搭配吗？',
        success: async (res) => {
            if (res.confirm && outfitId.value) {
                try {
                    await deleteOutfit(outfitId.value);
                    uni.showToast({ title: '删除成功', icon: 'success' });
                     uni.$emit('refreshOutfitList');
                    setTimeout(() => {
                        uni.navigateBack();
                    }, 1500);
                } catch (e) {
                    uni.showToast({ title: '删除失败', icon: 'none' });
                }
            }
        }
    });
};

// 拖拽相关状态
let isDragging = false;
let isTransforming = false;
let currentItem: CanvasItem | null = null;
let startX = 0;
let startY = 0;
let initialItemX = 0;
let initialItemY = 0;
let initialRotate = 0;
let initialScale = 1;

const canvasItems = ref<CanvasItem[]>([]);
const activeUuid = ref<string>('');
const outfitId = ref<string | number>(''); // 当前编辑的搭配ID
const isReadOnly = ref(false); // 是否只读模式
const isFavorite = ref(false); // 是否已收藏
const outfitSource = ref(''); // 搭配来源
const targetDate = ref(''); // 来源日期（如果有）
const canvasRect = ref({ width: 0, height: 0, left: 0, top: 0 }); // 画布尺寸
// 响应式快照画布尺寸，初始化为屏幕宽度或默认值
const snapshotWidth = ref(375);
const snapshotHeight = ref(375);

// 画布相对于屏幕的位置，用于计算旋转中心
const canvasOffset = ref({ left: 0, top: 0 });
const isCanvasReady = ref(false); // 画布是否已就绪
const pendingDetailItems = ref<any[]>([]); // 待渲染的详情数据

// 用户信息
const userInfo = uni.getStorageSync('userInfo') || {};

// 底部面板数据
const categories = ref<any[]>([]);
const clothesList = ref<any[]>([]);
const currentCatId = ref(0);
const page = ref(1);
const hasMore = ref(true);
const listLoading = ref(false); // 专门用于列表加载的状态

// 筛选相关
const showFilterPopup = ref(false);
const filterForm = ref({
    scene_ids: [] as number[],
    season_ids: [] as number[],
    color: ''
});
const colorOptions = [
    { name: '黑', value: '黑', hex: '#000000' },
    { name: '白', value: '白', hex: '#FFFFFF' },
    { name: '灰', value: '#808080' },
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

// 保存相关
const showSavePopup = ref(false);
const scenes = ref<any[]>([]);
const seasons = ref<any[]>([]);
const form = ref({
    name: '',
    scene_ids: [] as number[],
    season_ids: [] as number[],
    weather: '',
    temperature: '', // 新增温度字段
    remarks: ''
});
const isPanelExpanded = ref(false);

// 天气选项
const weatherOptions = ['晴', '阴', '雨', '雪', '多云'];
const temperatureOptions = Array.from({ length: 61 }, (_, i) => `${i - 20}°C`); // -20°C 到 40°C

const onWeatherChange = (e: any) => {
    form.value.weather = weatherOptions[e.detail.value];
};

const onTemperatureChange = (e: any) => {
    form.value.temperature = temperatureOptions[e.detail.value];
};

// --- 自动布局函数 ---
const autoLayoutItems = (items: any[]) => {
    if (!items || items.length === 0) return;

    // 清空当前画布
    canvasItems.value = [];

    // 画布尺寸
    const cw = canvasRect.value.width || snapshotWidth.value;
    const ch = canvasRect.value.height || snapshotHeight.value;
    const centerX = cw / 2;
    const centerY = ch / 2;

    // 将传入的items转换为canvasItems
    items.forEach((clothesItem, index) => {
        // 默认居中
        let x = centerX;
        let y = centerY;
        let zIndex = 1; // 声明 zIndex
        let scale = 0.5; // 声明 scale
        const catName = clothesItem.category || '';
        
        // 既然是自动布局，稍微错开一点，或者根据部位摆放
        if (catName.includes('上衣') || catName.includes('外套')) {
            y = centerY - 80;
            zIndex = 2;
            scale = 0.6;
        } else if (catName.includes('裤') || catName.includes('裙') || catName.includes('下装')) {
            y = centerY + 80;
            zIndex = 1;
            scale = 0.6;
        } else if (catName.includes('鞋')) {
            y = centerY + 160;
            x = centerX; // 鞋子通常放底部
            zIndex = 3;
            scale = 0.5;
        } else if (catName.includes('帽') || catName.includes('头')) {
             y = centerY - 150;
             zIndex = 4;
             scale = 0.4;
        } else if (catName.includes('包')) {
             x = centerX + 100;
             y = centerY;
             zIndex = 4;
             scale = 0.5;
        }

        const newItem: CanvasItem = {
            uuid: generateUUID(),
            id: clothesItem.id,
            image_url: clothesItem.image_url, // 确保有图片链接
            x: x,
            y: y,
            width: 200, // 默认宽度，实际渲染时image mode会处理
            height: 200,
            scale: scale,
            rotate: 0,
            zIndex: zIndex,
            isFlipped: false,
            locked: false
        };
        canvasItems.value.push(newItem);
    });
    
    activeUuid.value = ''; // 不选中任何衣物
};

// --- 数据保存 ---
// 生成快照并上传
const generateSnapshot = async (): Promise<string> => {
    uni.showLoading({ title: '生成预览中...' });
    try {
        // 使用预先捕获的 instance，而不是在异步函数中重新获取
        // @ts-ignore
        const ctx = uni.createCanvasContext('snapshotCanvas', instance);
        // 使用实际画布尺寸，确保所见即所得
        const cW = snapshotWidth.value;
        const cH = snapshotHeight.value;

        // 1. 填充背景
        // 兼容处理：legacy canvas API 使用 setFillStyle
        ctx.setFillStyle(currentBg.value || '#ffffff');
        ctx.fillRect(0, 0, cW, cH);

        // 2. 准备图片 (canvas drawImage 需要本地路径，且需按z-index排序绘制)
        const sortedItems = [...canvasItems.value].sort((a, b) => a.zIndex - b.zIndex);

        const promiseList = sortedItems.map(item => {
            return new Promise<any>((resolve) => {
                // 如果是网络图片需要下载获取本地临时路径
                if (item.image_url && (item.image_url.startsWith('http') || item.image_url.startsWith('//'))) {
                    // 处理协议无关URL
                    const url = item.image_url.startsWith('//') ? 'https:' + item.image_url : item.image_url;
                    uni.getImageInfo({
                        src: url,
                        success: (res) => resolve({ ...item, path: res.path }),
                        fail: (err) => {
                            console.error('Image load failed:', url, err);
                            resolve(null);
                        }
                    });
                } else {
                    // 本地路径或base64直接使用
                    resolve({ ...item, path: item.image_url });
                }
            });
        });

        const itemsToDraw = await Promise.all(promiseList);

        // 3. 绘制元素
        itemsToDraw.forEach(item => {
            if (!item || !item.path) return;
            
            ctx.save();
            // 移动坐标原点到图片中心 (item.x, item.y 是中心点坐标)
            ctx.translate(item.x, item.y);
            // 旋转
            ctx.rotate((item.rotate * Math.PI) / 180);
            // 缩放
            ctx.scale(item.scale, item.scale);
            // 翻转
            if (item.isFlipped) {
                ctx.scale(-1, 1);
            }
            
            // 绘制图片 (偏移宽高的一半，使图片中心对齐原点)
            // item.width/height 是基准宽高
            ctx.drawImage(item.path, -item.width / 2, -item.height / 2, item.width, item.height);
            
            ctx.restore();
        });

        // 4. 生成并上传
        return new Promise((resolve) => {
            ctx.draw(false, () => {
                // 延时一小会儿确保绘制完成
                setTimeout(() => {
                    uni.canvasToTempFilePath({
                        canvasId: 'snapshotCanvas',
                        width: cW,
                        height: cH,
                        destWidth: cW * 2, // 2x 输出更清晰
                        destHeight: cH * 2,
                        fileType: 'jpg',
                        quality: 0.8,
                        success: async (res) => {
                            try {
                                const uploadRes: any = await uploadSnapshot(res.tempFilePath);
                                if (uploadRes && (uploadRes.code === 200 || uploadRes.url)) {
                                     resolve(uploadRes.url || uploadRes.data?.url);
                                } else {
                                    console.error('Upload failed result:', uploadRes);
                                    resolve('');
                                }
                            } catch (e) {
                                console.error('Upload error:', e);
                                resolve('');
                            }
                        },
                        fail: (err) => {
                            console.error('Canvas export failed:', err);
                            resolve('');
                        }
                    }, instance);
                }, 200);
            });
        });

    } catch (e) {
        console.error('Snapshot generation error:', e);
        return '';
    } finally {
        uni.hideLoading();
    }
};

const handleSave = () => {
    if (canvasItems.value.length === 0) {
        uni.showToast({ title: '请先添加衣物', icon: 'none' });
        return;
    }
    // 【修复】点击保存时取消选中状态，防止编辑框(虚线和按钮)浮在弹窗之上，同时解决层级穿透造成的视觉干扰
    activeUuid.value = '';
    showSavePopup.value = true;
};

const cancelSave = () => {
    showSavePopup.value = false;
};

const confirmSave = async () => {
    if (!form.value.name || !form.value.name.trim()) {
        uni.showToast({ title: '请输入搭配名称', icon: 'none' });
        return;
    }

    // 获取当前用户信息，确保 account 存在
    const currentUser = uni.getStorageSync('userInfo') || {};
    if (!currentUser.account) {
        uni.showToast({ title: '用户信息失效，请重新登录', icon: 'none' });
        return;
    }

    // 1. 生成封面图
    let finalSnapshotUrl = '';
    
    // 如果已有 items，尝试生成快照
    if (canvasItems.value.length > 0) {
        try {
            finalSnapshotUrl = await generateSnapshot();
        } catch (e) {
            console.error('Snapshot generation failed', e);
        }
        
        // 兜底策略：如果生成失败，使用第一件衣物的图片作为封面
        if (!finalSnapshotUrl && canvasItems.value.length > 0) {
            finalSnapshotUrl = canvasItems.value[0].image_url;
        }
    }

    // 2. 准备数据
    // 收集所有衣物的ID
    const { width: cW, height: cH } = canvasRect.value;
    const safeW = cW || 375;
    const safeH = cH || 375;

    const items = canvasItems.value.map((item: CanvasItem) => ({
        cloth_id: item.id, // 修复：改为 cloth_id 以匹配后端接口
        // 保存相对坐标 (0-1)，确保不同设备回显一致
        position_x: item.x / safeW,
        position_y: item.y / safeH,
        scale: item.scale,
        // 后端通常存 rotation
        rotation: item.rotate, 
        z_index: item.zIndex,
        is_flipped: item.isFlipped ? 1 : 0,
        is_locked: item.locked ? 1 : 0
    }));

    if (items.length === 0) {
         uni.showToast({ title: '请至少添加一件衣物', icon: 'none' });
         return;
    }

    const data: any = {
        account: currentUser.account,
        name: form.value.name,
        // items 需要序列化传递给后端 -> 改为直接传对象，uni.request 会处理
        items: items,
        description: form.value.remarks,
        weather: form.value.weather,
        temperature: form.value.temperature,
        season_ids: form.value.season_ids,
        scene_ids: form.value.scene_ids,
        bg_color: currentBg.value
    };

    // 只有当生成了新图时才更新 image_url
    if (finalSnapshotUrl) {
        data.image_url = finalSnapshotUrl;
    }

    uni.showLoading({ title: '保存中...' });

    try {
        if (outfitId.value) {
            await updateOutfit(outfitId.value, data);
            uni.showToast({ title: '更新成功', icon: 'success' });
        } else {
            // 新建时，如果没有图，可能用默认图或者必须有图
            if (!data.image_url) {
                // 如果生成失败，为了演示可以使用 placeholder 或者阻止
                // data.image_url = '...default...';
            }
            await createOutfit(data);
            uni.showToast({ title: '创建成功', icon: 'success' });
        }
        
        // 通知列表页刷新
        uni.$emit('refreshOutfitList');
        
        showSavePopup.value = false;
        
        // 延迟返回，让用户看到成功提示
        setTimeout(() => {
            uni.navigateBack();
        }, 1500);
        
    } catch (e: any) {
        uni.showToast({ title: e.msg || '保存失败', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};

// --- 加载初始数据 ---
const loadOutfitDetail = async (id: string | number) => {
    uni.showLoading({ title: '加载搭配...' });

    try {
        const res = await getOutfitDetail(id) as any;
        if (res.code === 200) {
            const data = res.data;
            // 填充表单
            form.value.name = data.name;
            form.value.remarks = data.description;
            form.value.weather = data.weather;
            form.value.temperature = data.temperature;
            outfitSource.value = data.source || ''; // 记录来源
            currentBg.value = data.bg_color || '#f7f8fa';
            
            // 解析 ID 列表 (假设后端返回的是对象数组或逗号分隔字符串)
            // 这里假设后端返回标准的关联数组
             if (data.scenes) form.value.scene_ids = data.scenes.map((s:any) => s.id);
             if (data.seasons) form.value.season_ids = data.seasons.map((s:any) => s.id);

            // 准备画布数据
            // 注意：这里先把数据存起来，等画布 ready 后再渲染，或者直接计算
            if (data.items && data.items.length > 0) {
                 pendingDetailItems.value = data.items;
                 renderPendingItems();
            }
            
            // 检查收藏状态
            checkFavStatus();

        } else {
             uni.showToast({ title: '数据异常', icon: 'none' });
        }
    } catch (error) {
        console.error(error);
        uni.showToast({ title: '获取详情失败', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};

// --- 收藏逻辑 ---
const checkFavStatus = async () => {
    // 确保有 ID 且有用户信息
    const uid = userInfo.id || (uni.getStorageSync('userInfo') || {}).id;
    if (!outfitId.value || !uid) return;
    
    try {
        const res: any = await checkFavorite(uid, 'outfit', Number(outfitId.value));
        if (res.code === 200) {
            isFavorite.value = res.data.is_favorite;
        }
    } catch (e) {
        console.error('Check favorite failed:', e);
    }
};

const toggleFavorite = async () => {
    const uid = userInfo.id || (uni.getStorageSync('userInfo') || {}).id;
    if (!uid) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        return;
    }
    
    uni.showLoading({ mask: true });
    try {
        if (isFavorite.value) {
            await removeFavorite({
                userId: uid,
                itemType: 'outfit',
                itemId: Number(outfitId.value)
            });
            isFavorite.value = false;
            uni.showToast({ title: '已取消收藏', icon: 'none' });
        } else {
            await addFavorite({
                userId: uid,
                itemType: 'outfit',
                itemId: Number(outfitId.value)
            });
            isFavorite.value = true;
            uni.showToast({ title: '收藏成功' });
        }
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};

// 专门负责将后端数据渲染到画布
const renderPendingItems = () => {
    // 获取当前画布尺寸，如果未就绪则使用屏幕宽度兜底
    let cW = canvasRect.value.width;
    let cH = canvasRect.value.height;

    // 如果画布尺寸未获取到（比如刚进入页面），尝试用屏幕宽度兜底
    if (!cW || cW === 0) {
        const sys = uni.getSystemInfoSync();
        cW = sys.windowWidth;
        // 假设画布是正方形
        cH = cW; 
        
        // 更新全局状态，确保保存时也用这个基准
        canvasRect.value.width = cW;
        canvasRect.value.height = cH;
        snapshotWidth.value = cW;
        snapshotHeight.value = cH;
    }

    // 默认比例
    const safeW = cW;
    const safeH = cH;

    // 1. 防御性排序：确保按 zIndex 从小到大渲染 (虽然后端排了序，前端再保底一次)
    const sortedItems = [...pendingDetailItems.value].sort((a, b) => {
        return (Number(a.z_index) || 0) - (Number(b.z_index) || 0);
    });

    canvasItems.value = sortedItems.map((item: any) => {
        // 判断是否需要坐标转换：如果 position_x > 2，说明是旧的历史数据（绝对坐标），否则是相对坐标
        let x = Number(item.position_x) || 0.5;
        let y = Number(item.position_y) || 0.5;
        
        // 相对坐标转绝对坐标
        if (x <= 1.5) { x = x * safeW; }
        if (y <= 1.5) { y = y * safeH; }

        return {
            uuid: generateUUID(),
            id: item.cloth_id || item.id, // 核心修复：后端返回 cloth_id，前端模型用 id
            image_url: item.image_url,
            // 恢复绝对坐标
            x: x,
            y: y,
            
            width: 200, // 统一默认大小，通过 scale 控制 visuals
            height: 200,
            
            scale: Number(item.scale) || 0.5,
            rotate: Number(item.rotation) || 0,
            zIndex: Number(item.z_index) || 1,
            isFlipped: Number(item.is_flipped) === 1, // 修复：后端可能存的是 0/1
            locked: Number(item.is_locked) === 1
        };
    });

    // 清空缓冲区，避免重复渲染
    pendingDetailItems.value = [];
};

const loadCategories = async () => {
    try {
        const res = await getCategories() as any;
        if (res.code === 200) {
            categories.value = res.data;
        } else {
            uni.showToast({ title: res.msg || '获取分类失败', icon: 'none' });
        }
    } catch (error) {
        console.error(error);
        uni.showToast({ title: '获取分类失败', icon: 'none' });
    }
};

const loadScenes = async () => {
    try {
        const res = await getScenes() as any;
        if (res.code === 200) {
            scenes.value = res.data;
        } else {
            uni.showToast({ title: res.msg || '获取场景失败', icon: 'none' });
        }
    } catch (error) {
        console.error(error);
        uni.showToast({ title: '获取场景失败', icon: 'none' });
    }
};

const loadSeasons = async () => {
    try {
        const res = await getSeasons() as any;
        if (res.code === 200) {
            seasons.value = res.data;
        } else {
            uni.showToast({ title: res.msg || '获取季节失败', icon: 'none' });
        }
    } catch (error) {
        console.error(error);
        uni.showToast({ title: '获取季节失败', icon: 'none' });
    }
};

// 应用灵感/一键试穿
const applyInspiration = () => {
    uni.showModal({
        title: '试穿灵感',
        content: '将基于此灵感创建新的搭配，您可以自由调整。',
        success: (res) => {
            if (res.confirm) {
                // 1. 解除只读
                isReadOnly.value = false;
                // 2. 清空ID，视为新建
                outfitId.value = '';
                // 3. 重置标题
                // uni.setNavigationBarTitle({ title: 'DIY搭配' });
                // 4. 提示
                uni.showToast({ title: '已应用，请开始创作', icon: 'none' });
            }
        }
    });
};

// --- 列表加载与筛选 ---
const loadClothes = async (refresh = false) => {
    if (listLoading.value) return;
    if (refresh) {
        page.value = 1;
        hasMore.value = true;
        clothesList.value = [];
    }
    if (!hasMore.value) return;

    listLoading.value = true;
    try {
        const currentUser = uni.getStorageSync('userInfo') || {};

        if (!currentUser.account) {
            listLoading.value = false;
            return;
        }

        const params: any = {
            account: currentUser.account,
            page: page.value,
            page_size: 20,
        };

        if (currentCatId.value && currentCatId.value > 0) {
            params.category_id = currentCatId.value;
        }

        // 转换参数格式，适配后端
        if (filterForm.value.scene_ids.length > 0) {
            params.scene_id = filterForm.value.scene_ids.join(',');
        }
        if (filterForm.value.season_ids.length > 0) {
            params.season_id = filterForm.value.season_ids.join(',');
        }
        if (filterForm.value.color) {
            params.color = filterForm.value.color;
        }

        const res = await getClothesList(params) as any;
        if (res.code === 200) {
            const list = res.data?.list || [];
            const total = res.data?.total || 0;

            if (refresh) {
                clothesList.value = list;
            } else {
                clothesList.value = [...clothesList.value, ...list];
            }
            hasMore.value = clothesList.value.length < total;
            if (hasMore.value) {
                page.value++;
            }
        }
    } catch (error) {
        console.error(error);
        uni.showToast({ title: '加载衣物失败', icon: 'none' });
    } finally {
        listLoading.value = false;
    }
};

const loadMoreClothes = () => {
    loadClothes(false);
};

const switchCategory = (id: number) => {
    if (currentCatId.value === id) return;
    currentCatId.value = id;
    loadClothes(true);
};

const toggleFilter = (list: number[], id: number) => {
    const index = list.indexOf(id);
    if (index > -1) {
        list.splice(index, 1);
    } else {
        list.push(id);
    }
};

const applyFilter = () => {
    showFilterPopup.value = false;
    loadClothes(true);
};

const resetFilter = () => {
    filterForm.value = {
        scene_ids: [],
        season_ids: [],
        color: ''
    };
    loadClothes(true);
};

// 添加到画布
const addToCanvas = (item: any) => {
    const { width: cW, height: cH } = canvasRect.value;
    const centerX = (cW || 375) / 2;
    // 修改：位置靠近画布顶部 (约 1/4 处)
    const topY = (cH || 375) * 0.25; 

    const imageUrl = item.image_url || item.image;

    // 获取图片信息以计算比例
    uni.getImageInfo({
        src: imageUrl,
        success: (imageRes) => {
            const ratio = imageRes.width / imageRes.height;
            // 设定基准宽度为 150px (比200小一点，避免太大)
            const baseWidth = 150;
            const itemWidth = baseWidth;
            const itemHeight = baseWidth / ratio;

            const newItem: CanvasItem = {
                uuid: generateUUID(),
                id: item.id,
                image_url: imageUrl,
                x: centerX + (Math.random() * 40 - 20),
                // 使用 topY
                y: topY + (Math.random() * 40 - 20),
                width: itemWidth,
                height: itemHeight,
                scale: 0.5, // 初始缩放
                rotate: 0,
                zIndex: canvasItems.value.length + 1,
                isFlipped: false,
                locked: false
            };
            
            canvasItems.value.push(newItem);
            activeUuid.value = newItem.uuid;
            updateZIndex(newItem);
            uni.showToast({ title: '已添加', icon: 'none' });
        },
        fail: () => {
            // 获取失败兜底
            const newItem: CanvasItem = {
                uuid: generateUUID(),
                id: item.id,
                image_url: imageUrl,
                x: centerX,
                // 使用 topY
                y: topY,
                width: 200,
                height: 200,
                scale: 0.5,
                rotate: 0,
                zIndex: canvasItems.value.length + 1,
                isFlipped: false,
                locked: false
            };
            canvasItems.value.push(newItem);
            activeUuid.value = newItem.uuid;
            updateZIndex(newItem);
            uni.showToast({ title: '添加成功(默认比例)', icon: 'none' });
        }
    });
};

// --- 画布操作 ---
// 点击面板头部触发
const onPanelClick = () => {
    // 切换展开/收起
    isPanelExpanded.value = !isPanelExpanded.value;
    if (isPanelExpanded.value) {
        // 展开时取消画布选中
        activeUuid.value = '';
        if (clothesList.value.length === 0) {
            loadClothes(true);
        }
    }
};

const expandPanel = () => { 
    isPanelExpanded.value = true; 
    activeUuid.value = '';
};

const collapsePanel = () => {
    if (isDragging || isTransforming) return;
    // 点击画布空白处，取消选中
    activeUuid.value = '';
    // 同时收起面板
    isPanelExpanded.value = false;
};

const deleteItem = (item: CanvasItem) => {
    const index = canvasItems.value.findIndex((i: CanvasItem) => i.uuid === item.uuid);
    if (index > -1) {
        canvasItems.value.splice(index, 1);
        activeUuid.value = '';
    }
};

// 切换图层层级（置顶/置底）
const toggleLayer = (item: CanvasItem) => {
    if (!item) return;
    
    // 1. 复制一份数组并按当前 zIndex 排序，理清当前的层级关系
    const sortedItems = [...canvasItems.value].sort((a, b) => a.zIndex - b.zIndex);
    
    // 找到当前 item 在排序后数组中的位置
    const currentIndex = sortedItems.findIndex(i => i.uuid === item.uuid);
    
    // 2. 判断是否在最顶层 (即最后一个)
    const isAtTop = currentIndex === sortedItems.length - 1;
    
    if (isAtTop) {
        // 如果在最顶层，将其移到最底层 (数组开头)
        // 从当前位置删除
        sortedItems.splice(currentIndex, 1);
        // 插入到开头
        sortedItems.unshift(item);
        uni.showToast({ title: '已置底', icon: 'none' });
    } else {
        // 否则，将其移到最顶层 (数组末尾)
        // 从当前位置删除
        sortedItems.splice(currentIndex, 1);
        // 插入到末尾
        sortedItems.push(item);
        uni.showToast({ title: '已置顶', icon: 'none' });
    }

    // 3. 重新分配正整数 zIndex，保证最小为 10，且不重复，避免产生负数或 0 被背景遮挡
    sortedItems.forEach((img, idx) => {
        // 我们直接修改源对象的属性
        // 起始值设为 10，给背景留足空间
        img.zIndex = 10 + idx; 
    });
};

// --- 触摸拖拽逻辑 (移动) ---
const onTouchStart = (item: CanvasItem, event: any) => {
    if (isReadOnly.value) return;

    // 选中当前项
    if (activeUuid.value !== item.uuid) {
        activeUuid.value = item.uuid;
    }

    // 如果已锁定，禁止拖动，但允许选中（显示解锁按钮）
    if (item.locked) return;

    if (event.touches.length !== 1) return;

    isDragging = true;
    isTransforming = false;
    currentItem = item;

    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    initialItemX = item.x;
    initialItemY = item.y;

    // 移除自动置顶，避免误操作
    // updateZIndex(item);
};

const onTouchMove = (event: any) => {
    if (!isDragging || !currentItem) return;

    event.preventDefault && event.preventDefault();
    event.stopPropagation && event.stopPropagation();

    const touch = event.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    currentItem.x = initialItemX + deltaX;
    currentItem.y = initialItemY + deltaY;
};

const onTouchEnd = () => {
    isDragging = false;
    currentItem = null;
};

// 只有未锁定时才能变换
const onHandleStart = (item: CanvasItem, event: any) => {
    if (item.locked || isReadOnly.value) return;
    
    event.stopPropagation();
    event.preventDefault();

    isTransforming = true;
    isDragging = false;
    currentItem = item;

    const touch = event.touches[0];
    const { clientX, clientY } = touch;
    
    // 记录初始状态
    startX = clientX;
    startY = clientY;
    initialRotate = item.rotate;
    initialScale = item.scale;
    
    // 计算中心点屏幕坐标
    // 注意：item.x/y 是相对于 canvas-container 的坐标
    // 我们需要计算触摸点相对于 item 中心的角度和距离
    // 一种简化的方式是记录起始角度和起始距离
};

const onHandleMove = (event: any) => {
    if (!isTransforming || !currentItem) return;

    event.preventDefault();
    event.stopPropagation();
    
    const touch = event.touches[0];
    const { clientX, clientY } = touch;

    // 获取画布在屏幕上的位置
    // 由于我们在 onReady 中获取了 rect，但页面滚动可能影响，最好实时计算或使用 fixed 布局
    // 这里简化处理：假设 item.x/y 加上 canvasOffset 即为屏幕坐标
    const centerScreenX = currentItem.x + canvasOffset.value.left;
    const centerScreenY = currentItem.y + canvasOffset.value.top;

    // 1. 计算旋转
    // 起始向量 (上一次) -> 当前向量
    // 这里使用更直接的方式：基于中心点计算当前触摸点的角度
    const diffX = clientX - centerScreenX;
    const diffY = clientY - centerScreenY;
    
    // 当前角度 (弧度)
    const angle = Math.atan2(diffY, diffX);
    // 转换为角度
    let deg = angle * (180 / Math.PI);
    // 修正：手柄通常在右下角 (45度)，所以需要补偿
    deg = deg - 45; 
    
    currentItem.rotate = deg;

    // 2. 计算缩放
    // 距离中心点的距离
    const distance = Math.sqrt(diffX * diffX + diffY * diffY);
    // 假设初始距离（图片对角线的一半）对应 scale=1
    // item.width = 200, 对角线约 282, 半径 141
    // 动态计算： Scale = 当前距离 / (基准半径 * 初始Scale) ? 
    // 更简单的：Scale = 当前距离 / 100 (假设100px为基准)
    const newScale = distance / 100;
    
    // 限制缩放范围
    currentItem.scale = Math.max(0.2, Math.min(newScale, 3));
};

const onHandleEnd = () => {
    isTransforming = false;
    currentItem = null;
};

// 刷新 ZIndex，确保当前选中项在最上层（可选，视需求而定）
// 这里实现简单的 zIndex 维护，不一定要改变数值，主要是为了配合业务逻辑
const updateZIndex = (item: CanvasItem) => {
    // 简单的置顶逻辑：找到最大的zIndex + 1
    const maxZ = canvasItems.value.reduce((max: number, i: CanvasItem) => Math.max(max, i.zIndex), 0);
    // 如果已经是最大，无需操作
    if (item.zIndex === maxZ && maxZ > 0) return;
    item.zIndex = maxZ + 1;
};

const flipItem = (item: CanvasItem) => {
    item.isFlipped = !item.isFlipped;
};

const lockItem = (item: CanvasItem) => {
    item.locked = true;
    // 锁定后取消选中，避免误操作
    activeUuid.value = '';
};

const unlockItem = (item: CanvasItem) => {
    item.locked = false;
    activeUuid.value = item.uuid;
};

const confirmClear = () => {
    uni.showModal({
        content: '确定清空画布吗？',
        success: (res) => {
            if (res.confirm) {
                canvasItems.value = [];
            }
        }
    });
};

const handleAddSceneTag = () => {
    uni.showModal({
        title: '新增场景',
        editable: true,
        placeholderText: '请输入场景名称',
        success: async (res) => {
            if (res.confirm && res.content && res.content.trim()) {
                try {
                    // 修复参数名 name -> names
                    const result = await addTag({ names: res.content.trim(), type: 'SCENE' }) as any;
                    if (result.code === 200) {
                        uni.showToast({ title: '添加成功', icon: 'none' });
                        loadScenes(); // 刷新标签列表
                        // 自动选中新标签
                        // if (result.data?.id) toggleSaveTag('scene', result.data.id);
                    }
                } catch (e) {
                    uni.showToast({ title: '添加失败', icon: 'none' });
                }
            }
        }
    });
};

const toggleSaveTag = (type: 'scene' | 'season', id: number) => {
    const list = type === 'scene' ? form.value.scene_ids : form.value.season_ids;
    const index = list.indexOf(id);
    if (index > -1) {
        list.splice(index, 1);
    } else {
        list.push(id);
    }
};

// --- 生命周期 ---
onLoad((options: any) => {
    if (options.id) {
        outfitId.value = options.id;
        loadOutfitDetail(options.id);
    }
    
    if (options.readonly === 'true') {
        isReadOnly.value = true;
    }

    if (options.date) {
        targetDate.value = options.date;
    }

    // 预加载基础数据
    loadCategories();
    loadScenes();
    loadSeasons();
});

onReady(() => {
    isCanvasReady.value = true;
    
    // 获取画布容器的位置信息，用于计算触摸坐标
    const query = uni.createSelectorQuery().in(instance);
    query.select('.canvas-container').boundingClientRect((data: any) => {
        if (data) {
            canvasRect.value = {
                width: data.width,
                height: data.height,
                left: data.left,
                top: data.top
            };
            canvasOffset.value = { left: data.left, top: data.top };
            
            // 同步更新快照画布尺寸
            snapshotWidth.value = data.width;
            snapshotHeight.value = data.height;

            // 如果有待渲染的数据（详情页进入），此时渲染
            if (pendingDetailItems.value.length > 0) {
                renderPendingItems();
            }
        }
    }).exec();
    
    loadClothes(true);
});

onUnmounted(() => {
    uni.$off('refreshOutfitList');
});

</script>

<style lang="scss" scoped>
.outfit-editor {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: #f7f8fa;
}

.page-header {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    padding-top: var(--status-bar-height);
    /* 适配刘海屏 */
    background: #fff;
    font-size: 16px;
    font-weight: 600;
    z-index: 100;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

    .back-btn {
        padding: 8px 8px 8px 0;
    }

    .delete-outfit-btn, .favorite-btn {
        padding: 8px;
    }
}

.top-bar {
    height: 50px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid #ebedf0;
    z-index: 99;

    .bg-selector {
        display: flex;
        gap: 12px;
        flex: 1; // 占据左侧空间

        .color-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 1px solid #e0e0e0;
            position: relative;

            &.active::after {
                content: '';
                position: absolute;
                top: -3px;
                left: -3px;
                right: -3px;
                bottom: -3px;
                border-radius: 50%;
                border: 2px solid #07c160;
            }
        }
    }

    .right-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .action-btn {
        padding: 6px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        
        &:active {
            opacity: 0.8;
        }
    }

    .save-btn {
        background: #07c160;
        color: #fff;
    }

    .clear-btn {
        background: #f5f5f5;
        color: #666;
    }
}

.canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    /* 增加网格背景纹理，方便对齐 (可选) */
    background-image: radial-gradient(#e0e0e0 1px, transparent 1px);
    background-size: 20px 20px;
    transition: background 0.3s;

    .empty-tip {
        position: absolute;
        top: 40%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #999;
        font-size: 14px;
        pointer-events: none;
    }

    .canvas-item {
        position: absolute;
        /* 初始宽高由 image 控制，这里只定位中心点 */
        display: flex;
        align-items: center;
        justify-content: center;
        /* transform 由行内样式控制 */
        
        /* 默认无边框 */
        border: 1px dashed transparent;

        &.active {
            border-color: #07c160;
            /* 移除 z-index: 9999 !important，以便在调整层级时能立刻看到效果。
               虽然这可能导致选中的物体被遮挡，但对于层级编辑是必要的。
            */
            /* z-index: 9999 !important; */ 
            
            .controls {
                display: block; // 激活时显示控件
            }
        }

        .item-img {
            width: 100%;
            height: 100%;
            display: block;
            /* 保持原有比例 */
            object-fit: contain; 
            pointer-events: none; /* 让点击穿透到父容器 */
        }
        
        .controls {
            display: none; /* 默认隐藏 */
            position: absolute;
            left: -12px;
            top: -12px;
            right: -12px;
            bottom: -12px;
            pointer-events: none; /* 控件容器本身不应阻挡 */

            .ctrl-btn {
                position: absolute;
                width: 24px;
                height: 24px;
                background: rgba(0, 0, 0, 0.6);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: auto; /* 按钮需要响应点击 */
                z-index: 10;
                
                &:active {
                    transform: scale(0.9);
                }
            }

            .delete-btn {
                top: 0;
                left: 0;
                background: #ff4d4f;
            }

            .flip-btn {
                top: 0;
                right: 0;
                background: #1890ff;
            }
            
            .transform-handle {
                bottom: 0;
                right: 0;
                background: #07c160;
                cursor: nwse-resize;
            }

            .layer-btn {
                bottom: 0;
                left: 0;
                background: #faad14;
            }

            .lock-btn {
                top: 50%;
                left: -12px;
                transform: translateY(-50%);
                background: #722ed1;
            }
            
            &.locked-controls {
                display: block; /* 锁定状态只显示解锁 */
                border: 1px solid #f44;
                
                .unlock-btn {
                    position: absolute;
                    top: -10px;
                    right: -10px;
                    width: 20px;
                    height: 20px;
                    background: #fff;
                    border: 1px solid #f44;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: auto;
                }
            }
        }
    }
}

/* 底部面板 */
.bottom-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 60vh; /* 展开高度 */
    background: #fff;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    /* 修改：默认露出更多内容 (Tab 44px + Handle 16px + Padding + 约一行衣物) -> 约 220px */
    transform: translateY(calc(100% - 220px)); 
    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); // 缓动效果
    /* 修复：提高层级，使其高于选中状态的衣物(z-index: 9999) */
    z-index: 10000;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom);

    &.expanded {
        transform: translateY(0);
    }

    &.hidden {
        transform: translateY(100%); /* 只读模式完全隐藏 */
    }
}

.panel-handle {
    width: 40px;
    height: 4px;
    background: #e0e0e0;
    border-radius: 2px;
    margin: 8px auto 4px; /* 上下间距 */
    flex-shrink: 0;
}

.category-tabs {
    flex-shrink: 0;
    height: 44px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid #f5f5f5;
    padding: 0 12px;

    .tabs-scroll {
        flex: 1;
        white-space: nowrap;
        overflow-x: auto;
        margin-right: 8px;

        .tab-item {
            display: inline-block;
            padding: 6px 16px;
            font-size: 14px;
            color: #666;
            margin-right: 8px;
            border-radius: 16px;
            background: #f5f5f5;

            &.active {
                background: #e8f7f0;
                color: #07c160;
                font-weight: 500;
            }
        }
    }
    
    .filter-icon {
        padding: 8px;
    }
}

.clothes-scroll {
    flex: 1;
    height: 0; /* 必须设置具体的 flex-basis 为 0 或其他，让 flex 自动填充 */
    background: #fafafa;
    
    .clothes-list {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 12px;
    }

    .clothes-card {
        aspect-ratio: 1;
        background: #fff;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #f0f0f0;
        
        .c-img {
            width: 100%;
            height: 100%;
        }

        &:active {
            opacity: 0.8;
            transform: scale(0.98);
        }
    }
}

.safe-area-spacer {
    height: 20px;
    width: 100%;
}

/* 保存弹窗 */
.save-popup {
    padding: 24px 16px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
    background: #fff;
    border-radius: 20px 20px 0 0;
    min-height: 50vh;
    display: flex;
    flex-direction: column;
    gap: 16px;

    .popup-title {
        font-size: 18px;
        font-weight: 600;
        text-align: center;
        margin-bottom: 8px;
    }
    
    .tags-section {
        .section-title {
            font-size: 14px;
            color: #333;
            margin-bottom: 8px;
            font-weight: 500;
        }

        .tags-wrapper {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            
            .tag-touch-area {
                /* 增加点击区域 */
                display: inline-block;
            }

            .my-tag {
                padding: 4px 12px;
                border-radius: 4px;
            }
            
            .add-tag-btn {
                width: 28px;
                height: 28px;
                border: 1px dashed #ccc;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        }
        
        .selectors-row {
            display: flex;
            gap: 12px;
            
            .picker-item {
                flex: 1;
                background: #f7f8fa;
                padding: 10px 12px;
                border-radius: 8px;
                
                .picker-display {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 14px;
                    
                    .value {
                        flex: 1;
                        text-align: right;
                        margin-right: 4px;
                        color: #333;
                    }
                    
                    .label {
                        color: #666;
                    }
                }
            }
        }
    }

    .btn-area {
        margin-top: 16px;
    }
}

/* 筛选弹窗 */
.filter-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
    padding-top: var(--status-bar-height);

    .filter-title {
        padding: 16px;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
        border-bottom: 1px solid #f5f5f5;
    }

    .filter-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;

        .filter-section {
            margin-bottom: 24px;

            .section-header {
                font-size: 14px;
                font-weight: 600;
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
                    border-radius: 100px;
                    font-size: 13px;
                    color: #666;
                    border: 1px solid transparent;

                    &.active {
                        background: rgba(7, 193, 96, 0.1);
                        color: #07c160;
                        border-color: #07c160;
                    }
                }
            }
            
            .colors-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                
                .color-item {
                     display: flex;
                     flex-direction: column;
                     align-items: center;
                     gap: 6px;
                     padding: 8px 0;
                     border-radius: 8px;
                     border: 1px solid transparent;
                     
                     &.active {
                         background: #f0f9f3;
                         border-color: #07c160;
                     }
                     
                     .color-circle {
                         width: 24px;
                         height: 24px;
                         border-radius: 50%;
                         box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                     }
                     
                     .color-name {
                         font-size: 12px;
                         color: #666;
                     }
                }
            }
        }
    }

    .filter-actions {
        padding: 16px;
        display: flex;
        gap: 12px;
        border-top: 1px solid #f5f5f5;
        padding-bottom: calc(16px + env(safe-area-inset-bottom));

        .action-btn {
            flex: 1;
        }
    }
}

/* 只读操作栏 */
.readonly-actions {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    padding: 12px 24px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    display: flex;
    justify-content: center;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    z-index: 100;

    .primary-btn {
        width: 100%;
        height: 44px;
        background: #07c160;
        color: #fff;
        border-radius: 22px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        
        &:active {
            opacity: 0.9;
        }
    }
}
</style>
