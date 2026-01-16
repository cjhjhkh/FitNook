<template>
	<view class="outfit-page">
		<!-- 顶部操作栏 -->
		<view class="header-bar">
			<view class="search-box">
				<van-search :value="keyword" placeholder="搜索搭配灵感" shape="round" background="transparent"
					@change="onSearchChange" @search="loadOutfits" />
			</view>
			<view class="action-icons">
				<view class="icon-btn" @tap="goToDiary">
					<van-icon name="calendar-o" size="22px" color="#333" />
					<text class="icon-text">日历</text>
				</view>
			</view>
		</view>

		<!-- 筛选标签 -->
		<view class="filter-container">
			<scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
				<view class="filter-row">
					<view v-for="tab in tabs" :key="tab.value" class="filter-item"
						:class="{ active: currentTab === tab.value }" @tap="handleTabChange(tab.value)">
						{{ tab.label }}
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 搭配列表 -->
		<scroll-view scroll-y class="content-area" @scrolltolower="onLoadMore" enable-flex>
			<view class="outfit-list">
				<!-- 新建卡片 (始终显示在第一个) -->
				<view class="outfit-card create-card" @tap="goToCreate">
					<view class="dashed-box">
						<view class="plus-icon-circle">
							<van-icon name="plus" size="24px" color="#fff" />
						</view>
						<text class="create-text">新建搭配</text>
					</view>
				</view>

				<!-- 搭配卡片 -->
				<view v-for="(item, index) in outfitList" :key="item.id" class="outfit-card" @tap="goToDetail(item)">
					<view class="card-img-area" :style="{ background: item.bg_color || '#f9f9f9' }">
						<view 
							class="outfit-image-wrapper" 
							v-if="item.image_url"
						>
							<!-- 优先显示 image_url (合成大图) -->
							<image 
								:src="item.image_url" 
								mode="aspectFill" 
								class="outfit-cover-img"
							/>
						</view>
						
						<!-- 如果没有合成图，回退到原来的组合显示逻辑 (或者作为加载失败的备份) -->
						<view 
							v-else
							class="outfit-preview" 
							:style="{ background: item.bg_color || '#f7f8fa' }"
						>
							<!-- 否则展示动态画布 (回退方案) -->
							<view v-if="item.items && item.items.length > 0" class="composition-area">
								<view 
									v-for="(subItem, idx) in item.items" 
									:key="idx" 
									class="comp-item"
									:style="getItemStyle(subItem)"
								>
									<image 
										:src="subItem.image_url" 
										mode="widthFix" 
										class="comp-img" 
										:style="{ transform: subItem.isFlipped ? 'scaleX(-1)' : 'none' }"
									/>
								</view>
							</view>
                            <!-- 空状态 -->
                            <view v-else class="empty-img">
                                <van-icon name="photo-o" size="32px" color="#eee" />
                            </view>
						</view>
					</view>
					<view class="card-info">
						<text class="outfit-name">{{ item.name || '未命名搭配' }}</text>
						<view class="tags">
							<view v-if="item.scene" class="mini-tag scene">{{ item.scene }}</view>
							<view v-if="item.season" class="mini-tag season">{{ item.season }}</view>
                            <view v-if="item.temperature" class="mini-tag temp">{{ item.temperature }}</view>
						</view>
					</view>
				</view>
			</view>
			
			<view v-if="outfitList.length === 0" class="empty-state">
				<text>还没有搭配方案，快去创建吧~</text>
			</view>
			
			<view class="safe-bottom"></view>
		</scroll-view>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
// @ts-ignore
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { getOutfitList } from '@/api/outfit';

// --- 类型定义 ---
interface OutfitItem {
	id: number;
	name: string;
    bg_color?: string; // 新增背景色
	scene?: string;
	season?: string;
    temperature?: string; // 新增
    image_url?: string; // 新增合成图URL
	items: { 
        image_url: string;
        x?: number;
        y?: number;
        scale?: number;
        rotate?: number;
        zIndex?: number;
        isFlipped?: boolean;
    }[];
}

// --- 状态 ---
const keyword = ref('');
const currentTab = ref('all');
const tabs = [
	{ label: '全部', value: 'all' },
	{ label: '通勤', value: '通勤' },
	{ label: '约会', value: '约会' },
	{ label: '休闲', value: '休闲' },
	{ label: '运动', value: '运动' },
	{ label: '居家', value: '居家' },
	{ label: '派对', value: '派对' }
];

