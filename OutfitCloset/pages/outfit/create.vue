<template>
    <view class="outfit-editor">
        <!-- 顶部标题 -->
        <view class="page-header">
            <view class="back-btn" @tap="goBack">
                <van-icon name="arrow-left" size="22px" color="#333" />
            </view>
            <text>{{ outfitId ? '编辑搭配' : 'DIY搭配' }}</text>
            <view v-if="outfitId" class="delete-outfit-btn" @tap="handleDelete">
                <van-icon name="delete-o" size="22px" color="#ee0a24" />
            </view>
        </view>

        <!-- 顶部工具栏 -->
        <view class="top-bar">
            <view class="bg-selector">
                <view v-for="(color, index) in bgColors" :key="index" class="color-dot"
                    :class="{ active: currentBg === color }" :style="{ background: color }" @tap="currentBg = color">
                </view>
            </view>
            <view class="save-btn" @tap="handleSave">保存</view>
        </view>

        <!-- 离屏 Canvas，用于生成合成图 (移出屏幕外) -->
        <!-- 修复：将 left 改为 0 且 z-index 设为负数，防止因移出屏幕导致 draw 回调不执行 -->
        <canvas canvas-id="snapshotCanvas" id="snapshotCanvas" :style="{
            width: 375 + 'px',
            height: 375 + 'px',
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
                @touchend.stop="onTouchEnd">
                <image :src="item.image_url" mode="aspectFit" class="item-img"
                    :style="{ transform: item.isFlipped ? 'scaleX(-1)' : 'none' }" />

                <!-- 选中状态下的操作控件 -->
                <view v-if="activeUuid === item.uuid && !item.locked" class="controls">
                    <!-- 删除按钮 (左上角) -->
                    <view class="ctrl-btn delete-btn" @tap.stop="deleteItem(index)">
                        <van-icon name="cross" color="#fff" size="12px" />
                    </view>
                    <!-- 翻转按钮 (右上角) -->
                    <view class="ctrl-btn flip-btn" @tap.stop="flipItem(item)">
                        <van-icon name="exchange" color="#fff" size="12px" />
                    </view>
                    <!-- 锁定按钮 (左下角) -->
                    <view class="ctrl-btn lock-btn" @tap.stop="lockItem(item)">
                        <van-icon name="lock" color="#fff" size="12px" />
                    </view>
                    <!-- 变换手柄 (右下角) -->
                    <view class="ctrl-btn transform-handle" @touchstart.stop="onHandleStart(item, $event)"
                        @touchmove.stop="onHandleMove" @touchend.stop="onHandleEnd">
                        <van-icon name="replay" color="#fff" size="12px" />
                    </view>
                </view>

                <!-- 锁定状态下的提示/解锁按钮 (右上角) -->
                <view v-if="activeUuid === item.uuid && item.locked" class="controls locked-controls">
                    <view class="ctrl-btn unlock-btn" @tap.stop="unlockItem(item)">
                        <van-icon name="lock" color="#f44" size="12px" />
                    </view>
                </view>
            </view>

            <view v-if="canvasItems.length === 0" class="empty-tip">
                点击下方衣物添加到画布
            </view>
        </view>

        <!-- 底部衣橱面板 -->
        <view class="bottom-panel" :class="{ expanded: isPanelExpanded }" @tap.stop="expandPanel">
            <!-- 分类 Tab -->
            <view class="category-tabs">
                <scroll-view scroll-x class="tabs-scroll" :show-scrollbar="false">
                    <view class="tab-item" :class="{ active: currentCatId === 0 }" @tap="switchCategory(0)">全部</view>
                    <view v-for="cat in categories" :key="cat.id" class="tab-item"
                        :class="{ active: currentCatId === cat.id }" @tap="switchCategory(cat.id)">
                        {{ cat.name }}
                    </view>
                </scroll-view>
                <view class="filter-icon" @tap.stop="showFilterPopup = true">
                    <van-icon name="filter-o" size="20px" />
                </view>
            </view>

            <!-- 衣物列表 -->
            <scroll-view scroll-y class="clothes-scroll" @scrolltolower="loadMoreClothes">
                <view class="clothes-list">
                    <view v-for="item in clothesList" :key="item.id" class="clothes-card" @tap="addToCanvas(item)">
                        <image :src="item.image_url" mode="aspectFill" class="c-img" />
                    </view>
                </view>
                <van-empty v-if="clothesList.length === 0 && !listLoading" description="暂无衣物" />
            </scroll-view>
        </view>

        <!-- 保存弹窗 -->
        <van-popup :show="showSavePopup" round position="bottom" @close="cancelSave" z-index="1000">
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
            @close="showFilterPopup = false">
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

        <!-- 底部添加按钮 -->
        <image class="add-btn" :class="{ 'btn-collapsed': !isPanelExpanded }" src="/static/icon/add.png"
            @tap="showClothingSelect" />

    </view>

