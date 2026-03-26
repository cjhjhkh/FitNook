<template>
	<view class="daily-rec-container">
		<!-- 头部区域：还原截图风格 -->
		<view class="header">
			<view class="header-left">
				<text class="title">今日灵感</text>
				<view class="ai-tag">
					<text>By AI · 26℃ 晴</text>
				</view>
			</view>
			<view class="header-right" @click="refreshRecommendations">
				<van-icon name="replay" size="14px" color="#666" />
				<text class="refresh-text">换一批</text>
			</view>
		</view>

		<view v-if="loading" class="loading-state">
			<van-loading type="spinner" color="#7232dd" />
			<text>AI 正在构思搭配...</text>
		</view>

		<view v-else-if="recommendations.length > 0" class="rec-list">
				<view class="rec-grid">
					<view v-for="(item, index) in recommendations" :key="index" class="rec-card" @click="handleItemClick(item)">
						<!-- 图片区域：支持单图或四宫格拼图 -->
						<view class="image-area">
							<!-- 左上角风格标签 -->
							<view class="style-tag">
								<text># {{ item.style || '混搭' }}</text>
							</view>

							<!-- 四宫格拼图逻辑：如果有 items 且数量大于1，显示拼图 -->
							<view v-if="item.items && item.items.length > 1" class="collage-grid">
								<view v-for="(subItem, idx) in item.items.slice(0, 4)" :key="idx" class="grid-item">
									<image :src="subItem.image || subItem.image_url" mode="aspectFit" class="grid-image" />
								</view>
							</view>
							<!-- 否则显示单张大图（合成图或封面图） -->
							<image v-else :src="item.image || item.image_url || '/static/default-outfit.png'" mode="aspectFit" class="single-image" />

							<!-- 右下角收藏按钮 -->
							<view class="fav-btn" @click.stop="toggleFav(item)">
								<van-icon :name="item.is_favorite ? 'like' : 'like-o'" :color="item.is_favorite ? '#7232dd' : '#7232dd'" size="18px" />
							</view>
						</view>

						<!-- 底部描述信息 -->
						<view class="card-info">
							<text class="desc-text">{{ item.description || item.name || '今日随心搭配，尽显独特风格' }}</text>
						</view>
						
						<!-- 列表中的右下角更多操作，如果需要的话，或者保持设计图的简单 -->
					</view>
				</view>
			</view>

		<view v-else class="empty-state">
			<van-empty image="search" description="衣橱空空如也，先去上传几件衣服吧" />
		</view>
	</view>
</template>

<script>
	import { getDailyRecommendation } from '@/api/recommendation.ts';
	import { createOutfit } from '@/api/outfit.ts';
	import { addFavorite, removeFavorite } from '@/api/favorites.ts';

	export default {
		name: 'DailyRecommendation',
		props: {
			userId: {
				type: [Number, String],
				default: ''
			},
			account: {
				type: String,
				default: ''
			}
		},
		data() {
			return {
				loading: false,
				recommendations: [],
				todayDate: ''
			};
		},
		mounted() {
			this.setTodayDate();
			if (this.userId || this.account) {
				this.fetchRecommendations();
			}
		},
		watch: {
			userId(newVal) {
				if (newVal) {
					this.fetchRecommendations();
				}
			}
		},
		methods: {
			setTodayDate() {
				// 不再需要显示日期，截图显示的是天气
			},
			async fetchRecommendations() {
				if (this.loading) return;
				this.loading = true;
				try {
					const res = await getDailyRecommendation({
						userId: this.userId,
						account: this.account,
						count: 5
					});
					
					if (res && res.data) {
						let list = Array.isArray(res.data) ? res.data : (res.data.list || []);
						
						// 数据预处理：为了演示效果，如果没有 items，我们模拟一些假数据结构，以免 UI 崩坏
						// 在实际对接时，请删除这里的 mock 逻辑
						this.recommendations = list.map(item => {
                            // 尝试解析 items，如果是字符串
                            let parsedItems = item.items;
                            if (typeof item.items === 'string') {
                                try { parsedItems = JSON.parse(item.items); } catch(e){}
                            }

							return {
								...item,
                                items: Array.isArray(parsedItems) ? parsedItems : [],
								style: item.style || item.category || '日常', // 确保有标签
								description: item.description || item.name, // 确保有描述
								is_favorite: false // 默认未收藏
							};
						});
					}
				} catch (e) {
					console.error('获取推荐失败', e);
				} finally {
					this.loading = false;
				}
			},
			refreshRecommendations() {
				// 简单的刷新逻辑：重新请求或打乱当前顺序
				this.recommendations = [];
				this.fetchRecommendations();
			},
			async toggleFav(item) {
				if (this.loadingFav) return;
				
				// 如果已经在处理或状态未变更，简单防抖
				const originalStatus = item.is_favorite;
				item.is_favorite = !item.is_favorite; // 乐观UI更新
				
				try {
					// 1. 如果是取消收藏
					if (originalStatus === true) {
						if (item.id) {
							await removeFavorite({
								userId: this.userId,
								itemType: 'outfit',
								itemId: item.id
							});
							uni.showToast({ title: '已取消收藏', icon: 'none' });
						}
						return;
					}

					// 2. 如果是添加收藏
					// 2.1 检查是否是已存在的穿搭 (有真实ID)
					let targetId = item.id;
					
					// 如果没有ID（说明是纯AI生成的临时推荐，未存库），先保存为穿搭
					if (!targetId || typeof targetId !== 'number') {
						uni.showLoading({ title: '保存中...' });
						
						// 构建自动布局 (简单的网格分布)
						const layoutItems = item.items.map((cloth, index) => {
							// 简单的 2x2 分布逻辑
							const row = Math.floor(index / 2);
							const col = index % 2;
							return {
								cloth_id: cloth.id,
								// 简单的位置计算: 0.25/0.75
								position_x: 0.25 + (col * 0.5), 
								position_y: 0.25 + (row * 0.5),
								scale: 0.4, // 默认缩小一点
								rotation: 0,
								z_index: index + 1,
								is_flipped: false
							};
						});

						const outfitData = {
							account: this.account, // 需要传入账号
							name: `灵感收藏 ${new Date().toLocaleDateString()}`,
							description: item.description || item.reason || '来自今日AI灵感推荐',
							items: layoutItems,
							bg_color: '#f7f8fa',
							weather: '晴', // 默认占位
							styles: [item.style], // 暂存风格标签
							// 新增：自动取第一件单品的图作为封面，确保收藏列表有图显示
							image_url: (item.items && item.items.length > 0) ? (item.items[0].image_url || item.items[0].image) : '',
							source: 'INSPIRATION' // 标记来源为灵感收藏，避免在穿搭方案列表中显示
						};
						
						const saveRes = await createOutfit(outfitData);
						if (saveRes.code === 200) {
							targetId = saveRes.data.id;
							item.id = targetId; // 回填ID，下次点击就是真实穿搭了
						} else {
							throw new Error(saveRes.msg || '保存穿搭失败');
						}
						uni.hideLoading();
					}

					// 2.2 添加到收藏表
					await addFavorite({
						userId: this.userId,
						itemType: 'outfit',
						itemId: targetId
					});
					
					uni.showToast({ title: '已收藏' });

				} catch (e) {
					console.error('收藏操作失败', e);
					item.is_favorite = originalStatus; // 回滚状态
					uni.showToast({ title: '操作失败', icon: 'none' });
				}
			},
			handleItemClick(item) {
				// 跳转到搭配详情页 (需确认详情页路由)
				uni.navigateTo({
					url: `/pages/outfit/detail?id=${item.id}`
				});
			}
		}
	}
