<template>
	<view class="container">
        <!-- 新增：页面大标题 -->
        <view class="page-header">
            <text class="page-title">灵感</text>
        </view>

		<!-- 1. 数据看板 (Dashboard) - 登录后置顶显示 -->
		<block v-if="hasLogin">
			<view class="section-card dashboard-card">
				<view class="section-header">
					<text class="title">统计面板</text>
				</view>
				
                <!-- 新增：迷你切换 Tabs -->
                <view class="mini-tabs">
                    <view 
                        class="tab-item" 
                        :class="{ active: currentStatType === 'category' }"
                        @tap="switchStatType('category')"
                    >种类</view>
                    <view 
                        class="tab-item" 
                        :class="{ active: currentStatType === 'scene' }"
                        @tap="switchStatType('scene')"
                    >场景</view>
                    <view 
                        class="tab-item" 
                        :class="{ active: currentStatType === 'season' }"
                        @tap="switchStatType('season')"
                    >季节</view>
                </view>

				<view class="stats-container">
					<!-- 左侧：圆盘图 -->
					<view class="pie-chart-wrapper">
						<view class="pie-chart" :style="getPieChartStyle"></view>
						<view class="chart-center">
							<text class="center-num">{{ currentTotal }}</text>
							<text class="center-label">件</text>
						</view>
					</view>
					
					<!-- 右侧：分类数据列表 (改造成 Top 3 分类 + 百分比) -->
					<view class="stats-list">
                        <!-- 如果有分类数据，显示分类列表 -->
                        <block v-if="currentTopStats && currentTopStats.length > 0">
                            <view v-for="(item, index) in currentTopStats" :key="index" class="stat-row simple-row">
                                <view class="left-info">
                                    <view class="color-dot" :style="{ backgroundColor: item.color }"></view>
                                    <text class="label">{{ item.name }}</text>
                                </view>
                                <text class="value">{{ item.percent }}%</text>
                            </view>
                        </block>
                        
                        <!-- 否则显示兜底数据 -->
                        <block v-else>
                            <view class="stat-row">
                                <text class="label">搭配方案</text>
                                <text class="value">{{ dashboardData.stats?.totalOutfits || 0 }}</text>
                            </view>
                             <view class="divider-h"></view>
                            <view class="stat-row">
                                <text class="label">资产总值</text>
                                <text class="value">¥{{ dashboardData.stats?.totalValue || 0 }}</text>
                            </view>
                        </block>

                        <!-- 底部补充信息 -->
                        <view class="micro-metrics">
                             <text>总值 ¥{{ dashboardData.stats?.totalValue || 0 }}</text>
                             <text class="divider">|</text>
                             <text>搭配 {{ dashboardData.stats?.totalOutfits || 0 }}</text>
                        </view>
					</view>
				</view>
			</view>

            <!-- 1.5 AI 分析卡片 (从分析页移入) -->
            <view class="ai-card section-card">
                <view class="card-header">
                    <van-icon name="gem-o" color="#7232dd" size="20px" />
                    <text class="title">AI 分析 ({{ currentStatTypeLabel }})</text>
                </view>
                <view class="ai-content">
                    <text class="ai-text">{{ currentAiDiagnosis }}</text>
                </view>
            </view>
		</block>

		<!-- 2. AI 唤醒区 (样式优化) -->
		<view class="ai-section">
			<view class="ai-search-bar" @tap="goToChat('')">
                <van-icon name="chat-o" size="20" color="#666" style="margin-right: 16rpx;" />
				<text class="placeholder">Hi, 今天想怎么穿？问问 AI 吧...</text>
				<view class="action-btn">
					<van-icon name="arrow" size="14" color="#fff" />
				</view>
			</view>
		</view>

        <!-- 3. 核心功能区：今日 AI 推荐 (真实数据) -->
        <block v-if="hasLogin">
            <!-- 引入组件：自动根据用户ID加载推荐 -->
            <daily-recommendation :userId="userInfo.id" :account="userInfo.account" />
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
import { getDashboardStats } from '@/api/analytics';
// 引入组件
import DailyRecommendation from '@/component/daily-recommendation/daily-recommendation.vue';

