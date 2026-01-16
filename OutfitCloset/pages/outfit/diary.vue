<template>
	<view class="diary-page">
		<!-- 日历区域 -->
		<view class="calendar-card">
			<!-- 头部：月份切换 -->
			<view class="calendar-header">
				<view class="arrow-btn" @tap="changeMonth(-1)">
					<van-icon name="arrow-left" />
				</view>
				<text class="current-month">{{ currentYear }}年 {{ currentMonth }}月</text>
				<view class="arrow-btn" @tap="changeMonth(1)">
					<van-icon name="arrow" />
				</view>
			</view>

			<!-- 星期表头 -->
			<view class="week-header">
				<text v-for="day in weekDays" :key="day" class="week-day">{{ day }}</text>
			</view>

			<!-- 日期网格 -->
			<view class="days-grid">
				<!-- 空白占位 -->
				<view v-for="empty in firstDayOfWeek" :key="'empty-' + empty" class="day-cell empty"></view>
				<!-- 实际日期 -->
				<view v-for="date in daysInMonth" :key="date" class="day-cell"
					:class="{ 
						'is-today': isToday(date), 
						'is-selected': isSelected(date) 
					}"
					@tap="selectDate(date)">
					<text class="date-num">{{ date }}</text>
					<!-- 穿搭标记点 -->
					<view v-if="hasOutfit(date)" class="dot-marker"></view>
				</view>
			</view>
		</view>

		<!-- 选中日期的穿搭列表 -->
		<view class="daily-section">
			<view class="section-header">
				<text class="title">{{ selectedDateStr }}</text>
				<text class="subtitle">{{ getWeekDayStr(selectedDate) }}</text>
			</view>

			<view v-if="currentOutfits.length > 0" class="outfit-list">
				<view v-for="(item, index) in currentOutfits" :key="index" class="outfit-item">
						<view class="outfit-cover-wrapper" :style="{ background: item.bg_color || '#f5f5f5' }">
							<image :src="item.cover" mode="aspectFit" class="outfit-cover" />
						</view>
					<view class="outfit-info" @tap="goToDetail(item.outfit_id)">
						<text class="outfit-name">{{ item.name }}</text>
						<view class="tags">
							<van-tag plain type="primary" size="mini" v-if="item.scene" custom-class="mr-1">{{ item.scene }}</van-tag>
                            <van-tag plain type="warning" size="mini" v-if="item.temperature">{{ item.temperature }}</van-tag>
						</view>
					</view>
					<view class="action-btn" @tap.stop="removeOutfit(item)">
						<van-icon name="delete-o" color="#999" />
					</view>
				</view>
			</view>
			
			<view v-else class="empty-state">
				<text>今天还没有安排穿搭哦~</text>
			</view>

			<!-- 添加按钮 -->
			<view class="add-btn-container">
				<van-button round block type="info" icon="plus" @click="onAddClick">
					添加穿搭计划
				</van-button>
			</view>
		</view>
		
		<!-- 简单的选择弹窗 (模拟) -->
		<van-action-sheet
			:show="showAddSheet"
			:actions="addActions"
			cancel-text="取消"
			@close="showAddSheet = false"
			@cancel="showAddSheet = false"
			@select="onSelectAddAction"
		/>

		<!-- 搭配选择弹窗 -->
		<van-popup 
			:show="showSelection" 
			position="bottom" 
			round
			custom-style="height: 70%;" 
			@close="showSelection = false"
		>
			<view class="selection-popup">
				<view class="popup-header">
					<text>选择搭配</text>
					<van-icon name="cross" @tap="showSelection = false" />
				</view>
                
                <!-- 新增搜索框 -->
                <view class="popup-search">
                    <van-search 
                        :value="searchKeyword" 
                        placeholder="搜索搭配名称/场景" 
                        shape="round"
                        @change="onSearchChange"
                        @search="onSearch"
                    />
                </view>

				<scroll-view scroll-y class="outfit-scroll" @scrolltolower="loadMoreOutfits">
					<view class="select-list">
						<view 
							v-for="outfit in myOutfits" 
							:key="outfit.id" 
							class="select-item"
							@tap="onConfirmSelect(outfit)"
						>
							<!-- 修改图片展示逻辑：优先显示合成图(image_url)，没有则显示第一件单品(items[0]) -->
							<image :src="outfit.image_url || outfit.items[0]?.image_url" mode="aspectFill" class="mini-cover" />
							<view class="info">
								<text class="name">{{ outfit.name }}</text>
								<text class="tags">
									<text v-if="outfit.scene" style="margin-right: 8rpx;">{{ outfit.scene }}</text>
									<text v-if="outfit.season">{{ outfit.season }}</text>
								</text>
							</view>
							<van-icon name="plus" color="#1989fa" size="20px" />
						</view>
						<van-empty v-if="myOutfits.length === 0" description="暂无搭配，快去创建吧" />
					</view>
				</scroll-view>
			</view>
		</van-popup>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getCalendarList, addToCalendar, removeFromCalendar, getOutfitList } from '@/api/outfit';