</template>

<script setup lang="ts">
import { ref, onMounted, getCurrentInstance } from 'vue';
// @ts-ignore
import { onLoad, onReady } from '@dcloudio/uni-app';
import { getCategories, getScenes, getScenes as getTags, getSeasons, getClothesList, addTag } from '@/api/clothes';
import { createOutfit, getOutfitDetail, updateOutfit, deleteOutfit, addToCalendar, uploadSnapshot } from '@/api/outfit';

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

const canvasItems = ref<CanvasItem[]>([]);
const activeUuid = ref<string>('');
const outfitId = ref<string | number>(''); // 当前编辑的搭配ID
const targetDate = ref(''); // 来源日期（如果有）
const canvasRect = ref({ width: 0, height: 0 }); // 画布尺寸
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

// 手势相关临时变量
let startX = 0;
let startY = 0;
let initialItemX = 0;
let initialItemY = 0;
let initialRotate = 0;
let initialScale = 1;
let centerX = 0;
let centerY = 0;
let isDragging = false;
let isTransforming = false;
let currentItem: CanvasItem | null = null;
const instance = getCurrentInstance();

// --- 导航 ---
const goBack = () => {
    uni.navigateBack();
};

// 删除搭配
const handleDelete = () => {
    uni.showModal({
        title: '提示',
        content: '确定要删除该搭配吗？',
        success: async (res) => {
            if (res.confirm) {
                try {
                    const result = await deleteOutfit(outfitId.value) as any;
                    if (result.code === 200) {
                        // 通知列表页刷新
                        uni.$emit('refreshOutfitList');

                        uni.showToast({ title: '删除成功', icon: 'success' });
                        setTimeout(() => {
                            uni.navigateBack();
                        }, 1500);
                    } else {
                        uni.showToast({ title: result.msg || '删除失败', icon: 'none' });
                    }
                } catch (error) {
                    console.error(error);
                    uni.showToast({ title: '删除失败', icon: 'none' });
                }
            }
        }
    });
};

// --- 生命周期 ---
onLoad((options: any) => {
    if (options.id) {
        outfitId.value = options.id;
        loadOutfitDetail(options.id);
    }
    if (options.date) {
        targetDate.value = options.date;
    }

    loadCategories();
    loadScenes();
    loadSeasons();
    loadClothes(true);
});

// 获取画布位置信息
onReady(() => {
    const query = uni.createSelectorQuery().in(instance);

    // 使用简单的轮询确保获取到准确的宽高
    let retryCount = 0;
    const initCanvasRect = () => {
        query.select('.canvas-container').boundingClientRect((data: any) => {
            if (data && data.width > 0 && data.height > 0) {
                console.log('Canvas Ready:', data.width, data.height);
                canvasOffset.value = {
                    left: data.left || 0,
                    top: data.top || 0
                };
                canvasRect.value = {
                    width: data.width || 0,
                    height: data.height || 0
                };
                isCanvasReady.value = true;
                // 画布准备好了，尝试渲染等待中的数据
                renderPendingItems();
            } else {
                if (retryCount < 10) {
                    retryCount++;
                    setTimeout(initCanvasRect, 200);
                } else {
                    // 降级：如果实在取不到，使用屏幕宽度兜底，防止无法编辑
                    console.warn('Canvas rect fallback');
                    const sysInfo = uni.getSystemInfoSync();
                    canvasRect.value = { width: sysInfo.windowWidth, height: sysInfo.windowWidth };
                    isCanvasReady.value = true;
                    renderPendingItems();
                }
            }
        }).exec();
    };

    // 稍微延时一点开始获取，确保布局稳定
    setTimeout(initCanvasRect, 100);
});

