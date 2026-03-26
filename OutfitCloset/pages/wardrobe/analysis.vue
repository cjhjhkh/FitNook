<template>
	<view class="analysis-page">
		 <!-- 自定义导航栏 (带 Chat 入口) -->
		<view class="custom-navbar">
			<view class="nav-title">统计面板</view>
			<view class="nav-right" @click="goToChat">
				<view class="chat-btn">
					<van-icon name="chat-o" size="20px" color="#fff" />
					<text class="chat-text">AI 顾问</text>
				</view>
			</view>
		</view>

		<!-- 顶部 分类统计圆盘图 (Canvas) -->
		<view class="chart-card">
			<view class="chart-header">
				<text class="title">数据统计</text>
                <!-- 切换Tabs -->
                <view class="header-tabs">
                    <text 
                        class="tab" 
                        :class="{ active: currentChartType === 'category' }"
                        @click="switchChartType('category')"
                    >种类</text>
                    <text 
                        class="tab" 
                        :class="{ active: currentChartType === 'scene' }"
                        @click="switchChartType('scene')"
                    >场景</text>
                    <text 
                        class="tab" 
                        :class="{ active: currentChartType === 'season' }"
                        @click="switchChartType('season')"
                    >季节</text>
                </view>
			</view>
			<view class="chart-box">
                <!-- 上方 图表 -->
                <view class="chart-container">
                    <canvas canvas-id="pieChart" id="pieChart" class="pie-canvas"></canvas>
                    <view class="center-text">
                        <!-- 总数根据当前类型的数据总和动态计算 -->
                        <text class="total-num">{{ currentTotalItems }}</text>
                        <text class="unit">件</text>
                    </view>
                </view>
                
                <!-- 下方 图例列表 (参考截图样式) -->
                <view class="legend-list">
                    <!-- 使用计算属性 currentChartData -->
                    <view v-for="(item, index) in currentChartData" :key="index" class="legend-row-item" @click="handleCategoryClick(item)">
                        <view class="left-section">
                            <view class="color-block" :style="{ backgroundColor: getCategoryColor(index) }"></view>
                            <text class="name">{{ item.name }}</text>
                        </view>
                        <view class="right-section">
                            <text class="count">{{ item.value }}</text>
                            <text class="percent">({{ item.percent }}%)</text>
                        </view>
                    </view>
                </view>
			</view>
		</view>

		<!-- 顶部 AI 诊断卡片 -->
		<view class="ai-card">
			<view class="card-header">
				<van-icon name="gem-o" color="#7232dd" size="20px" />
				<text class="title">AI 衱诊断</text>
			</view>
			<view class="ai-content">
				<text v-if="loading">正在分析您的穿搭数据...</text>
				<text v-else>{{ dashboardData.aiDiagnosis || '暂无诊断数据，快去添加衣物吧！' }}</text>
			</view>
			<image src="/static/image/ai-bg.png" mode="widthFix" class="bg-decoration" v-if="false" />
		</view>

		<!-- 核心指标 -->
		<view class="stats-grid">
			<view class="stat-item">
				<text class="num">{{ dashboardData.stats.totalItems || 0 }}</text>
				<text class="label">单品总数</text>
			</view>
			<view class="stat-item">
				<text class="num">¥{{ dashboardData.stats.totalValue || 0 }}</text>
				<text class="label">衣橱总值</text>
			</view>
			<view class="stat-item">
				<text class="num">{{ dashboardData.stats.totalOutfits || 0 }}</text>
				<text class="label">搭配方案</text>
			</view>
		</view>

		<!-- 色彩体系 -->
		<view class="section-card">
			<view class="section-title">色彩DNA</view>
			<view class="color-bars">
				<view v-for="(item, index) in dashboardData.colors" :key="index" class="color-row">
					<view class="color-circle" :style="{ backgroundColor: item.color }"></view>
					<text class="color-name">{{ item.name }}</text>
					<view class="progress-bg">
						<view class="progress-fill" :style="{ width: (item.percent * 100) + '%', backgroundColor: item.color }"></view>
					</view>
					<text class="percent">{{ (item.percent * 100).toFixed(0) }}%</text>
				</view>
				<view v-if="!dashboardData.colors || dashboardData.colors.length === 0" class="empty-tip">
					暂无颜色数据
				</view>
			</view>
		</view>

		<!-- 价值分析 CPW -->
		<view class="section-card">
			<view class="section-title">
				<text>价值分析 (CPW)</text>
				<van-icon name="question-o" @click="showCpwInfo" />
			</view>
			
			<view class="cpw-group">
				<view class="sub-title badge-green">🌟 值回票价 (Top 3)</view>
				<view v-for="item in dashboardData.cpw.best" :key="item.id" class="cpw-item">
					<image :src="item.image_url" mode="aspectFill" class="thumb" />
					<view class="info">
						<text class="name">{{ item.name }}</text>
						<text class="desc">穿过 {{ item.wearCount }} 次</text>
					</view>
					<view class="price">¥{{ item.cpw.toFixed(1) }}/次</view>
				</view>
				<view v-if="!dashboardData.cpw.best.length" class="empty-tip">多穿穿衣服就能看到这里啦</view>
			</view>

			<view class="divider"></view>

			<view class="cpw-group">
				<view class="sub-title badge-red">💸 闲置预警 (Top 3)</view>
				<view v-for="item in dashboardData.cpw.worst" :key="item.id" class="cpw-item">
					<image :src="item.image_url" mode="aspectFill" class="thumb" />
					<view class="info">
						<text class="name">{{ item.name }}</text>
						<text class="desc">购入价 ¥{{ item.price }}</text>
					</view>
					<view class="price">¥{{ item.cpw.toFixed(1) }}/次</view>
				</view>
				<view v-if="!dashboardData.cpw.worst.length" class="empty-tip">没有发现高价闲置，很棒！</view>
			</view>
		</view>

        <!-- AI 穿搭灵感推荐 (替换为组件) -->
        <!-- 移除 v-if，让组件内部处理空状态或未登录状态，确保板块默认展示 -->
        <daily-recommendation 
            :account="userInfo.account" 
            :userId="userInfo.id"
        />

		<view class="safe-area-bottom"></view>
	</view>