// --- 类型定义 ---
interface OutfitRecord {
	id: number; // calendar record id
	outfit_id: number;
	name: string;
	cover: string;
	scene?: string;
    temperature?: string; // 新增
    bg_color?: string;    // 新增
}

// --- 状态 ---
const now = new Date();
const currentYear = ref(now.getFullYear());
const currentMonth = ref(now.getMonth() + 1);
const selectedDate = ref(now.getDate());
const showAddSheet = ref(false);
const showSelection = ref(false);
const myOutfits = ref<any[]>([]);
// 移除顶层的 userInfo 获取，改为动态获取
// const userInfo = uni.getStorageSync('userInfo') || {};

// 选择弹窗相关状态
const searchKeyword = ref('');
const page = ref(1);
const hasMore = ref(true);
const isLoading = ref(false);

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
const addActions = [
	{ name: '从搭配库选择', value: 'select' },
	{ name: '创建新搭配', value: 'create' }
];

// 日期 -> 穿搭列表
const diaryData = ref<Record<string, OutfitRecord[]>>({});

// --- 生命周期 ---
onShow(() => {
	fetchCalendarData();
});

// --- 数据获取 ---
const fetchCalendarData = async () => {
    // 动态获取用户信息
    const userInfo = uni.getStorageSync('userInfo') || {};
	if (!userInfo.account) return;
	try {
		const res: any = await getCalendarList({
			account: userInfo.account,
			year: currentYear.value,
			month: currentMonth.value
		});
		if (res.code === 200) {
			diaryData.value = res.data;
		}
	} catch (e) {
		console.error('获取日历失败', e);
	}
};

const loadMyOutfits = async () => {
    if (isLoading.value) return;
    isLoading.value = true;
    
    // 动态获取用户信息
    const userInfo = uni.getStorageSync('userInfo') || {};

	try {
        const params: any = {
			account: userInfo.account,
			page: page.value,
			limit: 20
		};
        if (searchKeyword.value) {
            params.keyword = searchKeyword.value;
        }

		const res: any = await getOutfitList(params);
		if (res.code === 200) {
            const list = res.data || [];
            const mappedList = list.map((item: any) => ({
				id: item.id,
				name: item.name,
				scene: item.scene,
				season: item.season,
				image_url: item.image_url, // 映射合成图字段
				items: item.items ? item.items.map((i: any) => ({ image_url: i.image_url })) : []
			}));

            if (page.value === 1) {
                myOutfits.value = mappedList;
                hasMore.value = false;
            }
		}
	} catch (e) {
		console.error(e);
	} finally {
        isLoading.value = false;
    }
};

// --- 计算属性 ---

// 当月有多少天
const daysInMonth = computed(() => {
	return new Date(currentYear.value, currentMonth.value, 0).getDate();
});

// 当月第一天是星期几 (0-6)
const firstDayOfWeek = computed(() => {
	return new Date(currentYear.value, currentMonth.value - 1, 1).getDay();
});