export default {
    components: {
        DailyRecommendation
    },
	data() {
		return {
			hasLogin: false,
			userInfo: null,
            currentStatType: 'category', // category | scene | season
			dashboardData: {
				stats: { totalItems: 0, totalOutfits: 0, totalValue: 0 },
				colors: [],
				categories: [],
                scenes: [],
                seasons: [],
                aiDiagnosis: '' // 字段名保持不变，界面显示改为分析
			}
		};
	},
    computed: {
        // 当前使用的数据源
        currentList() {
            if (this.currentStatType === 'scene') return this.dashboardData.scenes || [];
            if (this.currentStatType === 'season') return this.dashboardData.seasons || [];
            return this.dashboardData.categories || [];
        },
        // 动态计算当前维度的总数 (因为场景/季节可能有重叠或空缺，建议重新累加或使用 totalItems)
        currentTotal() {
             // 简单起见，这里展示列表的总和作为分母，确保百分比加起来是 100% 左右（或者是 dashboardData.stats.totalItems 如果追求绝对总数）
             // 为了圆环和百分比的一致性，使用列表项之和作为分母
             const list = this.currentList;
             if (!list.length) return 0;
             return list.reduce((sum, item) => sum + item.value, 0);
        },
        // 计算前八名及百分比
        currentTopStats() {
            const list = this.currentList;
            const total = this.currentTotal;
            
            if (!list.length || total === 0) {
                return [];
            }

            // 配色方案
            const colors = ['#7232dd', '#3c9cff', '#ff976a', '#07c160', '#ffd21e', '#ee0a24'];

            // 改为展示前8个，并确保循环使用颜色
            return list.slice(0, 8).map((item, index) => {
                let percent = 0;
                if (total > 0) {
                    percent = Math.round((item.value / total) * 100);
                }
                return {
                    name: item.name,
                    value: item.value,
                    percent: percent,
                    color: colors[index % colors.length]
                };
            });
        },
        // 新增：当前统计类型的中文标签
        currentStatTypeLabel() {
            const map = {
                category: '种类',
                scene: '场景',
                season: '季节'
            };
            return map[this.currentStatType] || '智能';
        },
        // 新增：获取当前维度的 AI 建议
        currentAiDiagnosis() {
            const diagnosis = this.dashboardData.aiDiagnosis;
            
            // 1. 无数据 (加载中或空状态)
            if (!diagnosis) return 'FitNook AI 正在分析您的衣橱数据...';
            
            // 2. 兼容旧数据或错误信息（字符串类型）
            if (typeof diagnosis === 'string') return diagnosis;
            
            // 3. 对象类型，取对应字段
            // 后端返回字段: category, scene, season
            const advice = diagnosis[this.currentStatType];
            return advice || `AI 正在生成${this.currentStatTypeLabel}维度的建议，请稍等...`;
        },
        // Helper to generate conic-gradient string
		getPieChartStyle() {
			const list = this.currentList;
			const total = this.currentTotal;
			
			if (!list.length || total === 0) {
				return 'background: #eee';
			}

			let gradientString = '';
			let currentPercent = 0;
			const colors = ['#7232dd', '#3c9cff', '#ff976a', '#07c160', '#ffd21e', '#ee0a24'];

            // 修改：与列表保持一致，取前 8 个
			list.slice(0, 8).forEach((item, index) => {
				const percent = (item.value / total) * 100;
				const endPercent = currentPercent + percent;
				const color = colors[index % colors.length];
				
				gradientString += `${color} ${currentPercent}% ${endPercent}%, `;
				currentPercent = endPercent;
			});

			// Fill rest with grey if any gap
			if (currentPercent < 100) {
				gradientString += `#eee ${currentPercent}% 100%`;
			} else {
				gradientString = gradientString.replace(/, $/, '');
			}

			return `background: conic-gradient(${gradientString})`;
		}
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
			
            // 仅加载 dashboard 数据，推荐数据由组件内部自行加载
			try {
				const dashRes = await getDashboardStats(this.userInfo.id);
				if (dashRes.code === 200) {
                    // 兼容处理：确保 stats 字段存在，后端有时返回 summary
                    const data = dashRes.data || {};
					this.dashboardData = {
                        ...data,
                        categories: data.categories || [],
                        // 修正：后端直接返回了 [{name: 'xx', value: 1}] 格式的对象数组，无需再次解析
                        scenes: data.scenes || [],
                        seasons: data.seasons || [],
                        stats: data.summary || data.stats || { totalItems: 0, totalOutfits: 0, totalValue: 0 },
                        // 确保 aiDiagnosis 存在
                        aiDiagnosis: data.aiDiagnosis || ''
                    };
				}
			} catch (error) {
				console.error('Fetch home data failed:', error);
			}
		},
        switchStatType(type) {
            this.currentStatType = type;
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
	padding: 30rpx;
	/* 统一增加顶部间距，适配状态栏 */
	/* 修改：增加顶部空间，从 120rpx 改为 160rpx */
	padding-top: 160rpx; 
	background-color: #f7f8fa;
	min-height: 100vh;
}

/* Page Header */
.page-header {
    margin-bottom: 40rpx;
    padding-left: 10rpx;
    
    .page-title {
        font-size: 48rpx;
        font-weight: 800;
        color: #333;
        letter-spacing: 2rpx;
        position: relative;
        
        &::after {
            content: '';
            position: absolute;
            bottom: -6rpx;
            left: 0;
            width: 60rpx;
            height: 6rpx;
            background: linear-gradient(90deg, #7232dd, #a480f2);
            border-radius: 3rpx;
        }
    }
}

/* Section Card Common */
.section-card {
	background: #fff;
	border-radius: 32rpx; /* 更圆润 */
	padding: 40rpx;
	margin-bottom: 40rpx;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.03); /* 更柔和的阴影 */
    transition: transform 0.2s ease;
    
    &:active {
        transform: scale(0.995);
    }
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30rpx;
	
	.title {
		font-size: 34rpx; /* 加大标题 */
		font-weight: 700;
		color: #1a1a1a;
        letter-spacing: 1rpx;
	}
}

/* 1. Dashboard Styles */
.dashboard-card {
    /* 迷你 Tabs (胶囊样式) */
    .mini-tabs {
        display: flex;
        background: #f5f6f8;
        padding: 8rpx;
        border-radius: 20rpx;
        margin-bottom: 40rpx;
        
        .tab-item {
            flex: 1;
            text-align: center;
            font-size: 26rpx;
            color: #666;
            padding: 14rpx 0;
            border-radius: 14rpx;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            
            &.active {
                background: #fff;
                color: #7232dd;
                font-weight: 600;
                box-shadow: 0 4rpx 12rpx rgba(114, 50, 221, 0.1);
                transform: scale(1.02);
            }
        }
    }

    .stats-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        
        /* 左侧圆环 */
        .pie-chart-wrapper {
            position: relative;
            width: 220rpx;
            height: 220rpx;
            
            .pie-chart {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                // mask: radial-gradient(transparent 60%, #000 61%); 
                // 也可以用伪元素遮挡
            }
             /* 中心遮罩营造圆环效果 */
            &::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 70%;
                height: 70%;
                background: #fff;
                border-radius: 50%;
                transform: translate(-50%, -50%);
            }
            
            .chart-center {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 2;
                display: flex;
                flex-direction: column;
                
                .center-num {
                    font-size: 40rpx;
                    font-weight: bold;
                    color: #333;
                    line-height: 1;
                }
                .center-label {
                    font-size: 20rpx;
                    color: #999;
                    margin-top: 4rpx;
                }
            }
        }
        
        /* 右侧列表 */
        .stats-list {
            flex: 1;
            padding-left: 40rpx;
            
            .stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24rpx;
                
                &:last-child {
                    margin-bottom: 0;
                }
                
                .left-info {
                     display: flex;
                     align-items: center;
                     
                     .color-dot {
                         width: 16rpx;
                         height: 16rpx;
                         border-radius: 50%;
                         margin-right: 16rpx;
                     }
                     
                     .label {
                         font-size: 26rpx;
                         color: #555;
                     }
                }

                .value {
                    font-size: 28rpx;
                    font-weight: 600;
                    color: #333;
                }
            }
            
            .micro-metrics {
                margin-top: 30rpx;
                padding-top: 20rpx;
                border-top: 2rpx dashed #eee;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 22rpx;
                color: #999;
                
                .divider {
                    margin: 0 16rpx;
                    color: #ddd;
                }
            }
        }
    }
}

