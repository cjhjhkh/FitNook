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
                            <view class="item-content">
                                <view class="icon-box" :style="{ backgroundColor: s.backgroundColor }">
                                    <van-icon :name="s.icon" size="14px" class="s-icon" />
                                </view>
                                <text v-if="activeSeason === s.name" class="s-text">{{ s.name }}</text>
                            </view>
                        </view>
                    </view>
                </scroll-view>

                <view class="layout-toggle" @tap="toggleLayout">
                    <van-icon :name="isGridLayout ? 'apps-o' : 'orders-o'" size="22px" color="#666" />
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
                <text v-if="!isSelectMode" class="status-tag">{{ activeSeason }}衣物</text>
            </view>
            <view class="right-tools" @tap="toggleSelectMode">
                <view class="select-trigger" :class="{ editing: isSelectMode }">
                    {{ isSelectMode ? '取消' : '选择' }}
                </view>
            </view>
        </view>

        <scroll-view class="main-list" scroll-y>
            <view v-for="group in clothGroups" :key="group.category" class="group-section">
                <view class="group-title">
                    {{ group.category }} <text class="num">{{ group.list.length }}</text>
                </view>

                <view v-if="isGridLayout" class="grid-container transition-fade">
                    <view v-for="item in group.list" :key="item.id" class="cloth-card-grid">
                        <view class="img-wrapper">
                            <image :src="item.image" mode="aspectFill" class="cloth-img" />

                            <!-- 选择模式下的半透明蒙板，点击切换选中 -->
                            <view v-if="isSelectMode" class="select-mask" @tap.stop="() => toggleSelectByTap(item.id)">
                                <!-- 右上角显示圆形选中图标 -->
                                <view class="select-icon" :class="{ checked: selectedIds.includes(item.id) }" @tap.stop="() => toggleSelectByTap(item.id)">
                                    <van-icon v-if="selectedIds.includes(item.id)" name="success" color="#fff" size="18px" />
                                </view>
                            </view>

                            <view v-if="isSelectMode" class="check-overlay">
                                <van-checkbox :name="item.id" icon-size="16px" shape="round"
                                    :checked="selectedIds.includes(item.id)"
                                    @change="bindSelectHandler(item.id)" />
                            </view>
                        </view>
                        <view class="tag-row">
                            <view v-for="tag in item.tags" :key="tag.name" class="mini-tag"
                                :style="{ backgroundColor: tag.color }">{{ tag.name }}</view>
                        </view>
                    </view>
                </view>

                <view v-else class="list-container transition-fade">
                    <view v-for="item in group.list" :key="item.id" class="cloth-card-list">
                        <view class="list-img-box">
                            <image :src="item.image" mode="aspectFill" class="cloth-img-l" />

                            <!-- 列表布局也加入选择蒙板 -->
                            <view v-if="isSelectMode" class="select-mask" @tap.stop="() => toggleSelectByTap(item.id)">
                                <view class="select-icon" :class="{ checked: selectedIds.includes(item.id) }" @tap.stop="() => toggleSelectByTap(item.id)">
                                    <van-icon v-if="selectedIds.includes(item.id)" name="success" color="#fff" size="18px" />
                                </view>
                            </view>

                            <view v-if="isSelectMode" class="check-overlay-l">
                                <van-checkbox :name="item.id" icon-size="18px"
                                    :checked="selectedIds.includes(item.id)"
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

        <van-action-sheet :show="showAddPopup" @close="showAddPopup = false" @cancel="showAddPopup = false" :actions="addActions" cancel-text="取消" @select="onAddSelect"
            round />

        <!-- 批量添加标签弹窗（居中卡片样式） -->
        <van-popup v-model:show="showTagPopup" @close="showTagPopup = false"  position="center" overlay-class="tag-overlay" style="display: flex;justify-content: center;position: relative; bottom: 35vh;">
            <view class="tag-popup-card" v-show="showTagPopup">
                <view class="card-inner">
                    <view class="card-title">
                        <text>批量添加标签</text>
                        <text class="close-btn" @tap="showTagPopup = false">取消</text>
                    </view>

                    <view class="card-section">
                        <text class="card-section-title">季节</text>
                        <view class="options-row">
                            <view v-for="s in seasonOptions" :key="s.id" class="opt-item" :class="{ active: selectedSeasonIds.includes(s.id) }" @tap="() => toggleSelectOption('season', s.id)">{{ s.name }}</view>
                        </view>
                    </view>

                    <view class="card-section">
                        <text class="card-section-title">种类</text>
                        <view class="options-row">
                            <view v-for="c in categoryOptions" :key="c.id" class="opt-item" :class="{ active: selectedCategoryIds.includes(c.id) }" @tap="() => toggleSelectOption('category', c.id)">{{ c.name }}</view>
                        </view>
                    </view>

                    <view class="card-section">
                        <text class="card-section-title">场景</text>
                        <view class="options-row">
                            <view v-for="sc in sceneOptions" :key="sc.id" class="opt-item" :class="{ active: selectedSceneIds.includes(sc.id) }" @tap="() => toggleSelectOption('scene', sc.id)">{{ sc.name }}</view>
                        </view>
                    </view>

                    <view class="card-actions">
                        <view class="btn reset" @tap="resetTagSelection">重置</view>
                        <view class="btn confirm" @tap="submitBatchAddTags">确定</view>
                    </view>
                </view>
            </view>
        </van-popup>
    
        <!-- <van-popup v-model:show="showTagPopup" position="center" round></van-popup> -->
    </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// --- 接口定义 ---
