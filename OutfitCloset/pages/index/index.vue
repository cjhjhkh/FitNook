<template>
	<view class="container">
		<!-- 1. 顶部 AI 唤醒区 -->
		<view class="ai-header">
			<view class="greeting">
				<text class="h1">搭配灵感</text>
				<text class="sub">让 AI 为你寻找穿搭方案</text>
			</view>
			<view class="ai-input-trigger" @tap="goToChat('')">
				<view class="avatar-wrapper">
					<image src="/static/logo.png" mode="aspectFill" class="ai-avatar" />
					<view class="status-dot"></view>
				</view>
				<view class="placeholder-text">
					<text>明天去面试，穿什么得体？</text>
				</view>
				<view class="go-icon">
					<van-icon name="guide-o" size="20" color="#1989fa" />
				</view>
			</view>
		</view>

		<block v-if="hasLogin">
			<!-- 2. 数据看板 (Dashboard) -->
			<view class="section-card dashboard-card">
				<view class="section-header">
					<text class="title">我的衣橱</text>
					<text class="more" @tap="goToWardrobe">管理</text>
				</view>
				
				<view class="stats-row">
					<view class="stat-item">
						<text class="num">{{ dashboardData.stats?.totalItems || 0 }}</text>
						<text class="label">单品</text>
					</view>
					<view class="divider"></view>
					<view class="stat-item">
						<text class="num">{{ dashboardData.stats?.totalOutfits || 0 }}</text>
						<text class="label">搭配</text>
					</view>
					<view class="divider"></view>
					<view class="stat-item">
						<text class="num">¥{{ dashboardData.stats?.totalValue || 0 }}</text>
						<text class="label">总价值</text>
					</view>
				</view>

				<!-- 颜色分布简报 -->
				<view class="color-bar-chart" v-if="dashboardData.colors && dashboardData.colors.length">
					<view class="chart-label">常穿色系</view>
					<view class="bars">
						<view 
							v-for="(color, index) in dashboardData.colors" 
							:key="index"
							class="bar-item"
							:style="{ width: (color.percent * 100) + '%', backgroundColor: color.color }"
						></view>
					</view>
					<view class="legend">
						<text v-for="(color, index) in dashboardData.colors.slice(0, 3)" :key="index">
							{{ color.name }} {{ (color.percent * 100).toFixed(0) }}%
						</text>
					</view>
				</view>
			</view>

			<!-- 3. 今日推荐 (横向滚动) -->
			<view class="section-title" v-if="recommendations.recommend.length">今日推荐</view>
			<scroll-view scroll-x class="recommend-scroll" v-if="recommendations.recommend.length">
				<view class="scroll-inner">
					<view 
						class="recommend-card" 
						v-for="item in recommendations.recommend" 
						:key="item.id"
						@tap="handleCardClick(item)"
					>
						<image :src="item.image_url" mode="aspectFill" class="card-bg" />
						<view class="card-overlay">
							<view class="tags">
								<text class="tag" v-for="tag in item.tags" :key="tag">{{ tag }}</text>
							</view>
							<text class="card-title">{{ item.title }}</text>
							<text class="card-reason">{{ item.reason }}</text>
						</view>
					</view>
				</view>
			</scroll-view>

			<!-- 4. 风格探索 (Grid) -->
			<view class="section-title" v-if="recommendations.explore.length">风格探索</view>
			<view class="explore-grid" v-if="recommendations.explore.length">
				<view 
					class="explore-item" 
					v-for="item in recommendations.explore" 
					:key="item.id"
					@tap="goToChat(`我想尝试${item.title}风格`)"
				>
					<image :src="item.image_url" mode="aspectFill" class="explore-img" />
					<view class="explore-info">
						<text class="explore-title">{{ item.title }}</text>
						<text class="explore-sub">{{ item.style }}</text>
					</view>
				</view>
			</view>
		</block>

		<!-- 未登录状态 -->
		<view class="empty-state" v-else>
			<van-empty description="登录后开启智能衣橱">
				<van-button round type="primary" @click="goToLogin">去登录</van-button>
			</van-empty>
		</view>

		<!-- 底部占位，防止 TabBar 遮挡 -->
		<view style="height: 100px;"></view>
	</view>
</template>

<script>
import { getDashboardStats, getRecommendations } from '@/api/analytics';

export default {
	data() {
		return {
			hasLogin: false,
			userInfo: null,
			dashboardData: {
				stats: { totalItems: 0, totalOutfits: 0, totalValue: 0 },
				colors: []
			},
			recommendations: {
				recommend: [],
				explore: []
			}
		};
	},
	onShow() {
		this.checkLogin();
	},
	methods: {
		checkLogin() {
			const userInfo = uni.getStorageSync('userInfo');
			if (userInfo) {
				this.hasLogin = true;
				this.userInfo = userInfo;
				this.fetchData();
			} else {
				this.hasLogin = false;
				this.userInfo = null;
			}
		},
		async fetchData() {
			if (!this.userInfo || !this.userInfo.id) return;
			
			uni.showLoading({ title: '加载中...' });
			try {
				const [dashRes, recRes] = await Promise.all([
					getDashboardStats(this.userInfo.id),
					getRecommendations()
				]);
				
				if (dashRes.code === 200) {
					this.dashboardData = dashRes.data;
				}
				if (recRes.code === 200) {
					this.recommendations = recRes.data;
				}
			} catch (error) {
				console.error('Fetch home data failed:', error);
			} finally {
				uni.hideLoading();
			}
		},
		goToChat(prompt) {
			uni.navigateTo({
				url: `/pages/chat/chat?prompt=${encodeURIComponent(prompt || '')}`
			});
		},
		goToWardrobe() {
			uni.switchTab({
				url: '/pages/wardrobe/index'
			});
		},
		goToLogin() {
			uni.navigateTo({
				url: '/pages/login/login'
			});
		},
		handleCardClick(item) {
			// 点击推荐卡片，可以直接去详情，或者触发聊天对话
			this.goToChat(`看看这个推荐：${item.title}，怎么搭配？`);
		}
	}
};
</script>