// --- 数据保存 ---
// 生成快照并上传
const generateSnapshot = (): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        // 如果没有衣物，直接返回空字符串
        if (canvasItems.value.length === 0) {
            resolve('');
            return;
        }

        uni.showLoading({ title: '封面生成中' });

        // 1. 设置超时竞态 (3.5秒超时) —— 防止永久卡死
        let isTimedOut = false;
        const timeoutId = setTimeout(() => {
            isTimedOut = true;
            console.warn('生成封面超时，跳过');
            uni.hideLoading();
            resolve(''); // 超时则视为成功（无图），保证流程不中断
        }, 3500);

        try {
            // 修复：必须使用 instance.proxy 确保上下文绑定正确
            const contextThis = instance?.proxy || instance;
            const ctx = uni.createCanvasContext('snapshotCanvas', contextThis);

            if (!ctx) {
                console.error('Canvas context missing');
                throw new Error('Canvas context missing');
            }

            // 白色背景
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 375, 375);

            // 按 zIndex 排序
            const sortedItems = [...canvasItems.value].sort((a, b) => a.zIndex - b.zIndex);

            // 2. 并发下载图片
            const imageTasks = sortedItems.map(item => {
                return new Promise<{ path: string, item: CanvasItem } | null>((res) => {
                    // 优化：本地路径直接使用
                    if (item.image_url && !item.image_url.startsWith('http') && !item.image_url.startsWith('//')) {
                        res({ path: item.image_url, item });
                        return;
                    }

                    // 网络图片下载
                    uni.downloadFile({
                        url: item.image_url,
                        success: (dRes) => {
                            if (dRes.statusCode === 200) {
                                res({ path: dRes.tempFilePath, item });
                            } else {
                                console.warn('下载失败:', item.image_url);
                                res(null);
                            }
                        },
                        fail: () => res(null)
                    });
                });
            });

            const loadedImages = await Promise.all(imageTasks);

            if (isTimedOut) return;

            // 3. 同步绘制
            loadedImages.forEach(imgData => {
                if (!imgData) return;
                const { path, item } = imgData;

                ctx.save();
                ctx.translate(item.x, item.y);
                ctx.rotate(item.rotate * Math.PI / 180);
                // 确保宽高与缩放逻辑正确
                ctx.scale(item.scale, item.scale);
                if (item.isFlipped) ctx.scale(-1, 1);
                ctx.drawImage(path, -item.width / 2, -item.height / 2, item.width, item.height);
                ctx.restore();
            });

            // 4. 导出图片
            ctx.draw(false, () => {
                if (isTimedOut) return;

                setTimeout(() => {
                    uni.canvasToTempFilePath({
                        canvasId: 'snapshotCanvas', // 必须与模板一致
                        width: 375,
                        height: 375,
                        destWidth: 375,
                        destHeight: 375,
                        fileType: 'jpg',
                        quality: 0.7,
                        success: (res) => {
                            if (isTimedOut) return;

                            // 5. 上传
                            uploadSnapshot(res.tempFilePath)
                                .then((uploadRes: any) => {
                                    clearTimeout(timeoutId);
                                    uni.hideLoading();
                                    const finalUrl = (uploadRes.code === 200 && uploadRes.data && uploadRes.data.url)
                                        ? uploadRes.data.url
                                        : (uploadRes.url || uploadRes.data || '');
                                    resolve(finalUrl);
                                })
                                .catch(() => {
                                    clearTimeout(timeoutId);
                                    uni.hideLoading();
                                    resolve('');
                                });
                        },
                        fail: (err) => {
                            console.error('导出失败', err);
                            if (!isTimedOut) {
                                clearTimeout(timeoutId);
                                uni.hideLoading();
                                resolve('');
                            }
                        }
                    }, contextThis); // 传入组件实例
                }, 100);
            });

        } catch (e) {
            console.error('快照异常', e);
            if (!isTimedOut) {
                clearTimeout(timeoutId);
                uni.hideLoading();
                resolve('');
            }
        }
    });
};