</template>

<script setup lang="ts">
import { ref, getCurrentInstance, nextTick, onMounted, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getDashboardData } from '@/api/analytics';
import DailyRecommendation from '@/component/daily-recommendation/daily-recommendation.vue'; // 引入组件

// 关键修复：在 setup 顶层获取组件实例，供异步回调使用
const instance = getCurrentInstance();

const loading = ref(true);
const userInfo = ref<any>(uni.getStorageSync('userInfo') || {}); // 获取用户信息
const currentChartType = ref('category'); // 当前图表类型: category | scene | season

const dashboardData = ref({
	stats: { totalItems: 0, totalValue: 0, totalOutfits: 0 },
	colors: [],
	categories: [], 
    seasons: [], // 新增
    scenes: [], // 新增
	cpw: { best: [], worst: [] },
	aiDiagnosis: ''
});

// 图表颜色盘 (扩充配色，避免重复)
const CHART_COLORS = ['#5B8FF9', '#5AD8A6', '#F6BD16', '#E8684A', '#6DC8EC', '#9270CA', '#FF9D4D', '#269A99', '#FF99C3'];

// 计算当前要展示的数据列表
const currentChartData = computed(() => {
    let list = [];
    if (currentChartType.value === 'category') list = dashboardData.value.categories || [];
    else if (currentChartType.value === 'season') list = dashboardData.value.seasons || [];
    else if (currentChartType.value === 'scene') list = dashboardData.value.scenes || [];
    return list;
});

// 计算当前列表的总数 (用于圆环中间显示)
const currentTotalItems = computed(() => {
    return currentChartData.value.reduce((sum, item: any) => sum + item.value, 0);
});

onShow(() => {
    // 每次显示页面时刷新用户信息，确保从缓存获取最新数据（例如用户刚登录或修改了头像）
    userInfo.value = uni.getStorageSync('userInfo') || {};
	loadData();
});

const goToChat = () => {
    uni.navigateTo({
        url: '/pages/chat/chat'
    });
};