/* 2. AI Card Styles (优化阅读体验) */
.ai-card {
    background: linear-gradient(135deg, #fff 0%, #fbf9ff 100%);
    border: 2rpx solid rgba(114, 50, 221, 0.05);

    .card-header {
        display: flex;
        align-items: center;
        margin-bottom: 24rpx;
        padding-bottom: 20rpx;
        border-bottom: 2rpx solid rgba(114, 50, 221, 0.05);
        
        .title {
            font-size: 30rpx;
            font-weight: 700;
            color: #333;
            margin-left: 16rpx;
        }
    }
    
    .ai-content {
        .ai-text {
            font-size: 28rpx;
            color: #4a4a4a; /* 加深颜色，提高对比度 */
            line-height: 1.85; /* 增加行高，提升可读性 */
            letter-spacing: 0.5rpx; /* 增加字间距 */
            text-align: justify; /* 两端对齐 */
            display: block; /* 确保块级显示 */
        }
    }
}

/* 3. AI Search Bar (Fixed at bottom or floating?) -> No, it's a section */
.ai-section {
    margin-bottom: 40rpx;
    
    .ai-search-bar {
        background: #fff;
        height: 100rpx;
        border-radius: 50rpx;
        display: flex;
        align-items: center;
        padding: 0 32rpx;
        box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.04);
        border: 2rpx solid transparent;
        transition: all 0.3s;
        
        &:active {
             border-color: #7232dd;
             background: #fbf9ff;
        }

        .placeholder {
            flex: 1;
            font-size: 28rpx;
            color: #999;
        }
        
        .action-btn {
            width: 60rpx;
            height: 60rpx;
            background: linear-gradient(135deg, #7232dd, #a480f2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4rpx 12rpx rgba(114, 50, 221, 0.3);
        }
    }
}

/* Empty State */
.empty-state {
    padding: 100rpx 0;
    display: flex;
    justify-content: center;
}
</style>