interface Tag {
    name: string;
    color: string;
}

interface ClothingItem {
    id: number;
    image: string;
    category: string;
    price: number;
    times: number;
    date: string;
    tags: Tag[];
    costPerTime: number;
}

interface ClothGroup {
    category: string;
    list: ClothingItem[];
}

// --- 响应式数据 ---
const searchKeyword = ref('');
const seasons = [
    { name: '全部', icon: 'apps-o', backgroundColor: '#D3CBC5' },
    { name: '春', icon: 'flower-o', backgroundColor: '#E4DAD1' },
    { name: '夏', icon: 'fire-o', backgroundColor: '#F2E8CF' },
    { name: '秋', icon: 'fire-o', backgroundColor: '#D8C3A5' },
    { name: '冬', icon: 'points', backgroundColor: '#A4B3B6' }
];
const activeSeason = ref('全部');
const isGridLayout = ref(true);
const isSelectMode = ref(false);
const selectedIds = ref<number[]>([]);
const showFilter = ref(false);
const showAddPopup = ref(false);
// 新增：控制标签弹窗显示
const showTagPopup = ref(false);
const clothingList = ref<ClothingItem[]>([]);

// 新增：标签弹窗相关数据
const selectedSeasonIds = ref<number[]>([]);
const selectedCategoryIds = ref<number[]>([]);
const selectedSceneIds = ref<number[]>([]);

// 选项数据（初始为空，从后端获取）
const seasonOptions = ref<{id: number, name: string}[]>([]);
const categoryOptions = ref<{id: number, name: string}[]>([]);
const sceneOptions = ref<{id: number, name: string}[]>([]);

// 接口地址 (根据你的后端配置调整)
const API_BASE_URL = 'http://localhost:3000';

// 数据分组计算属性
const clothGroups = computed(() => {
    const groups: Record<string, ClothingItem[]> = {};
    clothingList.value.forEach((item: ClothingItem) => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
    });
    return Object.keys(groups).map(key => ({
        category: key,
        list: groups[key]
    }));
});

// --- 生命周期 ---
onMounted(() => {
    loadClothesList();
    fetchTagOptions();
});

// --- 核心逻辑：添加衣物 ---

const addActions = [
    { name: '拍照', value: 'camera' },
    { name: '从相册导入', value: 'album' }
];

/**
 * 1. 处理上传选择
 */
const onAddSelect = (action: any) => {
    showAddPopup.value = false;

    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 压缩图片提升上传速度 
        sourceType: [action.value],
        success: (res: any) => {
            const tempFilePath = res.tempFilePaths[0];
            // 调用上传存储接口
            uploadClothing(tempFilePath);
        },
        fail: (err: any) => {
            console.log('选择图片失败', err);
        }
    });
};

/**
 * 2. 调用 add 接口进行存储
 * 实现开题报告中 5.2.3.2 上传衣物的功能 
 */