// 格式化当前选中的日期字符串 (用于显示和索引)
const selectedDateStr = computed(() => {
	return `${currentYear.value}年${currentMonth.value}月${selectedDate.value}日`;
});

// 格式化当前选中的日期Key (用于查数据)
const selectedDateKey = computed(() => {
	return `${currentYear.value}-${currentMonth.value}-${selectedDate.value}`;
});

// 当前选中日期的穿搭列表
const currentOutfits = computed(() => {
	return diaryData.value[selectedDateKey.value] || [];
});

// --- 方法 ---

const changeMonth = (delta: number) => {
	let year = currentYear.value;
	let month = currentMonth.value + delta;
	
	if (month > 12) {
		year++;
		month = 1;
	} else if (month < 1) {
		year--;
		month = 12;
	}
	
	currentYear.value = year;
	currentMonth.value = month;
	// 切换月份时重置选中日期为1号，或者保持当前日期（如果存在）
	selectedDate.value = 1;
	fetchCalendarData();
};

const selectDate = (date: number) => {
	selectedDate.value = date;
};

const isToday = (date: number) => {
	const today = new Date();
	return yearIsSame(today) && monthIsSame(today) && date === today.getDate();
};

const isSelected = (date: number) => {
	return selectedDate.value === date;
};

const yearIsSame = (d: Date) => d.getFullYear() === currentYear.value;
const monthIsSame = (d: Date) => (d.getMonth() + 1) === currentMonth.value;

const hasOutfit = (date: number) => {
	const key = `${currentYear.value}-${currentMonth.value}-${date}`;
	return diaryData.value[key] && diaryData.value[key].length > 0;
};

const getWeekDayStr = (date: number) => {
	const d = new Date(currentYear.value, currentMonth.value - 1, date);
	const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
	return days[d.getDay()];
};

const onAddClick = () => {
	showAddSheet.value = true;
};

const onSelectAddAction = (event: any) => {
	const action = event.detail;
	if (action.value === 'create') {
		// 传递当前选中的日期
		uni.navigateTo({ url: `/pages/outfit/create?date=${selectedDateKey.value}` });
	} else if (action.value === 'select') {
		showSelection.value = true;
        resetSelection();
		loadMyOutfits();
	}
	showAddSheet.value = false;
};

// 跳转到详情页
const goToDetail = (outfitId: number) => {
    uni.navigateTo({
        url: `/pages/outfit/create?id=${outfitId}`
    });
};

const resetSelection = () => {
    page.value = 1;
    hasMore.value = true;
    searchKeyword.value = '';
    myOutfits.value = [];
};

const onSearchChange = (e: any) => {
    searchKeyword.value = e.detail;
};

const onSearch = () => {
    page.value = 1;
    hasMore.value = true;
    myOutfits.value = [];
    loadMyOutfits();
};

const loadMoreOutfits = () => {
    if (hasMore.value && !isLoading.value) {
        page.value++;
        loadMyOutfits();
    }
};

const onConfirmSelect = async (outfit: any) => {
    const userInfo = uni.getStorageSync('userInfo') || {};
	try {
		await addToCalendar({
			account: userInfo.account,
			outfit_id: outfit.id,
			date: selectedDateKey.value
		});
		uni.showToast({ title: '添加成功', icon: 'success' });
		showSelection.value = false;
		fetchCalendarData();
	} catch (e) {
		uni.showToast({ title: '添加失败', icon: 'none' });
	}
};

const removeOutfit = (item: any) => {
	uni.showModal({
		title: '提示',
		content: '确定移除这条记录吗？',
		success: async (res) => {
			if (res.confirm) {
				try {
					await removeFromCalendar(item.id);
					uni.showToast({ title: '已移除', icon: 'none' });
					fetchCalendarData();
				} catch (e) {
					uni.showToast({ title: '移除失败', icon: 'none' });
				}
			}
		}
	});
};

</script>