const outfitList = ref<OutfitItem[]>([]);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const finished = ref(false);

// --- 生命周期 ---
onLoad(() => {
    loadOutfits();
    // 监听刷新事件
    uni.$on('refreshOutfitList', () => {
        loadOutfits();
    });
});

onUnload(() => {
    uni.$off('refreshOutfitList');
});

// --- 方法 ---

const loadOutfits = async (isLoadMore = false) => {
	if (loading.value) return;
	loading.value = true;

	if (!isLoadMore) {
		page.value = 1;
		finished.value = false;
	}

	try {
		// 获取当前登录用户的 account
		const userInfo = uni.getStorageSync('userInfo');
		const account = userInfo?.account;

		if (!account) {
			// 如果没有账号信息，可能是未登录，停止加载
			loading.value = false;
			return;
		}

		const requestParams: any = {
			account: account,
			page: page.value,
			limit: pageSize.value
		};
        
		// 如果选中的不是"全部"，则传递 scene 参数进行筛选
		if (currentTab.value !== 'all') {
			requestParams.scene = currentTab.value;
		}

		const res: any = await getOutfitList(requestParams);
		
		if (res.code === 200) {
			const list = res.data || [];
            
			// 映射后端数据结构到前端所需格式
            const mappedList = list.map((item: any) => ({
                id: item.id,
                name: item.name,
                bg_color: item.bg_color, // 映射背景色
                scene: item.scene,   // 后端已拼接好字符串
                season: item.season, // 后端已拼接好字符串
                temperature: item.temperature, // 新增
                image_url: item.image_url, // 映射合成图
                // 修复：包含完整的布局信息
                items: item.items ? item.items.map((i: any) => ({ 
                    image_url: i.image_url,
                    // 兼容处理：优先取 position_x，如果没有则取 x
                    x: i.position_x !== undefined ? i.position_x : i.x,
                    y: i.position_y !== undefined ? i.position_y : i.y,
                    scale: i.scale || 1,
                    rotate: i.rotation !== undefined ? i.rotation : (i.rotate || 0),
                    zIndex: i.z_index !== undefined ? i.z_index : (i.zIndex || 0),
                    isFlipped: !!(i.is_flipped || i.isFlipped)
                })) : []
            }));

			if (isLoadMore) {
				outfitList.value = [...outfitList.value, ...mappedList];
			} else {
				outfitList.value = mappedList;
			}
            
            // 判断是否还有更多数据
            if (list.length < pageSize.value) {
                finished.value = true;
            } else {
                page.value++;
            }
		}
	} catch (error) {
		console.error('加载失败', error);
		uni.showToast({ title: '加载失败', icon: 'none' });
	} finally {
		loading.value = false;
	}
};

const handleTabChange = (val: string) => {
	currentTab.value = val;
	loadOutfits();
};

const onSearchChange = (e: any) => {
	keyword.value = e.detail;
};

const onLoadMore = () => {
    if (!finished.value) {
        loadOutfits(true);
    }
};

// 跳转到新建页面
const goToCreate = () => {
	uni.navigateTo({
		url: '/pages/outfit/create'
	});
};

// 跳转到详情/编辑页面
const goToDetail = (item: OutfitItem) => {
	uni.navigateTo({
		url: `/pages/outfit/create?id=${item.id}`
	});
};

// 跳转到日历/日记页面
const goToDiary = () => {
	uni.navigateTo({
		url: '/pages/outfit/diary'
	});
};

// 计算单品在缩略图中的样式
const getItemStyle = (item: any) => {
	// 兼容处理：如果数据是旧的像素坐标(>1)，按375宽转百分比；如果是0-1则直接用
	let x = Number(item.x);
	let y = Number(item.y);
	
	if (x > 1) x = x / 375;
	if (y > 1) y = y / 375 || x; // 防御性编程

	return {
		left: (x * 100) + '%',
		top: (y * 100) + '%',
		// 基准宽度设为40% (对应编辑器里的150px/375px)
		width: '40%', 
		transform: `translate(-50%, -50%) rotate(${item.rotate || 0}deg) scale(${item.scale || 1})`,
		zIndex: item.zIndex || 0
	};
};