</script>

<style lang="scss" scoped>
	.daily-rec-container {
		margin: 0; /* 移除外边距，由父级控制 */
		padding: 0; /* 移除内边距 */
		background-color: transparent; /* 背景透明，融入页面 */
		
		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 20rpx 0 30rpx 0; /* 稍微增加顶部 padding */
			
			.header-left {
				display: flex;
				align-items: center;
				gap: 16rpx;
				
				.title {
					font-size: 38rpx; /* 字体加大 */
					font-weight: 800; /* 加粗 */
					color: #111; /* 颜色加深 */
					letter-spacing: -1rpx;
				}
				
				.ai-tag {
					background: #EFECFF; /* 还原截图淡紫色背景 */
					padding: 6rpx 20rpx;
					border-radius: 30rpx;
					display: flex;
					align-items: center;
					
					text {
						font-size: 22rpx;
						color: #7232dd;
						font-weight: 600;
					}
				}
			}
			
			.header-right {
				display: flex;
				align-items: center;
				background: #fff;
				padding: 10rpx 24rpx;
				border-radius: 40rpx;
				border: 1px solid #f0f0f0; /* 增加灰色边框 */
				box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.02);
				
				.refresh-text {
					font-size: 26rpx;
					color: #666;
					margin-left: 8rpx;
					font-weight: 500;
				}
				
				&:active {
					background-color: #f9f9f9;
				}
			}
		}
		
		.loading-state {
			height: 400rpx;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			color: #999;
			font-size: 24rpx;
			gap: 20rpx;
			background: #fff;
			border-radius: 24rpx;
		}
		
		.rec-grid {
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			width: 100%;
		}

		.rec-card {
			width: 48%; /* 双列布局 */
			background-color: #fff;
			border-radius: 24rpx;
			overflow: hidden;
			box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
			margin-bottom: 24rpx; /* 底部间距 */
			position: relative;
			display: flex;
			flex-direction: column;

			.image-area {
				position: relative;
				width: 100%;
				padding-bottom: 100%; /* 保持正方形比例 */
				height: 0;
				background: #fdfdfd;
				
				/* 风格标签 */
				.style-tag {
					position: absolute;
					top: 20rpx;
					left: 20rpx;
					background: #fff;
					padding: 8rpx 20rpx;
					border-radius: 12rpx; /* 调整圆角使其更像截图 */
					z-index: 10;
					box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
					
					text {
						font-size: 22rpx;
						color: #333;
						font-weight: 600;
					}
				}
				
				/* 收藏按钮 */
				.fav-btn {
					position: absolute;
					bottom: 20rpx;
					right: 20rpx;
					width: 60rpx;
					height: 60rpx;
					background: #fff;
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 10;
					box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
				}

				.single-image {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
				}

				/* 四宫格拼图样式 */
				.collage-grid {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					display: flex;
					flex-wrap: wrap;
					padding: 8rpx;
					box-sizing: border-box;
					align-content: stretch; 
					
					.grid-item {
						width: 50%;
						height: 50%;
						padding: 4rpx;
						box-sizing: border-box;
						
						.grid-image {
							width: 100%;
							height: 100%;
							background-color: #f8f8f8;
						}
					}
				}
			}
			
			.card-info {
				padding: 20rpx;
				background: #fff;
				
				.desc-text {
					font-size: 26rpx;
					color: #333;
					line-height: 1.4;
					font-weight: 600;
					/* 单行截断 */
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					display: block;
				}
			}
		}

		.empty-state {
			height: 400rpx;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			color: #999;
			font-size: 24rpx;
			gap: 20rpx;
			background: #fff;
			border-radius: 24rpx;
		}
	}
</style>