const handleSave = () => {
    if (canvasItems.value.length === 0) {
        uni.showToast({ title: '请至少添加一件衣物', icon: 'none' });
        return;
    }
    showSavePopup.value = true;
};

const cancelSave = () => {
    showSavePopup.value = false;
};

const confirmSave = async () => {
    if (!form.value.name) {
        uni.showToast({ title: '请输入搭配名称', icon: 'none' });
        return;
    }

    // 1. 生成封面图
    // 如果生成失败返回空字符串，后端会自动使用第一件单品的图作为封面
    const snapshotUrl = await generateSnapshot();

    // 2. 准备数据
    // 收集所有衣物的ID
    const items = canvasItems.value.map(item => ({
        // 【关键修复】字段名必须为 cloth_id，与后端 routes/outfit.js 接收的字段一致！
        // 统一使用 item.id，因为它在 addToCanvas 和 renderPendingItems 中都被赋值为单品ID
        cloth_id: item.id,

        image_url: item.image_url,
        position_x: item.x, // 这里仍然保存绝对坐标，但在多端适配时建议后续转为相对坐标
        position_y: item.y,
        scale: item.scale,
        rotation: item.rotate,
        z_index: item.zIndex,
        is_flipped: item.isFlipped ? 1 : 0,
        is_locked: item.locked ? 1 : 0
    }));

    if (items.length === 0) {
        uni.showToast({ title: '画布不能为空', icon: 'none' });
        return;
    }

    const currentUser = uni.getStorageSync('userInfo') || {};

    const data = {
        account: currentUser.account,
        name: form.value.name,
        description: form.value.remarks,
        scene_ids: form.value.scene_ids,
        season_ids: form.value.season_ids,
        weather: form.value.weather,
        temperature: form.value.temperature,
        bg_color: currentBg.value,
        items: items,
        image_url: snapshotUrl // 如果为空，后端会处理
    };

    try {
        let res;
        if (outfitId.value) {
            res = await updateOutfit(outfitId.value, data);
        } else {
            res = await createOutfit(data);
        }

        if ((res as any).code === 200 || (res as any).success) {
            uni.showToast({ title: '保存成功', icon: 'success' });
            showSavePopup.value = false;

            // 延迟跳转，以便用户看到成功提示
            setTimeout(() => {
                uni.navigateBack();
            }, 1000);
        } else {
            uni.showToast({ title: (res as any).msg || '保存失败', icon: 'none' });
        }
    } catch (e) {
        uni.showToast({ title: '保存出错', icon: 'none' });
        console.error(e);
    }
};