</script>

<style lang="scss" scoped>
$bg: #F8F9FA;
$primary: #A4C2F4;
$text-main: #333;
$text-light: #999;

.outfit-page {
	background-color: $bg;
	height: 100vh;
	overflow: hidden;
	display: flex;
	flex-direction: column;

	.header-bar {
		padding: 20rpx 24rpx;
		background: #fff;
		display: flex;
		align-items: center;
		gap: 20rpx;
		position: sticky;
		top: 0;
		z-index: 10;

		.search-box {
			flex: 1;
		}

		.action-icons {
			display: flex;
			align-items: center;

			.icon-btn {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: 0 10rpx;
				
				.icon-text {
					font-size: 20rpx;
					color: #666;
					margin-top: 4rpx;
				}
			}
		}
	}

	.filter-container {
		background: #fff;
		padding-bottom: 20rpx;
		
		.filter-scroll {
			white-space: nowrap;
			width: 100%;
		}

		.filter-row {
			display: flex;
			padding: 0 24rpx;
			gap: 16rpx;
		}

		.filter-item {
			display: inline-block;
			padding: 10rpx 32rpx;
			background: #f5f5f5;
			border-radius: 30rpx;
			font-size: 26rpx;
			color: #666;
			transition: all 0.3s;

			&.active {
				background: $primary;
				color: #fff;
				font-weight: 500;
				box-shadow: 0 4rpx 12rpx rgba($primary, 0.3);
			}
		}
	}

	.content-area {
		flex: 1;
		padding: 24rpx;
		box-sizing: border-box;
		min-height: 0; /* 修复可能的高度塌陷，原为 height: 0 */
		overflow: hidden; 

		.outfit-list {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 20rpx;
		}

		.outfit-card {
			background: #fff;
			border-radius: 24rpx;
			overflow: hidden;
			box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
			display: flex;
			flex-direction: column;
			
			&:active {
				transform: scale(0.98);
				transition: transform 0.1s;
			}

			.card-img-area {
				width: 100%;
				padding-bottom: 100%;
				position: relative;
				background: #f9f9f9;
				overflow: hidden; /* 防止超出圆角 */

				.outfit-image-wrapper {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					z-index: 1;

					.outfit-cover-img {
						width: 100%;
						height: 100%;
					}
				}

                // 添加快照图片的样式
                .snapshot-img {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

				.composition-area {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					
					.comp-item {
						position: absolute;
						/* 宽高由style动态控制 */
						display: flex;
						align-items: center;
						justify-content: center;
						pointer-events: none; // 列表页仅展示，不交互

						.comp-img {
							width: 100%;
							display: block;
							// height: auto 由 mode="widthFix" 控制
						}
					}
					
					.empty-img {
						width: 100%;
						height: 100%;
						display: flex;
						align-items: center;
						justify-content: center;
					}
				}
			}

			.card-info {
				padding: 16rpx;

				.outfit-name {
					font-size: 28rpx;
					font-weight: 600;
					color: $text-main;
					margin-bottom: 12rpx;
					display: block;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.tags {
					display: flex;
					gap: 8rpx;
					
					.mini-tag {
						font-size: 20rpx;
						padding: 2rpx 10rpx;
						border-radius: 6rpx;
						
						&.scene {
							background: #E8F0FE;
							color: #1989fa;
						}
						
						&.season {
							background: #FFF7E6;
							color: #FA8C16;
						}

                        &.temp {
                            background: #E6FFFB;
                            color: #13C2C2;
                        }
					}
				}
			}
		}

		.create-card {
			.dashed-box {
				width: 100%;
				height: 100%;
				min-height: 340rpx;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				border: 2rpx dashed #ddd;
				border-radius: 24rpx;
				background: #fafafa;
				
				.plus-icon-circle {
					width: 80rpx;
					height: 80rpx;
					background: #ddd;
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					margin-bottom: 16rpx;
				}
				
				.create-text {
					font-size: 26rpx;
					color: #999;
				}
			}
		}
		
		.empty-state {
			padding: 60rpx 0;
			text-align: center;
			color: #ccc;
			font-size: 26rpx;
		}
	}
	
	.safe-bottom {
		height: 40rpx;
	}
}
</style>
