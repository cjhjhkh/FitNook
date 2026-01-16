<template>
    <view class="detail-page">
        <van-skeleton title avatar row="10" :loading="loading">
            <view v-if="details" class="content">
                <view class="image-box">
                    <image :src="details.image_url" mode="aspectFill" class="main-img" @click="previewImg" />
                </view>

                <view class="info-card">
                    <view class="header">
                        <view class="tags-row">
                            <view v-for="(cat, idx) in details.category_names" :key="idx" class="morandi-tag">{{ cat }}</view>
                            <view v-if="!details.category_names || details.category_names.length === 0" class="morandi-tag">{{ details.category_name || '未分类' }}</view>
                        </view>
                    </view>

                    <view class="detail-list">
                        <view class="item" v-if="details.price">
                            <text class="label">价格</text>
                            <text class="value">¥{{ details.price }}</text>
                        </view>
                        <view class="item">
                            <text class="label">已穿次数</text>
                            <text class="value">{{ details.wear_count || 0 }} 次</text>
                        </view>
                        <view class="item" v-if="details.price">
                            <text class="label">单次均价</text>
                            <text class="value">¥{{ perWearPrice }}</text>
                        </view>
                        <view class="item">
                            <text class="label">存放位置</text>
                            <text class="value">{{ details.location || '-' }}</text>
                        </view>
                        <view class="item">
                            <text class="label">颜色</text>
                            <text class="value">{{ details.color || '-' }}</text>
                        </view>
                        <view class="item">
                            <text class="label">材质</text>
                            <text class="value">{{ details.material || '-' }}</text>
                        </view>
                        <view class="item">
                            <text class="label">适用季节</text>
                            <view class="value-box">
                                <text v-if="details.seasons && details.seasons.filter((s:any) => s.name !== '四季').length > 0">
                                    {{ details.seasons.filter((s:any) => s.name !== '四季').map((s:any) => s.name).join(' / ') }}
                                </text>
                                <text v-else>四季</text>
                            </view>
                        </view>
                        <view class="item">
                            <text class="label">适用场景</text>
                            <view class="value-box">
                                <text v-if="details.scenes && details.scenes.filter((s:any) => s.name !== '通用').length > 0">
                                    {{ details.scenes.filter((s:any) => s.name !== '通用').map((s:any) => s.name).join(' / ') }}
                                </text>
                                <text v-else>通用</text>
                            </view>
                        </view>
                        <view class="item">
                            <text class="label">备注信息</text>
                            <text class="value">{{ details.remarks || '-' }}</text>
                        </view>
                        <view class="item">
                            <text class="label">入库时间</text>
                            <text class="value">{{ formatDate(details.created_at || details.record_time) }}</text>
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

        <!-- 编辑弹窗 -->
        <van-popup :show="showEdit" @close="closeEdit" position="bottom" custom-style="height: 80%;" round>
            <view class="edit-popup">
                <view class="popup-header">
                    <text class="cancel" @click="closeEdit">取消</text>
                    <text class="title">编辑单品</text>
                    <text class="confirm" @click="submitEdit">保存</text>
                </view>
                <scroll-view scroll-y class="popup-content">
                    <van-cell-group title="基本信息">
                        <van-field :value="editForm.name" label="名称" placeholder="请输入名称" @change="onFieldChange('name', $event)" />
                        <van-field :value="editForm.price" type="digit" label="价格" placeholder="0.00" @change="onFieldChange('price', $event)" />
                        <van-field :value="editForm.wear_count" type="digit" label="已穿次数" placeholder="0" @change="onFieldChange('wear_count', $event)" />
                        <van-cell title="单次均价" :value="'¥' + editPerWearPrice" />
                        <van-field :value="editForm.location" label="存放位置" placeholder="例如：主卧衣柜" @change="onFieldChange('location', $event)" />
                        <van-field :value="editForm.color" label="颜色" placeholder="例如：黑色" @change="onFieldChange('color', $event)" />
                        <van-field :value="editForm.material" label="材质" placeholder="例如：棉" @change="onFieldChange('material', $event)" />
                    </van-cell-group>

                    <van-cell-group title="分类 (可多选)">
                        <van-checkbox-group :value="editForm.category_ids" @change="onCategoryChange">
                            <van-cell v-for="item in categories" :key="item.id" :title="item.name" clickable @click="toggleCategory(item.id)">
                                <template #right-icon>
                                    <view @tap.stop="noop">
                                        <van-checkbox :name="String(item.id)" />
                                    </view>
                                </template>
                            </van-cell>
                        </van-checkbox-group>
                    </van-cell-group>

                    <van-cell-group title="适用场景">
                        <van-checkbox-group :value="editForm.scene_ids" @change="onSceneChange">
                            <van-cell v-for="item in scenes" :key="item.id" :title="item.name" clickable @click="toggleScene(item.id)">
                                <template #right-icon>
                                    <view @tap.stop="noop">
                                        <van-checkbox :name="String(item.id)" />
                                    </view>
                                </template>
                            </van-cell>
                        </van-checkbox-group>
                    </van-cell-group>

                    <van-cell-group title="适用季节">
                        <van-checkbox-group :value="editForm.season_ids" @change="onSeasonChange">
                            <van-cell v-for="item in seasons" :key="item.id" :title="item.name" clickable @click="toggleSeason(item.id)">
                                <template #right-icon>
                                    <view @tap.stop="noop">
                                        <van-checkbox :name="String(item.id)" />
                                    </view>
                                </template>
                            </van-cell>
                        </van-checkbox-group>
                    </van-cell-group>

                    <van-cell-group title="备注">
                        <van-field :value="editForm.remarks" type="textarea" autosize label="备注" placeholder="请输入备注信息" @change="onFieldChange('remarks', $event)" />
                    </van-cell-group>
                    
                    <view style="height: 50px;"></view>
                </scroll-view>
            </view>
        </van-popup>
    </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { 
    getClothesDetail, 
    batchDeleteClothes, 
    updateClothes, 
    getCategories, 
    getScenes, 
    getSeasons 
} from '@/api/clothes';