const uploadClothing = (filePath: string) => {
  console.log("1. 进入 uploadClothing 函数");
  console.log("2. 传入的路径为:", filePath);
  if (!filePath) {
    console.error("错误：filePath 为空，无法上传");
    return;
  }

  const userInfo = uni.getStorageSync('userInfo');
  const account = userInfo?.account;
  console.log("3. 获取到的 account 为:", account);

  if (!account) {
    uni.showToast({ title: '未检测到登录，请先登录', icon: 'none' });
    return;
  }

  // 辅助：先尝试按文件大小自适应设置压缩质量并压缩图片，失败时回退为原图
  const compressImageIfNeeded = (path: string): Promise<string> => {
    return new Promise((resolve) => {
      // 默认质量
      let quality = 70;

      // 如果能获取文件信息，根据大小调整质量
      if (uni.getFileInfo) {
        uni.getFileInfo({
          filePath: path,
          success: (info: any) => {
            const sizeKB = (info.size || 0) / 1024;
            if (sizeKB > 2000) {
              quality = 50; // >2MB 降到 50
            } else if (sizeKB > 0) {
              quality = 60; // 1-2MB -> 60
            } else if (sizeKB > 500) {
              quality = 70; // 0.5-1MB -> 70
            } else {
              quality = 80; // 小文件保留较高质量
            }

            uni.compressImage({
              src: path,
              quality,
              success: (res: any) => {
                console.log('图片压缩成功，quality=', quality, ' path=', res.tempFilePath);
                resolve(res.tempFilePath || path);
              },
              fail: (err: any) => {
                console.warn('图片压缩失败，使用原图上传', err);
                resolve(path);
              }
            });
          },
          fail: () => {
            // 无法获取文件大小，使用默认质量压缩一次
            uni.compressImage({
              src: path,
              quality,
              success: (res: any) => {
                console.log('图片压缩成功 (无文件信息)', res.tempFilePath);
                resolve(res.tempFilePath || path);
              },
              fail: (err: any) => {
                console.warn('图片压缩失败 (无文件信息)，使用原图上传', err);
                resolve(path);
              }
            });
          }
        });
      } else {
        // 平台不支持 getFileInfo，直接压缩一次
        uni.compressImage({
          src: path,
          quality,
          success: (res: any) => {
            console.log('图片压缩成功 (fallback)', res.tempFilePath);
            resolve(res.tempFilePath || path);
          },
          fail: (err: any) => {
            console.warn('图片压缩失败 (fallback)，使用原图上传',err);
            resolve(path);
          }
        });
      }
    });
  };

  uni.showLoading({ title: '正在录入衣橱...', mask: true });

  // 先压缩再上传
  compressImageIfNeeded(filePath).then((uploadPath) => {
    console.log('最终用于上传的图片路径：', uploadPath);

    const uploadTask = uni.uploadFile({
      url: `${API_BASE_URL}/api/clothes/add`,
      filePath: uploadPath,
      name: 'image', // 与后端 upload.single('image') 对应
      formData: {
        account: account,
        category_id: '1',
        price: '0',
        season_ids: '', // 可按需传
        scene_ids: '',
        remarks: '-'
      },
      success: (uploadRes: any) => {
        console.log('服务器原始响应:', uploadRes);
        let res;
        try {
          res = JSON.parse(uploadRes.data);
        } catch (e) {
          console.error('后端返回非 JSON：', uploadRes.data);
          uni.showToast({ title: '服务器返回异常', icon: 'none' });
          return;
        }
        if (res.code === 200) {
          uni.showToast({ title: '添加成功', icon: 'success' });
          loadClothesList && loadClothesList();
        } else {
          console.error('后端返回业务错误:', res);
          uni.showToast({ title: '添加失败：' + (res.msg || res.error || '未知错误'), icon: 'none' });
        }
      },
      fail: (err: any) => {
        console.error('upload fail', err);
        uni.showToast({ title: '网络或上传失败', icon: 'none' });
      },
      complete: () => {
        console.log('请求 complete');
        uni.hideLoading();
      }
    });

    uploadTask.onProgressUpdate((res: any) => {
      console.log('上传进度：' + res.progress + '%', res);
    });

    // 可选：如果需要支持取消上传，保存 uploadTask 并在需要时调用 uploadTask.abort()
  });
};

/**
 * 3. 获取衣物列表
 */