const handleCategoryClick = (item: any) => {
    // 使用 Storage 传递参数，比 emit 更可靠，确保跳转后 onShow 能读到
    uni.setStorageSync('pending_filter_category', item.name);
    uni.switchTab({
        url: '/pages/wardrobe/index'
    });
};

const switchChartType = (type: string) => {
    currentChartType.value = type;
    nextTick(() => {
        drawPieChart(currentChartData.value);
    });
};

const getCategoryColor = (index: number) => {
    return CHART_COLORS[index % CHART_COLORS.length];
};

const loadData = async () => {
	try {
		loading.value = true;
        // 使用更新后的 userInfo.value
		if (!userInfo.value || !userInfo.value.id) return;

		const res: any = await getDashboardData(userInfo.value.id);
		if (res.code === 200) {
			// 数据映射适配
			const data = res.data;
            
            // 辅助函数：计算百分比
            const calcPercent = (list: any[]) => {
                const total = list.reduce((sum, item) => sum + item.value, 0) || 1;
                return list.map(item => ({
                    ...item,
                    percent: Math.round((item.value / total) * 100)
                }));
            };

            const categories = calcPercent(data.categories || []);
            const seasons = calcPercent(data.seasons || []);
            const scenes = calcPercent(data.scenes || []);

			dashboardData.value = {
				aiDiagnosis: data.aiDiagnosis,
				stats: data.summary || data.stats,  // 兼容后端不同字段名
				colors: data.colors,
                categories: categories,
                seasons: seasons,
                scenes: scenes,
				cpw: {
					best: data.cpw.best.map(fixImageField),
					worst: data.cpw.worst.map(fixImageField)
				}
			};

            // 数据加载完成后绘制图表
            nextTick(() => {
                drawPieChart(currentChartData.value); // 绘制当前选中的类型
            });
		}
	} catch (e) {
		console.error(e);
		uni.showToast({ title: '数据加载失败', icon: 'none' });
	} finally {
		loading.value = false;
	}
};