const details = ref<any>(null);
const loading = ref(true);

// 编辑相关状态
const showEdit = ref(false);
const categories = ref<any[]>([]);
const scenes = ref<any[]>([]);
const seasons = ref<any[]>([]);
const editForm = ref({
    name: '',
    price: '',
    wear_count: '',
    location: '',
    color: '',
    material: '',
    remarks: '',
    category_ids: [] as string[],
    scene_ids: [] as string[],
    season_ids: [] as string[]
});

// 计算属性：详情展示用的单次均价
const perWearPrice = computed(() => {
    if (!details.value || !details.value.price) return '0.00';
    const price = Number(details.value.price) || 0;
    const count = Number(details.value.wear_count) || 0;
    if (count <= 0) return price.toFixed(2);
    return (price / count).toFixed(2);
});

// 计算属性：编辑表单中实时计算的单次均价
const editPerWearPrice = computed(() => {
    const price = Number(editForm.value.price) || 0;
    const count = Number(editForm.value.wear_count) || 0;
    if (count <= 0) return price.toFixed(2);
    return (price / count).toFixed(2);
});

onLoad((options) => {
    // 调试用：确认是否收到 ID
    console.log('收到页面参数:', options);
    const clothesId = options?.id;
    if (clothesId) {
        // 如果传递了 edit=true，则在加载详情后自动打开编辑框
        const shouldEdit = options.edit === 'true';
        fetchClothesDetail(clothesId, shouldEdit);
    } else {
        uni.showToast({ title: '参数无效', icon: 'none' });
    }
});

// --- 核心业务逻辑 ---

const fetchClothesDetail = (id: string, autoEdit = false) => {
    loading.value = true;
    getClothesDetail(id).then((res: any) => {
        if (res.code === 200) {
            // 注意：Vue3 setup 中直接给 ref 赋值，不使用 this
            details.value = res.data;
            if (autoEdit) {
                handleEdit();
            }
        } else {
            uni.showToast({ title: res.message || '查询失败', icon: 'none' });
        }
    }).catch(() => {
        uni.showToast({ title: '网络请求失败', icon: 'none' });
    }).finally(() => {
        loading.value = false;
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
                batchDeleteClothes([details.value.id]).then((resData: any) => {
                    if (resData.code === 200) {
                        uni.showToast({ title: '删除成功' });
                        // 返回列表页
                        setTimeout(() => uni.navigateBack(), 1000);
                    }
                });
            }
        }
    });
};

const handleEdit = () => {
    if (!details.value) return;
    
    // 初始化表单数据
    editForm.value = {
        name: details.value.name || '',
        price: details.value.price || '',
        wear_count: details.value.wear_count !== undefined ? String(details.value.wear_count) : '0',
        location: details.value.location || '',
        color: details.value.color || '',
        material: details.value.material || '',
        remarks: details.value.remarks || '',
        // 统一转为字符串，确保 checkbox 回显正确
        category_ids: details.value.category_ids ? details.value.category_ids.map((id: any) => String(id)) : [],
        scene_ids: details.value.scenes ? details.value.scenes.map((s: any) => String(s.id)) : [],
        season_ids: details.value.seasons ? details.value.seasons.map((s: any) => String(s.id)) : []
    };
    
    fetchTags();
    showEdit.value = true;
};

const closeEdit = () => {
    showEdit.value = false;
};