const loadClothesList = () => {
    const userInfo = uni.getStorageSync('userInfo') || {};
    const account = userInfo.account;
    if (!account) {
        uni.showToast({ title: '未检测到登录，无法获取衣物列表', icon: 'none' });
        // 仍然使用 mock 数据以便预览
        mockData();
        return;
    }

    // 构建查询参数：后端要求 account 必填，其它按需传入（category_id/scene_id/season_id）
    const params: any = {
        account: account
    };

    // 注意：当前 UI 季节是名字（如“春”），后端期望 season_id（数字）。
    // 若你有季节的 id 映射表，请在此处传入 season_id。
    // 示例：params.season_id = selectedSeasonId;

    uni.request({
        url: `${API_BASE_URL}/api/clothes/list`,
        method: 'GET',
        data: params,
        success: (res: any) => {
            // 兼容后端返回 { code: 200, data: [...] }
            if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
                const rows = res.data.data;
                // 将后端字段映射为前端 ClothingItem 结构
                clothingList.value = rows.map((r: any) => {
                    // 取图片字段，兼容 image_url 或 image
                    const image = r.image_url || r.image || '';
                    const category = r.category_name || r.category || '其他';
                    const price = parseFloat(r.price) || 0;
                    const date = r.created_at ? formatDate(r.created_at) : (r.date || '');

                    // 构建 tags：优先使用后端直接提供的 tags（数组或逗号分隔字符串），
                    // 同时把 category、scene、season 合并为标签展示，支持多种字段名
                    const tagColorDefault = '#D3CBC5';
                    const tagColorCategory = '#A4C2F4';

                    const pushTag = (arr: any[], name: string | undefined, color?: string) => {
                        if (!name) return;
                        const trimmed = String(name).trim();
                        if (!trimmed) return;
                        // 去重判断
                        if (!arr.find((t: any) => t.name === trimmed)) {
                            arr.push({ name: trimmed, color: color || tagColorDefault });
                        }
                    };

                    const tagsArr: Tag[] = [];

                    // 后端直接返回的 tags 字段处理
                    if (r.tags) {
                        if (Array.isArray(r.tags)) {
                            r.tags.forEach((t: any) => {
                                if (typeof t === 'string') pushTag(tagsArr, t);
                                else if (t && t.name) pushTag(tagsArr, t.name, t.color);
                            });
                        } else if (typeof r.tags === 'string') {
                            r.tags.split(',').forEach((t: string) => pushTag(tagsArr, t));
                        }
                    }

                    // 把分类作为第一个标签（如果未被包含）
                    pushTag(tagsArr, category, tagColorCategory);

                    // 支持多种可能的后端字段名来获取场景与季节信息
                    const sceneFields = ['scene_name', 'scene_names', 'scenes', 'scene'];
                    for (const f of sceneFields) {
                        if (r[f]) {
                            if (Array.isArray(r[f])) r[f].forEach((s: any) => pushTag(tagsArr, s));
                            else if (typeof r[f] === 'string') r[f].split(',').forEach((s: string) => pushTag(tagsArr, s));
                        }
                    }

                    const seasonFields = ['season_name', 'season_names', 'seasons', 'season'];
                    for (const f of seasonFields) {
                        if (r[f]) {
                            if (Array.isArray(r[f])) r[f].forEach((s: any) => pushTag(tagsArr, s));
                            else if (typeof r[f] === 'string') r[f].split(',').forEach((s: string) => pushTag(tagsArr, s));
                        }
                    }

                    return {
                        id: r.id,
                        image,
                        category,
                        price,
                        times: r.times || 0,
                        date,
                        tags: tagsArr,
                        costPerTime: r.costPerTime || 0
                    } as ClothingItem;
                }).map((it: any) => ({ ...it, id: Number(it.id) })) as ClothingItem[];
            } else {
                // 后端返回异常，使用 mock 数据
                console.warn('获取衣物列表返回格式异常：', res);
                mockData();
            }
        },
        fail: (err: any) => {
            console.error('请求衣物列表失败', err);
            mockData();
        }
    });
};

// --- UI 交互逻辑 ---
const handleSeasonChange = (name: string) => {
    activeSeason.value = name;
    loadClothesList();
};

const toggleLayout = () => {
    isGridLayout.value = !isGridLayout.value;
};

const toggleSelectMode = () => {
    isSelectMode.value = !isSelectMode.value;
    if (!isSelectMode.value) selectedIds.value = [];
};

// 切换单项选中状态（保证 id 为数字）
const onToggleSelect = (idParam: number | string, checked: boolean) => {
    const id = Number(idParam);
    if (Number.isNaN(id)) return;
    const idx = selectedIds.value.indexOf(id);
    if (checked) {
        if (idx === -1) selectedIds.value.push(id);
    } else {
        if (idx !== -1) selectedIds.value.splice(idx, 1);
    }
};

// 点击覆盖层切换选中状态（更友好的交互）
const toggleSelectByTap = (idParam: number | string) => {
    const id = Number(idParam);
    if (Number.isNaN(id)) return;
    const isSelected = selectedIds.value.includes(id);
    onToggleSelect(id, !isSelected);
};