<style lang="scss">
.container {
	padding: 0 32rpx;
	background-color: #f7f8fa;
	min-height: 100vh;
}

/* AI Header */
.ai-header {
	padding-top: 80rpx; // 适配不同机型状态栏，实际开发建议用 padding-top: var(--status-bar-height)
	margin-bottom: 40rpx;
	
	.greeting {
		margin-bottom: 30rpx;
		.h1 {
			display: block;
			font-size: 48rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 8rpx;
		}
		.sub {
			font-size: 28rpx;
			color: #999;
		}
	}
	
	.ai-input-trigger {
		background: #fff;
		border-radius: 24rpx;
		padding: 20rpx;
		display: flex;
		align-items: center;
		box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
		transition: all 0.3s;
		
		&:active {
			transform: scale(0.98);
		}

		.avatar-wrapper {
			position: relative;
			margin-right: 20rpx;
			.ai-avatar {
				width: 80rpx;
				height: 80rpx;
				border-radius: 50%;
				background: #eee;
			}
			.status-dot {
				position: absolute;
				bottom: 4rpx;
				right: 4rpx;
				width: 16rpx;
				height: 16rpx;
				background: #07c160;
				border: 2rpx solid #fff;
				border-radius: 50%;
			}
		}

		.placeholder-text {
			flex: 1;
			font-size: 28rpx;
			color: #666;
		}
		
		.go-icon {
			padding: 10rpx;
		}
	}
}

/* Section Card Common */
.section-card {
	background: #fff;
	border-radius: 24rpx;
	padding: 30rpx;
	margin-bottom: 40rpx;
	box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.03);
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30rpx;
	
	.title {
		font-size: 32rpx;
		font-weight: bold;
		color: #333;
	}
	.more {
		font-size: 26rpx;
		color: #999;
	}
}

/* Stats Row */
.stats-row {
	display: flex;
	justify-content: space-around;
	align-items: center;
	margin-bottom: 30rpx;
	
	.stat-item {
		text-align: center;
		.num {
			display: block;
			font-size: 40rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 8rpx;
		}
		.label {
			font-size: 24rpx;
			color: #999;
		}
	}
	.divider {
		width: 2rpx;
		height: 40rpx;
		background: #eee;
	}
}

/* Color Bar Chart */
.color-bar-chart {
	background: #f9f9f9;
	border-radius: 12rpx;
	padding: 20rpx;
	
	.chart-label {
		font-size: 24rpx;
		color: #666;
		margin-bottom: 12rpx;
	}
	.bars {
		display: flex;
		height: 20rpx;
		border-radius: 10rpx;
		overflow: hidden;
		margin-bottom: 12rpx;
		.bar-item {
			height: 100%;
		}
	}
	.legend {
		display: flex;
		gap: 20rpx;
		font-size: 22rpx;
		color: #999;
	}
}

/* Section Title */
.section-title {
	font-size: 34rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 24rpx;
	padding-left: 10rpx;
}

/* Recommend Scroll */
.recommend-scroll {
	width: 100%;
	white-space: nowrap;
	margin-bottom: 40rpx;

	.scroll-inner {
		padding-right: 32rpx; // end padding
	}

	.recommend-card {
		display: inline-block;
		width: 600rpx;
		height: 320rpx;
		margin-right: 24rpx;
		border-radius: 24rpx;
		overflow: hidden;
		position: relative;
		
		.card-bg {
			width: 100%;
			height: 100%;
		}
		
		.card-overlay {
			position: absolute;
			bottom: 0;
			left: 0;
			width: 100%;
			padding: 30rpx;
			background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
			color: #fff;
			
			.tags {
				margin-bottom: 12rpx;
				.tag {
					display: inline-block;
					padding: 4rpx 12rpx;
					background: rgba(255,255,255,0.2);
					border-radius: 8rpx;
					font-size: 20rpx;
					margin-right: 12rpx;
					backdrop-filter: blur(4px);
				}
			}
			
			.card-title {
				display: block;
				font-size: 32rpx;
				font-weight: bold;
				margin-bottom: 8rpx;
			}
			
			.card-reason {
				font-size: 24rpx;
				opacity: 0.9;
			}
		}
	}
}

/* Explore Grid */
.explore-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 24rpx;
	padding-bottom: 40rpx;
	
	.explore-item {
		background: #fff;
		border-radius: 16rpx;
		overflow: hidden;
		box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
		
		.explore-img {
			width: 100%;
			height: 300rpx;
		}
		
		.explore-info {
			padding: 20rpx;
			
			.explore-title {
				display: block;
				font-size: 28rpx;
				font-weight: bold;
				color: #333;
				margin-bottom: 4rpx;
			}
			.explore-sub {
				font-size: 22rpx;
				color: #999;
			}
		}
	}
}

.empty-state {
	margin-top: 100rpx;
}
</style>