// 绘制 Canvas 环形图 (带引线和百分比)
const drawPieChart = (data: any[]) => {
    // 使用 setup 顶层捕获的 instance，避免在异步回调中 getCurrentInstance() 返回 null
    const ctx = uni.createCanvasContext('pieChart', instance);
    if (!ctx) return;
    
    // Canvas 尺寸 (对应 CSS: width 600rpx, height 400rpx)
    const width = 300;
    const height = 200;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 60;
    const lineWidth = 30;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 如果没有数据，绘制一个灰色空圆环
    if (!data || data.length === 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.setStrokeStyle('#F5F5F5'); // 浅灰色
        ctx.setLineWidth(lineWidth);
        ctx.stroke();
        ctx.draw();
        return;
    }

    let startAngle = -Math.PI / 2; // 从 12 点方向开始

    // 计算总值
    let totalVal = 0;
    data.forEach(item => totalVal += item.value);
    // 防止除以0
    if (totalVal === 0) totalVal = 1;

    data.forEach((item, index) => {
        const sliceAngle = (item.value / totalVal) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;
        const midAngle = startAngle + sliceAngle / 2; // 中间角度，用于引线
        const color = getCategoryColor(index);

        // 1. 绘制圆弧
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.setStrokeStyle(color);
        ctx.setLineWidth(lineWidth);
        ctx.stroke();

        // 2. 绘制引线和百分比 (仅当百分比 > 3% 时显示，避免重叠)
        if (item.percent > 3) {
            const lineLen1 = 15; // 第一段引线长度 (斜线)
            const lineLen2 = 20; // 第二段引线长度 (水平线)
            const textOffset = 5;

            // 起点：圆弧外侧
            const startX = centerX + (radius + lineWidth/2) * Math.cos(midAngle);
            const startY = centerY + (radius + lineWidth/2) * Math.sin(midAngle);
            
            // 拐点
            const midX = centerX + (radius + lineWidth/2 + lineLen1) * Math.cos(midAngle);
            const midY = centerY + (radius + lineWidth/2 + lineLen1) * Math.sin(midAngle);

            // 终点 (根据左右决定水平方向)
            const isRight = Math.cos(midAngle) >= 0;
            const endX = isRight ? midX + lineLen2 : midX - lineLen2;
            const endY = midY;

            // 绘制折线
            ctx.beginPath();
            ctx.setLineWidth(1);
            ctx.setStrokeStyle(color); // 引线颜色同扇区颜色
            ctx.moveTo(startX, startY);
            ctx.lineTo(midX, midY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // 绘制文字
            ctx.beginPath();
            ctx.setFontSize(12);
            ctx.setFillStyle('#666666');
            ctx.setTextAlign(isRight ? 'left' : 'right');
            ctx.setTextBaseline('middle');
            
            // 文本位置
            const textX = isRight ? endX + textOffset : endX - textOffset;
            ctx.fillText(`${item.percent}%`, textX, endY);
            
            // 绘制小圆点在引线末端 (装饰)
            ctx.beginPath();
            ctx.arc(endX, endY, 2, 0, 2 * Math.PI);
            ctx.setFillStyle(color);
            ctx.fill();
        }

        startAngle = endAngle;
    });

    ctx.draw();
};

// 辅助函数：修复后端返回字段不一致 (image -> image_url)
const fixImageField = (item: any) => {
	return {
		...item,
		image_url: item.image || item.image_url // 兼容 image 字段
	};
};

const showCpwInfo = () => {
	uni.showModal({
		title: '什么是 CPW？',
		content: 'CPW (Cost Per Wear) 即"单次穿着成本"。\n计算公式：购入价格 / 穿着次数。\n数值越低，说明这件衣服利用率越高，买得越值！',
		showCancel: false
	});
};
</script>

<style lang="scss" scoped>
.analysis-page {
	min-height: 100vh;
	background-color: #f7f8fa;
	padding: 30rpx;
	padding-bottom: 60rpx;
    padding-top: 100rpx; /* 留出导航栏高度 */
}

/* 自定义导航栏 */
.custom-navbar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 90rpx; /* 小程序标准高度 */
    // padding-top: var(--status-bar-height);
    padding-top: 80rpx; /* 简单的适配，实际开发通常获取系统状态栏高度 */
    background: #7232dd;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-left: 30rpx;
    padding-right: 30rpx;
    z-index: 999;
    box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.1);
    box-sizing: content-box;

    .nav-title {
        color: #fff;
        font-size: 34rpx;
        font-weight: bold;
    }

    .nav-right {
        .chat-btn {
            display: flex;
            align-items: center;
            background: rgba(255,255,255,0.2);
            padding: 10rpx 24rpx;
            border-radius: 30rpx;
            
            .chat-text {
                color: #fff;
                font-size: 24rpx;
                margin-left: 10rpx;
            }
        }
    }
}

/* 图表卡片 */
.chart-card {
    background: #fff;
    border-radius: 20rpx;
    padding: 30rpx;
    margin-bottom: 30rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
    margin-top: 50rpx; // 避开 fixed navbar

    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30rpx;
        
        .title {
            font-size: 34rpx;
            font-weight: bold;
            color: #333;
        }

        .header-tabs {
            background: #f0f0f0;
            border-radius: 24rpx;
            padding: 4rpx;
            display: flex;
            
            .tab {
                font-size: 24rpx;
                padding: 6rpx 20rpx;
                border-radius: 20rpx;
                color: #666;
                
                &.active {
                    background: #5b8ff9; // 蓝色高亮
                    color: #fff;
                    font-weight: bold;
                }
            }
        }
    }

    .chart-box {
        display: flex;
        flex-direction: column; /* 改为垂直排列，模仿参考图 */
        align-items: center;
        padding: 10rpx 0;
    }

    .chart-container {
        position: relative;
        width: 100%; 
        height: 440rpx; /* 增加高度以容纳引线 */
        margin-bottom: 20rpx;
        display: flex;
        justify-content: center;
        align-items: center;
        
        .pie-canvas {
            width: 600rpx; /* 增加宽度 */
            height: 400rpx;
        }

        .center-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            display: flex;
            flex-direction: column;
            pointer-events: none;
            
            .total-num {
                font-size: 48rpx;
                font-weight: bold;
                color: #333;
                line-height: 1;
            }
            .unit {
                font-size: 24rpx;
                color: #999;
                margin-top: 6rpx;
            }
        }
    }

    .legend-list {
        width: 100%;
        display: flex;
        flex-direction: column;
        
        .legend-row-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20rpx 0;
            border-bottom: 1rpx solid #f9f9f9;
            
            &:last-child {
                border-bottom: none;
            }

            .left-section {
                display: flex;
                align-items: center;
                
                .color-block {
                    width: 24rpx; /* 稍大一点 */
                    height: 24rpx;
                    border-radius: 6rpx; /* 方形圆角，参考图是方形 */
                    margin-right: 20rpx;
                }
                
                .name {
                    font-size: 28rpx;
                    color: #333;
                }
            }
            
            .right-section {
                font-size: 26rpx;
                color: #666;
                text-align: right;
                margin-left: 20rpx;
                white-space: nowrap;
                
                .count {
                    font-weight: bold;
                    color: #333;
                    margin-right: 8rpx;
                }
                
                .percent {
                    color: #999;
                    font-size: 22rpx;
                }
            }
        }
    }
}

