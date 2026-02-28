<template>
	<view class="selector-page">
        <!-- 顶部：已选预览区 -->
        <view class="selected-preview" v-if="totalSelected > 0">
            <view class="preview-header">
                <text>已选 ({{ totalSelected }})</text>
                <text class="clear-btn" @tap="clearSelection">清空</text>
            </view>
            <scroll-view scroll-x class="preview-scroll" :show-scrollbar="false">
                <view class="preview-list">
                    <!-- 已选衣物 -->
                    <view v-for="id in selectedClothesIds" :key="'c-'+id" class="preview-item">
                        <image :src="getDataImage(id, 'clothes')" mode="aspectFill" class="p-img" />
                        <view class="remove-badge" @tap.stop="toggleClothes(id)">
                            <van-icon name="cross" size="10px" color="#fff" />
                        </view>
                    </view>
                    <!-- 已选搭配 -->
                    <view v-for="id in selectedOutfitIds" :key="'o-'+id" class="preview-item">
                        <image :src="getDataImage(id, 'outfit')" mode="aspectFill" class="p-img" />
                         <view class="remove-badge" @tap.stop="toggleOutfit(id)">
                            <van-icon name="cross" size="10px" color="#fff" />
                        </view>
                    </view>
                </view>
            </scroll-view>
        </view>

		<!-- 顶部 Tabs -->
		<view class="fixed-header">
			<van-tabs :active="activeTab" @change="onTabChange" color="#8b5c47" title-active-color="#8b5c47">
				<van-tab title="添加衣物" name="clothes"></van-tab>
				<van-tab title="添加搭配" name="outfit"></van-tab>
			</van-tabs>

			<!-- 搜索栏 -->
			<view class="search-box">
				<van-search :value="keyword" placeholder="搜索关键词..." shape="round" background="#fff"
					@change="onSearchChange" @search="onSearch" />
			</view>
		</view>

		<!-- 列表区域 -->
		<scroll-view scroll-y class="content-area" @scrolltolower="onLoadMore">
			<view class="list-container">
				
				<!-- 衣物列表 -->
				<view v-if="activeTab === 'clothes'" class="grid-layout">
					<view v-for="item in renderList" :key="item.id" 
						class="grid-item" 
						:class="{ 
                            selected: selectedClothesIds.has(item.id),
                            'is-existing': existingClothesIds.has(item.id)
                        }"
						@tap="toggleClothes(item.id, item)">
						<image :src="item.image_url" mode="aspectFill" class="item-img" />
						<view class="item-name">{{ item.name }}</view>
                        
                        <!-- 选中标记 -->
						<view class="check-mark" v-if="selectedClothesIds.has(item.id)">
							<van-icon name="success" color="#fff" size="14px" />
						</view>

                        <!-- 已装箱标记 -->
                        <view class="existing-mark" v-if="existingClothesIds.has(item.id)">
                            <text>已装箱</text>
                        </view>
					</view>
				</view>

				<!-- 搭配列表 -->
				<view v-if="activeTab === 'outfit'" class="list-layout">
					<view v-for="item in renderList" :key="item.id" 
						class="list-item"
						:class="{ 
                            selected: selectedOutfitIds.has(item.id),
                             'is-existing': existingOutfitIds.has(item.id)
                        }"
						@tap="toggleOutfit(item.id, item)">
						<view class="outfit-img-box">
							<image :src="item.image_url" mode="aspectFill" class="outfit-img" v-if="item.image_url"/>
                             <!-- 如果没有合成图，显示第一张items图兜底 -->
                            <image 
                                :src="item.items && item.items[0] && item.items[0].image_url" 
                                mode="aspectFill" 
                                class="outfit-img" 
                                v-else-if="item.items && item.items.length"
                            />
                            <view class="no-img" v-else>无图片</view>
						</view>
						<view class="item-info">
							<text class="title">{{ item.name || '未命名搭配' }}</text>
							<text class="sub">{{ item.scene }} {{ item.season }}</text>
						</view>
						<view class="check-circle" :class="{ checked: selectedOutfitIds.has(item.id) }">
							<van-icon name="success" color="#fff" size="12px" v-if="selectedOutfitIds.has(item.id)" />
						</view>
                        
                        <view class="existing-tag" v-if="existingOutfitIds.has(item.id)">已添加</view>
					</view>
				</view>

				<!-- 空状态 -->
				<view v-if="renderList.length === 0 && !loading" class="empty-state">
					<van-empty description="暂无相关内容" />
				</view>
				
				<!-- 加载中 -->
				<view v-if="loading" class="loading-state">
					<van-loading size="24px">加载中...</van-loading>
				</view>
			</view>
            <view class="safe-area-bottom"></view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="bottom-bar">
			<view class="selected-count">
				已选: {{ totalSelected }} 项
			</view>
			<van-button type="primary" round color="#8b5c47" @click="confirmAdd" :loading="submitting">
				确认添加
			</van-button>
		</view>
	</view>
</template>