// 返回一个绑定事件处理器的工厂，避免模板中出现隐式 any 的箭头函数
const bindSelectHandler = (idParam: number | string) => {
    return (eventOrValue: any) => {
        // 兼容多种组件事件/回调签名
        let checked = false as boolean;
        if (typeof eventOrValue === 'boolean') {
            checked = eventOrValue;
        } else if (eventOrValue && typeof eventOrValue === 'object') {
            const d = eventOrValue.detail;
            if (typeof d === 'boolean') checked = d;
            else if (d && typeof d.checked === 'boolean') checked = d.checked;
            else if (d && typeof d.value === 'boolean') checked = d.value;
            else if (Array.isArray(d)) checked = d.includes(idParam);
            else checked = !selectedIds.value.includes(Number(idParam));
        } else {
            checked = !selectedIds.value.includes(Number(idParam));
        }

        onToggleSelect(idParam, !!checked);
    };
};

// 批量删除已选项
const batchDeleteSelected = () => {
    if (!selectedIds.value || selectedIds.value.length === 0) {
        uni.showToast({ title: '请先选择要删除的衣物', icon: 'none' });
        return;
    }

    uni.showModal({
        title: '确认删除',
        content: `确定要删除 ${selectedIds.value.length} 件衣物吗？此操作不可恢复。`,
        success: (res: any) => {
            if (res.confirm) {
                uni.showLoading({ title: '正在删除...', mask: true });
                uni.request({
                    url: `${API_BASE_URL}/api/clothes/batch-delete`,
                    method: 'POST',
                    header: { 'content-type': 'application/json' },
                    data: { ids: selectedIds.value },
                    success: (resp: any) => {
                        if (resp.data && resp.data.code === 200) {
                            uni.showToast({ title: '删除成功', icon: 'success' });
                            // 刷新列表并清空选中
                            selectedIds.value = [];
                            isSelectMode.value = false;
                            loadClothesList();
                        } else {
                            console.error('批量删除失败：', resp);
                            uni.showToast({ title: '删除失败：' + (resp.data?.msg || '未知错误'), icon: 'none' });
                        }
                    },
                    fail: (err: any) => {
                        console.error('请求失败：', err);
                        uni.showToast({ title: '网络或服务异常，删除失败', icon: 'none' });
                    },
                    complete: () => {
                        uni.hideLoading();
                    }
                });
            }
        }
    });
};

// 打开批量添加标签弹窗
const openTagPopup = () => {
    if (selectedIds.value.length === 0) {
        uni.showToast({ title: '请先选择衣物', icon: 'none' });
        return;
    }
    resetTagSelection();
    showTagPopup.value = true;
};

// 切换标签选项选中状态
const toggleSelectOption = (type: 'season' | 'category' | 'scene', id: number) => {
    let target: any;
    if (type === 'season') target = selectedSeasonIds;
    else if (type === 'category') target = selectedCategoryIds;
    else if (type === 'scene') target = selectedSceneIds;
    
    if (!target) return;
    
    const idx = target.value.indexOf(id);
    if (idx > -1) {
        target.value.splice(idx, 1);
    } else {
        target.value.push(id);
    }
};

// 获取标签选项数据
const fetchTagOptions = () => {
    // 获取季节
    uni.request({
        url: `${API_BASE_URL}/api/clothes/seasons`,
        method: 'GET',
        success: (res: any) => {
            if (res.data && res.data.code === 200) {
                seasonOptions.value = res.data.data;
            }
        }
    });
    // 获取种类
    uni.request({
        url: `${API_BASE_URL}/api/clothes/categories`,
        method: 'GET',
        success: (res: any) => {
            if (res.data && res.data.code === 200) {
                categoryOptions.value = res.data.data;
            }
        }
    });
    // 获取场景
    uni.request({
        url: `${API_BASE_URL}/api/clothes/scenes`,
        method: 'GET',
        success: (res: any) => {
            if (res.data && res.data.code === 200) {
                sceneOptions.value = res.data.data;
            }
        }
    });
};

// 模拟数据（用于接口未通时的预览）
const mockData = () => {
    clothingList.value = [
        {
            id: 1,
            image: 'https://img.alicdn.com/imgextra/i4/2206615431331/O1CN01f5v7p41ZzN3Z3X7Z3_!!2206615431331.jpg',
            category: '上衣',
            price: 299,
            times: 12,
            date: '2025-12-20',
            tags: [{ name: '职场', color: '#A4C2F4' }, { name: '羊毛', color: '#D3CBC5' }],
            costPerTime: 24.9
        }
    ];
};