// --- 加载初始数据 ---
const loadOutfitDetail = async (id: string | number) => {
    uni.showLoading({ title: '加载搭配...' });

    try {
        const res = await getOutfitDetail(id) as any;
        if (res.code === 200) {
            const detail = res.data;
            form.value.name = detail.name;

            // 解析标签数据
            const newSceneIds: number[] = [];
            const newSeasonIds: number[] = [];
            if (detail.tags && detail.tags.length > 0) {
                detail.tags.forEach((t: any) => {
                    // 兼容后端可能返回的标签格式差异
                    const tagId = t.tag_id || t.id;
                    const type = t.tag_type || t.type;
                    if (type === 'SCENE') newSceneIds.push(tagId);
                    if (type === 'SEASON') newSeasonIds.push(tagId);
                });
            }
            form.value.scene_ids = newSceneIds;
            form.value.season_ids = newSeasonIds;

            form.value.weather = detail.weather;
            form.value.temperature = detail.temperature;
            form.value.remarks = detail.description || '';
            currentBg.value = detail.bg_color || bgColors[0];

            // 将数据放入缓冲区，等待 Canvas Ready
            pendingDetailItems.value = detail.items || [];

            // 尝试渲染（如果 Canvas 已经 Ready，这里会直接执行；否则等待 onReady 触发）
            renderPendingItems();

        } else {
            uni.showToast({ title: res.msg || '获取详情失败', icon: 'none' });
        }
    } catch (error) {
        console.error(error);
        uni.showToast({ title: '获取详情失败', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};

// 专门负责将后端数据渲染到画布
const renderPendingItems = () => {
    if (!isCanvasReady.value || pendingDetailItems.value.length === 0) return;

    const { width: cW, height: cH } = canvasRect.value;
    console.log('Start rendering items with canvas size:', cW, cH);

    // 默认比例
    const safeW = cW || 375;
    const safeH = cH || 375;

    // 1. 防御性排序：确保按 zIndex 从小到大渲染 (虽然后端排了序，前端再保底一次)
    const sortedItems = [...pendingDetailItems.value].sort((a, b) => {
        return (Number(a.z_index) || 0) - (Number(b.z_index) || 0);
    });

    canvasItems.value = sortedItems.map((item: any) => {
        // 判断 position_x 是否是百分比 (小于等于1的当作百分比，大于1的当作旧数据的像素值)
        let finalX = Number(item.position_x);
        let finalY = Number(item.position_y);

        // 防御性处理：如果坐标无效，放到画布中心
        if (isNaN(finalX)) finalX = 0.5;
        if (isNaN(finalY)) finalY = 0.5;

        // 只有当坐标是相对值(<=1)时才需要转换
        if (finalX <= 1) finalX = finalX * safeW;
        if (finalY <= 1) finalY = finalY * safeH;

        return {
            uuid: item.uuid || Date.now().toString() + Math.random(),
            id: item.cloth_id,
            image_url: item.image_url,
            x: finalX,
            y: finalY,
            width: Number(item.width) || 150,
            height: Number(item.height) || 150,
            scale: Number(item.scale) || 1,
            rotate: Number(item.rotation) || 0,
            zIndex: Number(item.z_index) || 0,
            isFlipped: !!item.is_flipped, // 数据库存的是 0/1，转 boolean
            locked: !!item.is_locked
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

// --- 画布操作 ---
const addToCanvas = (item: any) => {
    // 默认放到中心
    const { width: cW, height: cH } = canvasRect.value;
    const centerX = cW ? cW / 2 : 180;
    const centerY = cH ? cH / 2 : 200;

    const newItem: CanvasItem = {
        uuid: Date.now().toString(),
        id: item.id,
        image_url: item.image_url,
        x: centerX,
        y: centerY,
        width: 150,
        height: 150,
        scale: 1,
        rotate: 0,
        zIndex: canvasItems.value.length + 1
    };
    canvasItems.value.push(newItem);
    activeUuid.value = newItem.uuid;
};
const expandPanel = () => { isPanelExpanded.value = true; };
const collapsePanel = () => {
    if (isDragging || isTransforming) return;
    isPanelExpanded.value = false;
    activeUuid.value = '';
};
const deleteItem = (index: any) => { canvasItems.value.splice(Number(index), 1); activeUuid.value = ''; };

// --- 触摸拖拽逻辑 (移动) ---
const onTouchStart = (item: CanvasItem, event: any) => {
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

    updateZIndex(item);
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
    if (item.locked) return;
    if (event.touches.length !== 1) return;

    isTransforming = true;
    isDragging = false;
    currentItem = item;

    const touch = event.touches[0];

    centerX = canvasOffset.value.left + item.x;
    centerY = canvasOffset.value.top + item.y;

    const vecX = touch.clientX - centerX;
    const vecY = touch.clientY - centerY;

    initialRotate = Math.atan2(vecY, vecX) * (180 / Math.PI) - item.rotate;
    const dist = Math.sqrt(vecX * vecX + vecY * vecY);

    initialScale = item.scale / dist;
};

const onHandleMove = (event: any) => {
    if (!isTransforming || !currentItem) return;

    event.preventDefault && event.preventDefault();
    event.stopPropagation && event.stopPropagation();

    const touch = event.touches[0];
    const vecX = touch.clientX - centerX;
    const vecY = touch.clientY - centerY;

    // 计算旋转
    const angle = Math.atan2(vecY, vecX) * (180 / Math.PI);
    currentItem.rotate = angle - initialRotate;

    // 计算缩放
    const dist = Math.sqrt(vecX * vecY + vecY * vecY);
    let newScale = dist * initialScale;

    // 限制缩放范围
    if (newScale < 0.2) newScale = 0.2;
    if (newScale > 5) newScale = 5;

    currentItem.scale = newScale;
};

const onHandleEnd = () => {
    isTransforming = false;
    currentItem = null;
};

const updateZIndex = (item: CanvasItem) => {
    if (item.locked) return;
    const maxZ = Math.max(...canvasItems.value.map(i => i.zIndex));
    if (item.zIndex < maxZ) {
        item.zIndex = maxZ + 1;
    }
};

const flipItem = (item: CanvasItem) => {
    item.isFlipped = !item.isFlipped;
};

const lockItem = (item: CanvasItem) => {
    item.locked = true;
    activeUuid.value = ''; // 锁定后取消选中，防止误触
};

const unlockItem = (item: CanvasItem) => {
    item.locked = false;
    activeUuid.value = item.uuid; // 解锁后自动选中
};

const toggleSaveTag = (type: 'season' | 'scene', id: number) => {
    const list = type === 'season' ? form.value.season_ids : form.value.scene_ids;
    const index = list.indexOf(id);
    if (index > -1) {
        list.splice(index, 1); // 移除
    } else {
        list.push(id); // 添加
    }
};

const handleAddSceneTag = () => {
    uni.showModal({
        title: '新增场景标签',
        editable: true,
        placeholderText: '请输入标签名称',
        success: async (res) => {
            if (res.confirm && res.content) {
                try {
                    const addRes = await addTag({ names: res.content, type: 'SCENE' }) as any;
                    if (addRes.code === 200) {
                        uni.showToast({ title: '添加成功', icon: 'none' });
                        loadScenes(); // 刷新标签列表
                    } else {
                        uni.showToast({ title: addRes.msg || '添加失败', icon: 'none' });
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
    });
};

const showClothingSelect = () => {
    expandPanel();
};

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

    .delete-outfit-btn {
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

    .save-btn {
        padding: 6px 16px;
        background: #07c160;
        color: #fff;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;

        &:active {
            opacity: 0.8;
        }
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

        &.active {
            border: 1px dashed #07c160;

            .controls {
                display: block; // 激活时显示控件
            }
        }

        .item-img {
            width: 100%;
            height: 100%;
            pointer-events: none; // 图片本身不响应事件，由父容器响应
        }
    }
}

.controls {
    display: none; // 默认隐藏
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    pointer-events: none; // 让点击穿透到内容，除了按钮

    .ctrl-btn {
        position: absolute;
        width: 24px;
        height: 24px;
        background: #07c160;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto; // 按钮需要响应
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        z-index: 10;

        /* 增加触摸区域 */
        &::after {
            content: '';
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
        }
    }

    .delete-btn {
        top: -12px;
        left: -12px;
        background: #ee0a24;
    }

    .flip-btn {
        top: -12px;
        right: -12px;
        background: #1989fa;
    }

    .lock-btn {
        bottom: -12px;
        left: -12px;
        background: #ff976a;
    }

    .transform-handle {
        bottom: -12px;
        right: -12px;
        background: #07c160;
    }
}

.locked-controls {
    display: block !important;
    border: 1px solid transparent; // 占位

    .unlock-btn {
        position: absolute;
        top: -12px;
        right: -12px;
        width: 24px;
        height: 24px;
        background: white;
        border: 1px solid #f44;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    }
}

.bottom-panel {
    /* height: 40vh; 由 height 动画控制 */
    background: #fff;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
    /* 改为高度过渡，实现挤压式布局，而非覆盖 */
    transition: height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    height: calc(54px + env(safe-area-inset-bottom));
    /* 默认只露出一行 */
    display: flex;
    flex-direction: column;
    z-index: 200;

    &.expanded {
        height: 60vh;
        /* 展开高度 */
    }
}

.category-tabs {
    height: 54px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    border-bottom: 1px solid #eee;
    padding: 0 12px;

    .tabs-scroll {
        flex: 1;
        white-space: nowrap;
        margin-right: 8px;

        .tab-item {
            display: inline-block;
            padding: 6px 14px;
            margin-right: 8px;
            background: #f5f6f7;
            border-radius: 16px;
            font-size: 13px;
            color: #666;

            &.active {
                background: #e8f5e9;
                color: #07c160;
                font-weight: 500;
            }
        }
    }

    .filter-icon {
        padding: 8px;
        color: #666;
    }
}

.clothes-scroll {
    flex: 1;
    height: 0; // 这里的height=0是为了配合flex:1生效
    padding: 12px;
    box-sizing: border-box;

    .clothes-list {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
    }

    .clothes-card {
        aspect-ratio: 1;
        background: #f9f9f9;
        border-radius: 8px;
        overflow: hidden;

        .c-img {
            width: 100%;
            height: 100%;
        }

        &:active {
            opacity: 0.7;
        }
    }
}

.add-btn {
    position: fixed;
    right: 20px;
    bottom: calc(60vh + 20px); // 位于面板上方，对应展开状态
    width: 48px;
    height: 48px;
    z-index: 150;
    transition: bottom 0.3s;
    /* 面板收起时沉底，展开时跟随 */

    &.btn-collapsed {
        bottom: calc(54px + env(safe-area-inset-bottom) + 20px);
    }
}

/* 弹窗样式补全 */
.save-popup {
    padding: 24px 16px;
    padding-bottom: env(safe-area-inset-bottom);

    .popup-title {
        font-size: 18px;
        font-weight: 600;
        text-align: center;
        margin-bottom: 20px;
    }

    .tags-section {
        margin-top: 16px;

        .section-title {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
        }

        .tags-wrapper {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;

            .tag-touch-area {
                /* 增加点击区域 */
                padding: 4px;
                margin: -4px;
            }

            .my-tag {
                padding: 4px 12px;
            }

            .add-tag-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 24px; // 与 tag 高度近似
                border: 1px dashed #ccc;
                border-radius: 4px;
                margin-left: 4px;
            }
        }

        .selectors-row {
            display: flex;
            gap: 12px;

            .picker-item {
                flex: 1;
            }

            .picker-display {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                background: #f7f8fa;
                border-radius: 8px;
                border: 1px solid #ebedf0;

                .label {
                    font-size: 14px;
                    color: #333;
                }

                .value {
                    flex: 1;
                    text-align: right;
                    margin: 0 8px;
                    font-size: 14px;
                    color: #666;
                }
            }
        }
    }

    .btn-area {
        margin-top: 30px;
    }
}

// 筛选弹窗内部
.filter-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;

    .filter-title {
        height: 44px;
        line-height: 44px;
        text-align: center;
        font-size: 16px;
        font-weight: 500;
        border-bottom: 1px solid #eee;
        padding-top: var(--status-bar-height);
    }

    .filter-content {
        flex: 1;
        padding: 16px;

        .filter-section {
            margin-bottom: 24px;

            .section-header {
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 12px;
            }

            .tags-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;

                .filter-tag {
                    padding: 6px 16px;
                    background: #f5f6f7;
                    border-radius: 16px;
                    font-size: 12px;
                    color: #333;

                    &.active {
                        background: #e8f5e9;
                        color: #07c160;
                        font-weight: 500;
                    }
                }
            }

            .colors-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 12px;

                .color-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;

                    .color-circle {
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: 1px solid transparent;
                    }

                    .color-name {
                        font-size: 10px;
                        color: #666;
                    }

                    &.active .color-circle {
                        transform: scale(1.2);
                        box-shadow: 0 0 0 2px #07c160;
                    }
                }
            }
        }
    }

    .filter-actions {
        padding: 16px;
        padding-bottom: calc(16px + env(safe-area-inset-bottom));
        display: flex;
        gap: 12px;
        border-top: 1px solid #eee;

        .action-btn {
            flex: 1;
        }
    }
}

.selectors-row {
    display: flex;
    gap: 12px;
    margin-top: 10px;

    .picker-item {
        flex: 1;
    }

    .picker-display {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: #f5f6f7;
        border-radius: 4px;
        font-size: 14px;
        color: #333;

        .label {
            color: #666;
        }

        .value {
            color: #333;
        }
    }
}
</style>