<script setup lang="ts">
// @ts-ignore
import { ref, computed } from 'vue';
// @ts-ignore
import { onLoad } from '@dcloudio/uni-app';
import { getClothesList } from '@/api/clothes';
import { getOutfitList } from '@/api/outfit';
import { addSuitcaseContent, getSuitcaseDetail } from '@/api/suitcase';

const suitcaseId = ref('');
const activeTab = ref('clothes');
const keyword = ref('');
const loading = ref(false);
const submitting = ref(false);
const page = ref(1);
const finished = ref(false);

const dataList = ref<any[]>([]);

// 选中状态管理 (本次操作选中的)
const selectedClothesIds = ref(new Set<number>());
const selectedOutfitIds = ref(new Set<number>());

// 已存在的物品 (从服务端获取)
const existingClothesIds = ref(new Set<number>());
const existingOutfitIds = ref(new Set<number>());

const renderList = computed(() => dataList.value);

// 辅助：为了在预览区显示图片，我们需要一个ID到图片的映射
const imageMap = ref<Record<string, string>>({});

const getDataImage = (id: number, type: 'clothes' | 'outfit') => {
    const key = `${type}-${id}`;
    if (imageMap.value[key]) return imageMap.value[key];
    return ''; 
};

const updateImageMap = (item: any, type: 'clothes' | 'outfit') => {
    const key = `${type}-${item.id}`;
    let img = item.image_url;
    if (!img && item.items && item.items.length) {
        img = item.items[0].image_url;
    }
    imageMap.value[key] = img;
};

const totalSelected = computed(() => {
    return selectedClothesIds.value.size + selectedOutfitIds.value.size;
});

onLoad(async (options: any) => {
	if (options.suitcaseId || options.id) {
		suitcaseId.value = options.suitcaseId || options.id;
        if (options.tab === '1') {
            activeTab.value = 'outfit';
        }
        await fetchExistingContent();
	}
	loadData();
});

const fetchExistingContent = async () => {
    try {
        const res: any = await getSuitcaseDetail(suitcaseId.value);
        if (res.code === 200) {
            const detail = res.data;
            if (detail.items && detail.items.length) {
                detail.items.forEach((i: any) => {
                    if (i.cloth_id) existingClothesIds.value.add(i.cloth_id);
                });
            }
            if (detail.outfits && detail.outfits.length) {
                if (detail.outfits_detail) {
                    detail.outfits_detail.forEach((o: any) => {
                        existingOutfitIds.value.add(o.id);
                    });
                }
            }
        }
    } catch (e) {
        console.error('获取行李箱详情失败', e);
    }
};

const onTabChange = (e: any) => {
	activeTab.value = e.detail.name;
	page.value = 1;
	dataList.value = [];
	finished.value = false;
	loadData();
};

const onSearchChange = (e: any) => {
	keyword.value = e.detail;
};

const onSearch = () => {
	page.value = 1;
	dataList.value = [];
	finished.value = false;
	loadData();
};

const loadData = async () => {
	if (loading.value || finished.value) return;
	loading.value = true;

	try {
        const userInfo = uni.getStorageSync('userInfo');
        const account = userInfo?.account;
        
		const params: any = {
            account: account,
            page: page.value,
            limit: 20, // 增加每页数量
            keyword: keyword.value
        };

		let res: any;
		if (activeTab.value === 'clothes') {
			res = await getClothesList(params);
		} else {
            // 穿搭列表参数略有不同，通常后端支持 scene 筛选，这里暂传全部
			res = await getOutfitList(params);
		}
		
		if (res.code === 200) {
            const list = res.data.list || res.data || [];
			dataList.value = [...dataList.value, ...list];
            
            // 将加载到的数据加入 map，防止预览时没图
            list.forEach((item: any) => {
                updateImageMap(item, activeTab.value as any);
            });

            if (list.length < 20) {
                finished.value = true;
            }
            page.value++;
        }
	} catch (e) {
		console.error(e);
	} finally {
		loading.value = false;
	}
};

const onLoadMore = () => {
    loadData();
};

const clearSelection = () => {
    selectedClothesIds.value.clear();
    selectedOutfitIds.value.clear();
};

const toggleClothes = (id: number, item?: any) => {
    if (existingClothesIds.value.has(id)) {
        return;
    }
    if (item) updateImageMap(item, 'clothes');
	if (selectedClothesIds.value.has(id)) {
		selectedClothesIds.value.delete(id);
	} else {
		selectedClothesIds.value.add(id);
	}
};

const toggleOutfit = (id: number, item?: any) => {
     if (existingOutfitIds.value.has(id)) {
        return;
    }
    if (item) updateImageMap(item, 'outfit');
	if (selectedOutfitIds.value.has(id)) {
		selectedOutfitIds.value.delete(id);
	} else {
		selectedOutfitIds.value.add(id);
	}
};