// 辅助：将 ISO 字符串或时间戳格式化为 YYYY-MM-DD
const formatDate = (raw: string | number) => {
    try {
        const d = new Date(raw);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch (e) {
        return String(raw);
    }
};

const submitBatchAddTags = () => {
    // 校验：根据接口要求，scene_ids、season_ids、category_ids 至少需要传一个
    const hasSeason = selectedSeasonIds.value && selectedSeasonIds.value.length > 0;
    const hasScene = selectedSceneIds.value && selectedSceneIds.value.length > 0;
    const hasCategory = selectedCategoryIds.value && selectedCategoryIds.value.length > 0;
    
    if (!hasSeason && !hasScene && !hasCategory) {
        uni.showToast({ title: '请至少选择一种标签', icon: 'none' });
        return;
    }

    const body: any = { ids: selectedIds.value };
    if (hasScene) body.scene_ids = selectedSceneIds.value;
    if (hasSeason) body.season_ids = selectedSeasonIds.value;
    // 支持传入 category_ids
    if (hasCategory) body.category_ids = selectedCategoryIds.value;

    uni.showLoading({ title: '正在添加标签...', mask: true });
    uni.request({
        url: `${API_BASE_URL}/api/clothes/batch-add-tags`,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: body,
        success: (res: any) => {
            if (res.data && res.data.code === 200) {
                uni.showToast({ title: '标签添加成功', icon: 'success' });
                showTagPopup.value = false;
                // 清空选中并退出选择模式
                selectedIds.value = [];
                isSelectMode.value = false;
                // 刷新列表
                loadClothesList();
            } else {
                console.error('批量添加标签失败：', res);
                uni.showToast({ title: '添加失败：' + (res.data?.msg || '未知错误'), icon: 'none' });
            }
        },
        fail: (err: any) => {
            console.error('请求失败：', err);
            uni.showToast({ title: '网络或服务异常，添加失败', icon: 'none' });
        },
        complete: () => {
            uni.hideLoading();
        }
    });
};

// 重置弹窗中已选的标签（不关闭弹窗）
const resetTagSelection = () => {
    selectedSeasonIds.value = [];
    selectedSceneIds.value = [];
    selectedCategoryIds.value = [];
};
</script>

<style lang="scss" scoped>
$bg: #F8F9FA;
$morandi-blue: #A4C2F4;
$text-main: #333;
$text-grey: #999;
$shadow: 0 4px 12rpx rgba(0, 0, 0, 0.05);

.wardrobe-page {
    background-color: $bg;
    min-height: 100vh;
    padding: 0 24rpx;

    .sticky-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: $bg;
        padding: 12rpx 0 20rpx; // 顶部增加一点呼吸感

        .top-tool-row {
            display: flex;
            align-items: center;
            gap: 20rpx; // 增加间距

            .search-box {
                flex: 1;
                min-width: 0;

                .custom-search {
                    padding: 0;
                    font-size: 28rpx;

                    :deep(.van-search__content) {
                        background-color: #fff;
                        box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); // 更细腻的阴影
                        height: 76rpx; // 再次微调高度
                        display: flex;
                        align-items: center;
                        border-radius: 38rpx;
                        padding-left: 16rpx;
                    }

                    :deep(.van-search) {
                        padding: 0;
                    }
                    
                    // 调整输入框内部样式
                    :deep(.van-field__input) {
                        font-size: 26rpx;
                        color: #333;
                    }
                }
            }

            .season-scroll {
                width: 240rpx; // 调整宽度
                flex-shrink: 0;

                // 隐藏滚动条
                &::-webkit-scrollbar {
                    display: none;
                    width: 0 !important;
                    height: 0 !important;
                    -webkit-appearance: none;
                    background: transparent;
                }

                .season-wrap {
                    display: flex;
                    align-items: center;
                    padding: 4rpx 0;

                    .season-item {
                        flex-shrink: 0;
                        margin-right: 12rpx;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

                        .item-content {
                            display: flex;
                            align-items: center;
                            padding: 6rpx;
                            border-radius: 32rpx;
                            transition: all 0.3s;
                            border: 1px solid transparent; // 预留边框位防止抖动
                        }

                        .icon-box {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 56rpx;
                            height: 56rpx;
                            border-radius: 50%;
                            // background-color 由内联样式控制
                        }

                        .s-text {
                            font-size: 0;
                            width: 0;
                            opacity: 0;
                            margin-left: 0;
                            overflow: hidden;
                            transition: all 0.3s ease;
                            white-space: nowrap;
                        }

                        &.active {
                            .item-content {
                                background: #fff;
                                padding-right: 24rpx; // 增加右侧内边距
                                box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
                            }

                            .s-text {
                                font-size: 24rpx; // 稍微加大选中文字
                                width: auto;
                                opacity: 1;
                                margin-left: 10rpx;
                                font-weight: 600;
                                color: #333;
                            }
                        }
                    }
                }
            }

            .layout-toggle {
                flex-shrink: 0;
                width: 76rpx; // 与搜索框高度一致
                height: 76rpx;
                background: #fff;
                border-radius: 50%;
                box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
                
                &:active {
                    transform: scale(0.95);
                }
            }
        }
    }

    .filter-action-bar {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10rpx 0 30rpx; // 调整垂直间距
        height: 88rpx;

        .left-tools {
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            background: #fff;
            padding: 14rpx 28rpx; // 加大点击区域
            border-radius: 40rpx;
            box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.03);
            font-size: 26rpx;
            font-weight: 500;
            color: #333;

            .filter-text {
                margin-left: 10rpx;
            }

            .filter-dot {
                width: 10rpx;
                height: 10rpx;
                background: $morandi-blue;
                border-radius: 50%;
                margin-left: 8rpx;
            }
        }

        .center-status {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
            pointer-events: none; // 防止遮挡点击

            .status-tag {
                font-size: 22rpx;
                color: #bbb;
                letter-spacing: 2rpx;
                background: rgba(255,255,255,0.6); // 增加一点背景防止文字重叠
                padding: 4rpx 12rpx;
                border-radius: 8rpx;
            }
        }

        .right-tools {
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            
            .select-trigger {
                font-size: 26rpx;
                font-weight: 500;
                color: #333;
                padding: 14rpx 32rpx;
                border-radius: 40rpx;
                background: #fff;
                box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.03);
                transition: all 0.3s;

                &.editing {
                    background: #222;
                    color: #fff;
                    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.15);
                }
            }
        }
    }

    .group-section {
        margin-bottom: 30rpx;

        .group-title {
            font-size: 28rpx;
            font-weight: bold;
            margin: 20rpx 0;
            display: flex;
            align-items: center;

            .num {
                font-size: 20rpx;
                color: #fff;
                background: #D1D1D1;
                padding: 2rpx 14rpx;
                border-radius: 20rpx;
                margin-left: 12rpx;
            }
        }
    }

    .grid-container {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20rpx;

        .cloth-card-grid {
            background: #fff;
            border-radius: 24rpx; // 更大的圆角
            padding: 16rpx; // 增加内边距
            box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); // 更柔和的阴影
            display: flex;
            flex-direction: column;
            transition: all 0.3s;

            .img-wrapper {
                position: relative;
                width: 100%;
                // 使用 padding-bottom hack 实现 1:1 正方形图片区域
                padding-bottom: 100%; 
                height: 0;
                border-radius: 20rpx; // 图片圆角跟随卡片
                overflow: hidden;
                background-color: #f7f8fa; // 图片加载前的占位色

                .cloth-img {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    // 确保图片填充
                }

                .check-overlay {
                    position: absolute;
                    top: 8rpx;
                    right: 8rpx;
                    z-index: 2;
                }

                // 优化选中遮罩样式
                .select-mask {
                    position: absolute;
                    left: 0;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.05); // 更淡的遮罩
                    z-index: 1;
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-end;
                    padding: 8rpx;
                    border-radius: 16rpx;
                }

                .select-icon {
                    width: 44rpx;
                    height: 44rpx;
                    border-radius: 50%;
                    border: 2rpx solid rgba(255,255,255,0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.1);
                }

                .select-icon.checked {
                    background: rgba(164,194,244,0.95);
                    border-color: rgba(164,194,244,0.95);
                }
            }

            .tag-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8rpx;
                margin-top: 16rpx;
                min-height: 32rpx; // 保持最小高度防止抖动

                .mini-tag {
                    font-size: 22rpx; // 增大字号提高可读性
                    padding: 6rpx 12rpx;
                    border-radius: 8rpx;
                    color: #fff;
                    line-height: 1.2;
                }
            }
        }
    }

    .list-container {
        .cloth-card-list {
            display: flex;
            background: #fff;
            border-radius: 24rpx;
            padding: 20rpx; // 稍微减小内边距
            margin-bottom: 20rpx;
            box-shadow: $shadow;
            transition: transform 0.1s;

            &:active {
                transform: scale(0.99);
            }

            .list-img-box {
                position: relative;
                flex-shrink: 0; // 防止图片被压缩

                .cloth-img-l {
                    width: 180rpx; // 稍微加大图片
                    height: 180rpx;
                    border-radius: 16rpx;
                    background-color: #f5f5f5;
                }

                .select-mask {
                    position: absolute;
                    left: 0;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.1);
                    z-index: 1;
                    border-radius: 16rpx;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .select-icon {
                    width: 48rpx;
                    height: 48rpx;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    
                    &.checked {
                        background: $morandi-blue;
                        color: #fff;
                    }
                }

                .check-overlay-l {
                    display: none; // 隐藏旧的 checkbox，使用自定义样式
                }
            }

            .cloth-details {
                flex: 1;
                margin-left: 24rpx;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding: 4rpx 0;

                .price-row {
                    display: flex;
                    align-items: baseline; // 基线对齐
                    justify-content: space-between;

                    .cost-per {
                        font-size: 32rpx; // 加大主要数字
                        font-weight: 600;
                        color: $text-main;
                        
                        .currency {
                            font-size: 22rpx;
                            margin-right: 2rpx;
                        }
                        
                        .unit {
                            font-size: 22rpx;
                            color: $text-grey;
                            font-weight: normal;
                            margin-left: 4rpx;
                        }
                    }

                    .item-price {
                        font-size: 22rpx;
                        color: #ccc;
                        text-decoration: line-through;
                    }
                }

                .info-row {
                    font-size: 22rpx;
                    color: $text-grey;
                    margin-top: 8rpx;
                    display: flex;
                    align-items: center;
                    gap: 12rpx;
                    
                    .divider {
                        width: 1px;
                        height: 16rpx;
                        background: #eee;
                    }
                }

                .tag-row-l {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12rpx;
                    margin-top: auto; // 推到底部

                    .tag-label {
                        font-size: 20rpx;
                        padding: 4rpx 12rpx;
                        border-radius: 8rpx;
                        background: #f7f8fa; // 增加浅色背景
                        border: none; // 移除边框，改用背景色
                        color: #666 !important; // 强制深灰色文字
                    }
                }
            }
        }
    }

    .fab-add {
        position: fixed;
        right: 40rpx;
        bottom: 100rpx;
        width: 100rpx;
        height: 100rpx;
        background: $morandi-blue;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 10rpx 30rpx rgba($morandi-blue, 0.4);
        z-index: 10;
    }

    .batch-bar {
        position: fixed;
        bottom: 40rpx;
        left: 30rpx;
        right: 30rpx;
        height: 110rpx;
        background: rgba(51, 51, 51, 0.95);
        color: #fff;
        border-radius: 55rpx;
        display: flex;
        align-items: center;
        backdrop-filter: blur(10px);
        z-index: 100;

        .batch-btn {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12rpx;
            font-size: 26rpx;

            &.del {
                border-right: 1px solid #555;
            }
        }

        .batch-info {
            color: #fff;
            padding: 0 24rpx;
            font-size: 26rpx;
        }
    }

    .transition-fade {
        animation: fadeIn 0.4s ease;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10rpx);
        }

        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .animate-slide-up {
        animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
        from {
            transform: translateY(120rpx);
        }

        to {
            transform: translateY(0);
        }
    }

    .safe-area-bottom {
        height: 180rpx;
    }

    /* 弹窗卡片样式（居中） */
    .tag-overlay {
        background: rgba(0,0,0,0.35);
    }

    .tag-popup-card {
    
        width: 640rpx;
        max-width: 92%;
        background: #fff;
        border-radius: 20rpx;
        box-shadow: 0 20rpx 40rpx rgba(0,0,0,0.15);
        overflow: hidden;
    }

    .card-inner {
        padding: 28rpx;
    }

    .card-title {
        font-size: 30rpx;
        font-weight: 600;
        color: #222;
        margin-bottom: 18rpx;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .close-btn {
            font-size: 26rpx;
            color: #999;
            font-weight: normal;
            padding: 0 10rpx;
        }
    }

    .card-section {
        margin-bottom: 14rpx;
    }

    .card-section-title {
        font-size: 24rpx;
        color: #666;
        margin-bottom: 10rpx;
    }

    .options-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12rpx;
    }

    .opt-item {
        padding: 8rpx 20rpx;
        border-radius: 18rpx;
        border: 1rpx solid #E6E6E6;
        background: #fff;
        color: #333;
        font-size: 24rpx;
    }

    .opt-item.active {
        background: $morandi-blue;
        color: #fff;
        border-color: $morandi-blue;
    }

    .card-actions {
        display: flex;
        gap: 20rpx;
        margin-top: 20rpx;
    }

    .card-actions .btn {
        flex: 1;
        height: 72rpx;
        border-radius: 36rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28rpx;
    }

    .card-actions .btn.reset {
        background: #F0F0F0;
        color: #666;
    }

    .card-actions .btn.confirm {
        background: $morandi-blue;
        color: #fff;
    }}
</style>