// 表单处理
const onFieldChange = (field: string, event: any) => {
    // @ts-ignore
    editForm.value[field] = event.detail;
};

const onCategoryChange = (event: any) => {
    editForm.value.category_ids = event.detail;
};
const toggleCategory = (id: string | number) => {
    const strId = String(id);
    const ids = [...editForm.value.category_ids];
    const index = ids.indexOf(strId);
    if (index !== -1) ids.splice(index, 1);
    else ids.push(strId);
    editForm.value.category_ids = ids;
};

const onSceneChange = (event: any) => {
    editForm.value.scene_ids = event.detail;
};
const toggleScene = (id: string | number) => {
    const strId = String(id);
    const ids = [...editForm.value.scene_ids];
    const index = ids.indexOf(strId);
    if (index !== -1) ids.splice(index, 1);
    else ids.push(strId);
    editForm.value.scene_ids = ids;
};

const onSeasonChange = (event: any) => {
    editForm.value.season_ids = event.detail;
};
const toggleSeason = (id: string | number) => {
    const strId = String(id);
    const ids = [...editForm.value.season_ids];
    const index = ids.indexOf(strId);
    if (index !== -1) ids.splice(index, 1);
    else ids.push(strId);
    editForm.value.season_ids = ids;
};

const noop = () => {};

// 提交编辑
const submitEdit = () => {
    uni.showLoading({ title: '保存中...' });
    updateClothes(details.value.id, editForm.value).then((res: any) => {
        uni.hideLoading();
        if (res.code === 200) {
            uni.showToast({ title: '更新成功' });
            showEdit.value = false;
            // 刷新详情
            fetchClothesDetail(details.value.id);
        } else {
            uni.showToast({ title: res.message || '更新失败', icon: 'none' });
        }
    }).catch(() => {
        uni.hideLoading();
        uni.showToast({ title: '网络请求失败', icon: 'none' });
    });
};

// 获取标签选项
const fetchTags = () => {
    // 并发请求所有标签
    Promise.all([
        getCategories(),
        getScenes(),
        getSeasons()
    ]).then(([resCat, resScene, resSeason]: any[]) => {
        const cats = resCat.data || [];
        const scs = resScene.data || [];
        const seas = resSeason.data || [];

        // 过滤掉兜底选项
        categories.value = cats.filter((c: any) => !['其他', '未分类'].includes(c.name));
        scenes.value = scs.filter((s: any) => s.name !== '通用');
        seasons.value = seas.filter((s: any) => s.name !== '四季');

        // 清洗 editForm 中的 ID，移除不在选项列表中的 ID（即移除兜底标签 ID）
        // 确保编辑保存时不会带上“通用”、“四季”等
        const validCategoryIds = categories.value.map(c => String(c.id));
        const validSceneIds = scenes.value.map(s => String(s.id));
        const validSeasonIds = seasons.value.map(s => String(s.id));

        editForm.value.category_ids = editForm.value.category_ids.filter(id => validCategoryIds.includes(id));
        editForm.value.scene_ids = editForm.value.scene_ids.filter(id => validSceneIds.includes(id));
        editForm.value.season_ids = editForm.value.season_ids.filter(id => validSeasonIds.includes(id));
    });
};

// 简单的日期格式化
const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};
</script>

<style lang="scss" scoped>
// 莫兰迪色系变量
$morandi-bg: #F2F3F5;
$morandi-text: #5E6D82;

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
            margin-bottom: 40rpx;
            
            .tags-row {
                display: flex;
                flex-wrap: wrap;
                gap: 12rpx;
                
                .morandi-tag {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background-color: $morandi-bg; 
                    color: $morandi-text;
                    font-size: 24rpx;
                    padding: 8rpx 20rpx; // 稍微增加内边距
                    border-radius: 8rpx;
                    line-height: 1.4; // 调整行高
                }
            }
        }

        .detail-list {
            .item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 25rpx;
                font-size: 28rpx;
                .label { color: #969799; flex-shrink: 0; width: 140rpx; }
                .value-box { 
                    color: #323233; 
                    font-weight: 500; 
                    text-align: right;
                    flex: 1;
                }
                .value { 
                    color: #323233; 
                    font-weight: 500; 
                    text-align: right;
                    flex: 1;
                }
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

    .edit-popup {
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: #f7f8fa;

        .popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 30rpx;
            background: #fff;
            border-bottom: 1rpx solid #ebedf0;

            .title {
                font-size: 32rpx;
                font-weight: bold;
            }
            .cancel {
                color: #969799;
                font-size: 28rpx;
            }
            .confirm {
                color: #1989fa;
                font-size: 28rpx;
                font-weight: bold;
            }
        }

        .popup-content {
            flex: 1;
            overflow-y: auto;
        }
    }
}
</style>