const confirmAdd = async () => {
	if (totalSelected.value === 0) {
		uni.showToast({ title: '请至少选择一项', icon: 'none' });
		return;
	}

	submitting.value = true;

	try {
		const res: any = await addSuitcaseContent({
            id: suitcaseId.value,
			outfit_ids: Array.from(selectedOutfitIds.value),
            cloth_ids: Array.from(selectedClothesIds.value)
		});

		if (res.code === 200) {
            uni.showToast({ title: '添加成功', icon: 'success' });
            // 触发事件通知上一页刷新
            uni.$emit('suitcaseUpdated', { id: suitcaseId.value });
            
            setTimeout(() => {
                uni.navigateBack();
            }, 800);
		} else {
            uni.showToast({ title: res.msg || '添加失败', icon: 'none' });
        }
	} catch (e) {
		uni.showToast({ title: '网络错误', icon: 'none' });
	} finally {
		submitting.value = false;
	}
};
</script>

<style lang="scss" scoped>
.selector-page {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background-color: #f7f8fa;
}

.selected-preview {
    background: #fff;
    padding: 20rpx;
    border-bottom: 1rpx solid #eee;
    z-index: 11;
    
    .preview-header {
        display: flex;
        justify-content: space-between;
        font-size: 26rpx;
        color: #333;
        margin-bottom: 16rpx;
        
        .clear-btn {
            color: #999;
        }
    }
    
    .preview-scroll {
        white-space: nowrap;
        width: 100%;
        
        .preview-list {
            display: flex;
            gap: 16rpx;
        }
        
        .preview-item {
            position: relative;
            width: 80rpx;
            height: 80rpx;
            flex-shrink: 0;
            
            .p-img {
                width: 100%;
                height: 100%;
                border-radius: 8rpx;
                background: #f5f5f5;
                border: 1rpx solid #eee;
            }
            
            .remove-badge {
                position: absolute;
                top: -10rpx;
                right: -10rpx;
                background: rgba(0,0,0,0.5);
                border-radius: 50%;
                width: 32rpx;
                height: 32rpx;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2;
            }
        }
    }
}

.fixed-header {
	background: #fff;
    position: sticky;
    top: 0;
	z-index: 10;
}

.search-box {
	padding: 0 12rpx 12rpx;
}

.content-area {
	flex: 1;
	overflow-y: hidden;
}

.list-container {
	padding: 24rpx;
}

.grid-layout {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 20rpx;
}

.grid-item {
	position: relative;
	background: #fff;
	border-radius: 12rpx;
	overflow: hidden;
	aspect-ratio: 1;
    border: 2px solid transparent;

	&.selected {
		border-color: #8b5c47;
	}

    &.is-existing {
        opacity: 0.6;
        background-color: #f5f5f5;
    }

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
		padding: 4rpx 8rpx;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.check-mark {
		position: absolute;
		top: 8rpx;
		right: 8rpx;
		background: #8b5c47;
		border-radius: 50%;
		width: 32rpx;
		height: 32rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

    .existing-mark {
        position: absolute;
        top: 0;
        right: 0;
        background: rgba(0,0,0,0.4);
        padding: 4rpx 8rpx;
        border-bottom-left-radius: 8rpx;
        
        text {
            font-size: 20rpx;
            color: #fff;
        }
    }
}

.list-layout {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.list-item {
	background: #fff;
	border-radius: 12rpx;
	padding: 20rpx;
	display: flex;
	align-items: center;
    border: 2px solid transparent;
    position: relative;
    
    &.selected {
		border-color: #8b5c47;
        background-color: #fdf8f5;
	}

    &.is-existing {
         opacity: 0.6;
    }

	.outfit-img-box {
		width: 120rpx;
		height: 120rpx;
		background: #eee;
		border-radius: 8rpx;
		overflow: hidden;
        margin-right: 20rpx;
        
        .outfit-img {
            width: 100%;
            height: 100%;
        }
        
        .no-img {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20rpx;
            color: #999;
        }
	}

	.item-info {
		flex: 1;
		display: flex;
		flex-direction: column;

		.title {
			font-size: 28rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 8rpx;
		}

		.sub {
			font-size: 24rpx;
			color: #999;
		}
	}

	.check-circle {
		width: 40rpx;
		height: 40rpx;
		border-radius: 50%;
		border: 2rpx solid #ddd;
		display: flex;
		align-items: center;
		justify-content: center;
        
        &.checked {
            background-color: #8b5c47;
            border-color: #8b5c47;
        }
	}

    .existing-tag {
        position: absolute;
        right: 20rpx;
        top: 20rpx;
        font-size: 20rpx;
        color: #999;
        background: #f0f0f0;
        padding: 2rpx 8rpx;
        border-radius: 4rpx;
    }
}

.bottom-bar {
	background: #fff;
	padding: 20rpx 32rpx calc(20rpx + constant(safe-area-inset-bottom));
    padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05);

	.selected-count {
		font-size: 28rpx;
		color: #333;
		font-weight: bold;
	}
}

.safe-area-bottom {
    height: 50rpx;
}

.loading-state {
	padding: 40rpx;
	text-align: center;
}
</style>