.ai-card {
	background: linear-gradient(135deg, #f3e7ff 0%, #e6d6ff 100%);
	border-radius: 20rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: 0 4rpx 12rpx rgba(114, 50, 221, 0.1);
	position: relative;
	overflow: hidden;

	.card-header {
		display: flex;
		align-items: center;
		margin-bottom: 20rpx;
		
		.title {
			font-size: 30rpx;
			font-weight: bold;
			color: #5b2c9d;
			margin-left: 10rpx;
		}
	}

	.ai-content {
		font-size: 28rpx;
		color: #4a4a4a;
		line-height: 1.6;
		position: relative;
		z-index: 1;
	}
}

.stats-grid {
	display: flex;
	justify-content: space-between;
	background: #fff;
	padding: 30rpx 0;
	border-radius: 16rpx;
	margin-bottom: 30rpx;
	box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.03);

	.stat-item {
		flex: 1;
		text-align: center;
    }
}

.section-card {
	background: #fff;
	border-radius: 16rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.03);

	.section-title {
		font-size: 30rpx;
		font-weight: bold;
		color: #333;
		margin-bottom: 30rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
}

.color-row {
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;

	.color-circle {
		width: 24rpx;
		height: 24rpx;
		border-radius: 50%;
		border: 1px solid #eee;
		margin-right: 16rpx;
	}
	
	.color-name {
		width: 80rpx;
		font-size: 26rpx;
		color: #666;
	}

	.progress-bg {
		flex: 1;
		height: 12rpx;
		background: #f5f5f5;
		border-radius: 6rpx;
		margin: 0 20rpx;
		overflow: hidden;
		
		.progress-fill {
			height: 100%;
			border-radius: 6rpx;
		}
	}

	.percent {
		font-size: 24rpx;
		color: #999;
		width: 60rpx;
		text-align: right;
	}
}

.cpw-group {
	.sub-title {
		font-size: 24rpx;
		display: inline-block;
		padding: 4rpx 12rpx;
		border-radius: 8rpx;
		margin-bottom: 20rpx;
	}
	
	.badge-green { background: #e6fffa; color: #00bfa5; }
	.badge-red { background: #fff0f0; color: #ff5252; }

	.cpw-item {
		display: flex;
		align-items: center;
		margin-bottom: 20rpx;

		.thumb {
			width: 80rpx;
			height: 80rpx;
			border-radius: 8rpx;
			background: #f9f9f9;
			margin-right: 20rpx;
		}

		.info {
			flex: 1;
			.name {
				font-size: 28rpx;
				color: #333;
				display: block;
				margin-bottom: 4rpx;
			}
			.desc {
				font-size: 22rpx;
				color: #999;
			}
		}

		.price {
			font-size: 28rpx;
			font-weight: bold;
			color: #333;
		}
	}
}

.divider {
	height: 1px;
	background: #eee;
	margin: 30rpx 0;
}

.empty-tip {
	text-align: center;
	color: #ccc;
	font-size: 24rpx;
	padding: 20rpx 0;
}
</style>