<style lang="scss" scoped>
.diary-page {
	min-height: 100vh;
	background-color: #f7f8fa;
	padding: 24rpx;
	box-sizing: border-box;

	.calendar-card {
		background: #fff;
		border-radius: 24rpx;
		padding: 24rpx;
		box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
		margin-bottom: 24rpx;

		.calendar-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 24rpx;
			
			.current-month {
				font-size: 32rpx;
				font-weight: 600;
				color: #333;
			}
			
			.arrow-btn {
				padding: 10rpx 20rpx;
				color: #666;
			}
		}

		.week-header {
			display: grid;
			grid-template-columns: repeat(7, 1fr);
			margin-bottom: 16rpx;
			
			.week-day {
				text-align: center;
				font-size: 24rpx;
				color: #999;
			}
		}

		.days-grid {
			display: grid;
			grid-template-columns: repeat(7, 1fr);
			row-gap: 16rpx;
			
			.day-cell {
				height: 80rpx;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				border-radius: 16rpx;
				position: relative;
				
				&.empty {
					pointer-events: none;
				}
				
				.date-num {
					font-size: 28rpx;
					color: #333;
					z-index: 1;
				}
				
				.dot-marker {
					width: 8rpx;
					height: 8rpx;
					background: #1989fa;
					border-radius: 50%;
					margin-top: 6rpx;
				}

				&.is-today {
					.date-num {
						color: #1989fa;
						font-weight: 600;
					}
				}

				&.is-selected {
					background: #1989fa;
					box-shadow: 0 4rpx 12rpx rgba(25, 137, 250, 0.3);
					
					.date-num {
						color: #fff;
					}
					
					.dot-marker {
						background: #fff;
					}
				}
			}
		}
	}

	.daily-section {
		background: #fff;
		border-radius: 24rpx;
		padding: 32rpx;
		min-height: 300rpx;
		
		.section-header {
			margin-bottom: 32rpx;
			
			.title {
				font-size: 36rpx;
				font-weight: 600;
				color: #333;
				margin-right: 16rpx;
			}
			
			.subtitle {
				font-size: 28rpx;
				color: #999;
			}
		}

		.outfit-list {
			margin-bottom: 32rpx;
			
			.outfit-item {
				display: flex;
				align-items: center;
				padding: 20rpx;
				background: #f9f9f9;
				border-radius: 16rpx;
				margin-bottom: 20rpx;
				
				.outfit-cover {
					width: 100rpx;
					height: 100rpx;
					border-radius: 12rpx;
					margin-right: 20rpx;
					background: #eee;
				}
				
				.outfit-info {
					flex: 1;
					
					.outfit-name {
						font-size: 28rpx;
						font-weight: 500;
						color: #333;
						margin-bottom: 8rpx;
						display: block;
					}
				}
				
				.action-btn {
					padding: 10rpx;
				}
			}
		}
		
		.empty-state {
			text-align: center;
			padding: 40rpx 0;
			color: #ccc;
			font-size: 26rpx;
			margin-bottom: 20rpx;
		}
		
		.add-btn-container {
			margin-top: 20rpx;
		}
	}

	.selection-popup {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #fff;

		.popup-header {
			padding: 30rpx;
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-weight: 600;
			font-size: 32rpx;
			border-bottom: 1rpx solid #eee;
		}

        .popup-search {
            padding: 20rpx;
            border-bottom: 1rpx solid #eee;
        }

		.outfit-scroll {
			flex: 1;
			height: 0;
		}

		.select-list {
			padding: 20rpx;
		}

		.select-item {
			display: flex;
			align-items: center;
			padding: 20rpx;
			border-bottom: 1rpx solid #f9f9f9;
			
			&:active {
				background: #f5f5f5;
			}

			.mini-cover {
				width: 100rpx;
				height: 100rpx;
				border-radius: 10rpx;
				margin-right: 20rpx;
				background: #eee;
			}

			.info {
				flex: 1;
				
				.name {
					font-size: 28rpx;
					font-weight: 500;
					color: #333;
					margin-bottom: 8rpx;
					display: block;
				}
				
				.tags {
					font-size: 24rpx;
					color: #999;
				}
			}
		}
	}
}
</style>
