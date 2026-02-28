<template>
	<view class="diary-page">
        <!-- 顶部标题栏 + 切换按钮 -->
        <view class="custom-header">
            <text class="page-title">{{ viewMode === 'calendar' ? '日历视图' : '时间轴' }}</text>
            <view class="switch-btn" @tap="toggleViewMode">
                <view class="switch-label">{{ viewMode === 'calendar' ? '列表' : '日历' }}</view>
                <van-icon :name="viewMode === 'calendar' ? 'notes-o' : 'calendar-o'" size="20px" color="#333" />
            </view>
        </view>

        <!-- === 视图A：日历视图 === -->
        <view v-if="viewMode === 'calendar'">
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
                    <view v-for="date in daysInMonth" :key="date" class="day-cell-wrapper" @tap="selectDate(date)">
                        <!-- 行李箱背景条 (Visual Track) -->
                        <view 
                            v-if="getSuitcaseTrackStyle(date)"
                            class="suitcase-track"
                            :class="{ 
                                'start': getSuitcaseTrackStyle(date).isStart,
                                'end': getSuitcaseTrackStyle(date).isEnd
                            }"
                        ></view>

                        <view class="day-cell"
                            :class="{ 
                                'is-today': isToday(date), 
                                'is-selected': isSelected(date),
                                'has-thumb': !!getDayThumbnail(date)
                            }"
                        >
                            <!-- 图片缩略图 (第一层) -->
                            <image 
                                v-if="getDayThumbnail(date)" 
                                :src="getDayThumbnail(date)" 
                                mode="aspectFill" 
                                class="cell-thumb"
                            />
                            
                            <!-- 空状态 + 号 (如果没有日记且没有缩略图，且是过去或今天) -->
                            <view v-else-if="isEmptyDate(date)" class="empty-plus">
                                <van-icon name="plus" color="#e0e0e0" size="12px" />
                            </view>

                            <!-- 日期数字 (最上层) -->
                            <text class="date-num">{{ date }}</text>
                            
                            <!-- 标记点 (仅在无图时显示，辅助提示有内容但没图的情况，如纯文字日记) -->
                            <!-- <view v-if="!getDayThumbnail(date) && !isEmptyDate(date)" class="markers"> ... </view> -->
                        </view>
                    </view>
                </view>
            </view>

            <!-- 选中日期的内容区域 -->
            <view class="daily-section">
                <!-- 行李箱入口 Banner -->
                <view 
                    v-if="currentSuitcase" 
                    class="suitcase-banner"
                    @tap="goToSuitcaseDetail(currentSuitcase.id)"
                >
                    <view class="banner-left">
                        <text class="banner-icon">🧳</text>
                        <view class="banner-info">
                            <text class="banner-title">{{ currentSuitcase.name }}</text>
                            <text class="banner-sub">正在旅途中: {{ currentSuitcase.destination }}</text>
                        </view>
                    </view>
                    <van-icon name="arrow" color="#fff" />
                </view>

                <view class="section-header">
                    <text class="title">{{ selectedDateStr }}</text>
                    <text class="subtitle">{{ getWeekDayStr(selectedDate) }}</text>
                </view>

                <!-- 1. 日记板块 -->
                <view class="diary-entry-card" @tap="goToDiaryEdit">
                    <view class="card-header">
                        <text class="card-title">📝 随笔日记</text>
                        <van-icon name="arrow" color="#999" />
                    </view>
                    <view v-if="currentDiary" class="diary-preview">
                        <view class="diary-content text-ellipsis">{{ currentDiaryName }}</view>
                        <image v-if="currentDiary.cover" :src="currentDiary.cover" mode="aspectFill" class="diary-thumb" />
                    </view>
                    <view v-else class="empty-diary-tip">
                        <text>记录今天的心情和穿搭灵感...</text>
                    </view>
                </view>

                <!-- 2. 穿搭计划列表 -->
                <view class="outfit-section-title">👗 穿搭计划</view>
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
        </view>

        <!-- === 视图B：时间轴视图 === -->
        <view v-else class="timeline-view">
            <view class="timeline-container">
                <view v-for="(item, index) in timelineList" :key="item.id" class="timeline-item">
                    <!-- 左侧时间节点 -->
                    <view class="time-node">
                        <text class="node-date">{{ item.date.slice(5) }}</text> <!-- MM-DD -->
                        <view class="node-dot"></view>
                        <view class="node-line" v-if="index !== timelineList.length - 1"></view>
                    </view>

                    <!-- 右侧内容卡片 -->
                    <view class="content-card" @tap="goToDiaryDetail(item)">
                        <view class="card-date-full">{{ item.date }}</view>
                        <text class="card-content" v-if="item.content">{{ item.content }}</text>
                        
                        <!-- 宫格图片 -->
                        <view class="image-grid" v-if="item.images && item.images.length > 0">
                            <view 
                                v-for="(img, imgIndex) in item.images" 
                                :key="imgIndex"
                                class="grid-img-wrapper"
                                :class="`grid-${Math.min(item.images.length, 3)}`"
                            >
                                <image :src="img" mode="aspectFill" class="grid-img" />
                            </view>
                        </view>
                    </view>
                </view>

                <!-- Loading / Empty States -->
                <view class="loading-state" v-if="isTimelineLoading">
                    <van-loading size="24px">加载中...</van-loading>
                </view>
                <view class="empty-timeline" v-if="!isTimelineLoading && timelineList.length === 0">
                    <van-empty description="暂无日记记录" />
                </view>
            </view>
        </view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { getMonthDiaries, getDiaryList } from '@/api/diary';
import { getCalendarList, removeFromCalendar } from '@/api/outfit';
import { getSuitcaseRanges } from '@/api/suitcase';

// === 类型定义 ===
interface OutfitItem {
    outfit_id: number;
    calendar_id: number;
    name: string;
    image_url: string;
    scene?: string;
    temperature?: string;
    bg_color?: string; // 修正命名
}

interface DiarySummary {
    id: number;
    date: string;
    cover: string; // 封面图
    content?: string; // 摘要
}

interface SuitcaseRange {
    id: number;
    name: string;
    destination: string;
    start_date: string;
    end_date: string;
}

interface DayData {
    diary?: DiarySummary;
    outfits: OutfitItem[];
}

interface TimelineItem {
    id: number;
    date: string;
    content: string;
    images: string[];
}

// === 状态管理 ===
const viewMode = ref<'calendar' | 'timeline'>('calendar');
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1);
const selectedDate = ref(getTodayStr()); // 格式 YYYY-MM-DD
const calendarData = ref<Record<string, DayData>>({}); 
const suitcaseRanges = ref<SuitcaseRange[]>([]);

// 时间轴相关
const timelineList = ref<TimelineItem[]>([]);
const isTimelineLoading = ref(false);
const timelinePage = ref(1);
const timelineHasMore = ref(true);

// === 计算属性 ===

// 1. 日历生成
const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const daysInMonth = computed(() => {
    return new Date(currentYear.value, currentMonth.value, 0).getDate();
});

const firstDayOfWeek = computed(() => {
    return new Date(currentYear.value, currentMonth.value - 1, 1).getDay();
});

// 2. 选中日期的完整字符串 (用于显示)
const selectedDateStr = computed(() => {
    const [y, m, d] = selectedDate.value.split('-');
    return `${y}年${parseInt(m)}月${parseInt(d)}日`;
});

// 3. 选中日期的当日数据
const currentDayData = computed(() => {
    return calendarData.value[selectedDate.value] || { outfits: [] };
});

const currentDiary = computed(() => currentDayData.value.diary);
const currentDiaryName = computed(() => currentDiary.value?.content || '点击记录今日心情...');
const currentOutfits = computed(() => currentDayData.value.outfits);

// 4. 当前是否在旅行中
const currentSuitcase = computed(() => {
    const date = selectedDate.value;
    return suitcaseRanges.value.find(range => date >= range.start_date && date <= range.end_date);
});


// === 生命周期 ===
onShow(() => {
    if (viewMode.value === 'calendar') {
        loadAllDataForMonth(); // 每次显示都重新加载日历以确保数据最新
    } else {
        // 如果是时间轴模式，也可以选择是否刷新
        if (timelineList.value.length === 0) {
             refreshTimeline();
        }
    }
});

onReachBottom(() => {
    if (viewMode.value === 'timeline') {
        loadMoreTimeline();
    }
});

// === 方法 ===

function getTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 切换视图
const toggleViewMode = () => {
    viewMode.value = viewMode.value === 'calendar' ? 'timeline' : 'calendar';
    if (viewMode.value === 'timeline' && timelineList.value.length === 0) {
        refreshTimeline();
    } else if (viewMode.value === 'calendar') {
        loadAllDataForMonth();
    }
};

// 切换月份
const changeMonth = (step: number) => {
    let y = currentYear.value;
    let m = currentMonth.value + step;
    if (m > 12) {
        y++;
        m = 1;
    } else if (m < 1) {
        y--;
        m = 12;
    }
    currentYear.value = y;
    currentMonth.value = m;
    calendarData.value = {}; // 清空旧数据防止闪烁
    loadAllDataForMonth();
};

// 选择日期
const selectDate = (day: number) => {
    const m = String(currentMonth.value).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    selectedDate.value = `${currentYear.value}-${m}-${d}`;
};

// 辅助判断
const isToday = (day: number) => {
    const today = getTodayStr();
    const m = String(currentMonth.value).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${currentYear.value}-${m}-${d}` === today;
};

const isSelected = (day: number) => {
    const m = String(currentMonth.value).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${currentYear.value}-${m}-${d}` === selectedDate.value;
};

// 获取某天的第一张展示图 (优先日记，其次穿搭)
const getDayThumbnail = (day: number) => {
    const m = String(currentMonth.value).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateKey = `${currentYear.value}-${m}-${d}`;
    const data = calendarData.value[dateKey];
    
    if (!data) return null;
    if (data.diary && data.diary.cover) return data.diary.cover;
    if (data.outfits.length > 0 && data.outfits[0].image_url) return data.outfits[0].image_url;
    return null;
};

// 判断某天是否为空 (无日记且无穿搭)
const isEmptyDate = (day: number) => {
    const m = String(currentMonth.value).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateKey = `${currentYear.value}-${m}-${d}`;
    const data = calendarData.value[dateKey];
    
    if (!data) return true;
    return !data.diary && data.outfits.length === 0;
};

// 获取星期几
const getWeekDayStr = (dateStr: string) => {
    const dayIndex = new Date(dateStr).getDay();
    const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return map[dayIndex];
};

// 计算行李箱轨道样式
const getSuitcaseTrackStyle = (day: number) => {
    const m = String(currentMonth.value).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateKey = `${currentYear.value}-${m}-${d}`;
    
    // 查找该日期是否在某个 range 内
    const range = suitcaseRanges.value.find(r => dateKey >= r.start_date && dateKey <= r.end_date);
    
    if (!range) return null;
    
    return {
        isStart: dateKey === range.start_date,
        isEnd: dateKey === range.end_date
    };
};

// === 数据加载 ===

// 加载当前月的所有数据 (日记 + 穿搭日历 + 行程)
async function loadAllDataForMonth() {
    uni.showLoading({ title: '加载中' });
    try {
        const userInfo = uni.getStorageSync('userInfo') || {};
        const account = userInfo.account; 
        
        // 即使没有 account (游客模式?) 也可以尝试加载公共数据或跳过
        // 但为了严谨，这里假设必须登录

        // 并行请求
        const promises = [
             getMonthDiaries({ year: currentYear.value, month: currentMonth.value }),
             getSuitcaseRanges()
        ];
        
        if (typeof account === 'string' && account.trim() !== '') {
            promises.push(getCalendarList({ account, year: currentYear.value, month: currentMonth.value }));
        }

        const results = await Promise.all(promises);
        
        const diaryRes = results[0];
        const suitcaseRes = results[1];
        // 如果 promises 长度为 3，说明发起了 outfitRes 请求；否则就是空
        const outfitRes = (promises.length === 3) ? results[2] : { code: 200, data: [] };

        const newData: Record<string, DayData> = {};

        // 1. 处理日记数据
        if (diaryRes.code === 200) {
            diaryRes.data.forEach((d: any) => {
                if (!newData[d.date]) newData[d.date] = { outfits: [] };
                newData[d.date].diary = {
                    id: d.id,
                    date: d.date,
                    cover: d.cover,
                    content: d.content
                };
            });
        }

        // 2. 处理穿搭日历数据
        if (outfitRes.code === 200) {
            outfitRes.data.forEach((item: any) => {
                const dateKey = item.calendar_date; // 格式 YYYY-MM-DD
                 if (!newData[dateKey]) newData[dateKey] = { outfits: [] };
                 newData[dateKey].outfits.push({
                     outfit_id: item.outfit_id,
                     calendar_id: item.calendar_id,
                     name: item.name,
                     image_url: item.image_url,
                     weather: item.weather,
                     temperature: item.temperature
                 });
            });
        }
        
        // 3. 处理行程数据
        if (suitcaseRes && suitcaseRes.code === 200) {
            suitcaseRanges.value = suitcaseRes.data;
        }

        calendarData.value = newData;
    } catch (e) {
        console.error(e);
        uni.showToast({ title: '加载失败', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
}

// 加载时间轴
async function refreshTimeline() {
    timelinePage.value = 1;
    timelineList.value = [];
    timelineHasMore.value = true;
    await loadMoreTimeline();
}

async function loadMoreTimeline() {
    if (isTimelineLoading.value || !timelineHasMore.value) return;
    
    isTimelineLoading.value = true;
    try {
        const res = await getDiaryList({ page: timelinePage.value, pageSize: 10 }) as any;
        if (res.code === 200) {
            // 修复：如果数据为空或少于 pageSize，说明没有更多了
            if (!res.data || res.data.length < 10) {
                timelineHasMore.value = false;
            }
            if (res.data && res.data.length > 0) {
                timelineList.value = [...timelineList.value, ...res.data];
                timelinePage.value++;
            }
        } else {
             timelineHasMore.value = false;
        }
    } catch (e) {
        console.error('TimeLine load error', e);
        timelineHasMore.value = false;
    } finally {
        isTimelineLoading.value = false;
    }
}

// === 用户交互 ===

const onAddClick = () => {
    // 跳转到日历选择页或穿搭列表来添加
    // 这里简单实现：去穿搭列表，带上模式参数
    uni.navigateTo({
        url: `/pages/outfit/list?mode=select&targetDate=${selectedDate.value}`
    });
};

const goToDetail = (outfitId: number) => {
    uni.navigateTo({
        url: `/pages/outfit/create?id=${outfitId}&mode=view`
    });
};

const goToDiaryDetail = (item: TimelineItem) => {
    uni.navigateTo({
        url: `/pages/outfit/diary-edit?id=${item.id}&date=${item.date}`
    });
};

const goToDiaryEdit = () => {
    // 如果已有日记，去编辑，否则新建
    if (currentDiary.value) {
        uni.navigateTo({
            url: `/pages/outfit/diary-edit?id=${currentDiary.value.id}&date=${selectedDate.value}`
        });
    } else {
        uni.navigateTo({
            url: `/pages/outfit/diary-edit?date=${selectedDate.value}`
        });
    }
};

const goToSuitcaseDetail = (id: number) => {
    uni.showToast({ title: '行李箱功能开发中...', icon: 'none' });
    // uni.navigateTo({ url: `/pages/suitcase/detail?id=${id}` });
};

const removeOutfit = async (item: OutfitItem) => {
    uni.showModal({
        title: '提示',
        content: '确定从今日计划中移除该穿搭吗？',
        success: async (res) => {
            if (res.confirm) {
                try {
                    await removeFromCalendar(item.calendar_id);
                    uni.showToast({ title: '已移除', icon: 'success' });
                    // 局部刷新
                    loadAllDataForMonth();
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
	padding-bottom: 40rpx;
}

/* 顶部自定义Header */
.custom-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 30rpx; // 稍微增加内边距
    background: #fff;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.02);
    
    .page-title {
        font-size: 36rpx;
        font-weight: bold;
        color: #333;
    }
    
    .switch-btn {
        display: flex;
        align-items: center;
        background: #f0f2f5;
        padding: 10rpx 20rpx;
        border-radius: 30rpx;
        transition: opacity 0.2s;
        
        &:active {
            opacity: 0.7;
        }

        .switch-label {
            font-size: 26rpx;
            color: #666;
            margin-right: 8rpx;
        }
    }
}

/* 日历卡片 */
.calendar-card {
	background: #fff;
	padding: 20rpx 0;
	box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.03);
	margin-bottom: 24rpx;
}

.calendar-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0 40rpx 20rpx;
	
	.current-month {
		font-size: 34rpx;
		font-weight: 600;
		color: #333;
	}
	
	.arrow-btn {
		padding: 10rpx;
		color: #666;
	}
}

.week-header {
	display: flex;
	justify-content: space-around;
	margin-bottom: 10rpx;
	
	.week-day {
		width: 14.28%;
		text-align: center;
		font-size: 26rpx;
		color: #999;
	}
}

.days-grid {
	display: flex;
	flex-wrap: wrap;
    padding: 0 10rpx; // 增加一点边距
	
    .day-cell-wrapper {
        width: 14.28%;
        height: 90rpx;
        margin-bottom: 8rpx;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    // Visual Track 背景条
    .suitcase-track {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 60%; 
        transform: translateY(-50%);
        background-color: #e3f2fd; // 浅蓝
        z-index: 0;
        
        &.start {
            border-top-left-radius: 12rpx;
            border-bottom-left-radius: 12rpx;
            left: 10%; // 留一点空隙
        }
        &.end {
            border-top-right-radius: 12rpx;
            border-bottom-right-radius: 12rpx;
            right: 10%;
        }
    }

	.day-cell {
		width: 80rpx;  // 稍微缩小一点，让 wrapper 留出空间给 start/end 效果
		height: 80rpx;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		position: relative;
        border-radius: 12rpx;
        overflow: hidden; // 确保图片裁剪
        z-index: 1; // 在 track 之上
        background: transparent;
        transition: all 0.2s;
		
		&.empty {
			pointer-events: none;
		}

        // 有图状态
        &.has-thumb {
            background: #f0f0f0;
        }
        
        .cell-thumb {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.8; // 让日期数字能看清
        }

        .empty-plus {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
        }
		
		.date-num {
			font-size: 28rpx;
			z-index: 2;
            color: #333;
            font-weight: 500;
            text-shadow: 0 0 4rpx rgba(255,255,255, 0.8); // 增加文字描边确保在图上可见
		}
		
		&.is-today {
             // 选中框或下划线
             border: 2rpx solid #1989fa;
        }
        
		&.is-today .date-num {
			color: #1989fa;
			font-weight: bold;
		}
		
		&.is-selected {
            background-color: #1989fa !important; // 强制覆盖图片背景或其他
            box-shadow: 0 4rpx 10rpx rgba(25, 137, 250, 0.4);
            
            .cell-thumb {
                display: none; // 选中时不显示图片，显示纯色背景清晰可见
            }
            .empty-plus {
                display: none;
            }
		}
        &.is-selected .date-num {
            color: #fff;
            text-shadow: none;
        }

        /* 移除旧的 marker 样式，因为现在用封面图 */
	}
}

/* 内容区域 */
.daily-section {
	padding: 0 30rpx;
	
	.section-header {
		margin-bottom: 30rpx;
		.title {
			font-size: 40rpx;
			font-weight: bold;
			color: #333;
			margin-right: 20rpx;
		}
		.subtitle {
			font-size: 30rpx;
			color: #999;
		}
	}
}

/* 日记卡片 */
.diary-entry-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 40rpx;
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.02);

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16rpx;
        
        .card-title {
            font-size: 30rpx;
            font-weight: 600;
            color: #333;
        }
    }

    .empty-diary-tip {
        color: #999;
        font-size: 26rpx;
        padding: 10rpx 0;
    }

    .diary-preview {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;

        .diary-content {
            flex: 1;
            font-size: 28rpx;
            color: #555;
            margin-right: 20rpx;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
        }

        .diary-thumb {
            width: 80rpx;
            height: 80rpx;
            border-radius: 8rpx;
            background: #f0f0f0;
        }
    }
}

.outfit-section-title {
    font-size: 30rpx;
    font-weight: 600;
    margin-bottom: 24rpx;
    color: #333;
}

.outfit-list {
	.outfit-item {
		display: flex;
		align-items: center;
		background: #fff;
		border-radius: 16rpx;
		padding: 20rpx;
		margin-bottom: 20rpx;
		
		.outfit-cover-wrapper {
			width: 120rpx;
			height: 120rpx;
			border-radius: 12rpx;
			overflow: hidden;
			margin-right: 20rpx;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		
		.outfit-cover {
			width: 100%;
			height: 100%;
		}
		
		.outfit-info {
			flex: 1;
			display: flex;
			flex-direction: column;
			justify-content: center;
			
			.outfit-name {
				font-size: 30rpx;
				color: #333;
				margin-bottom: 10rpx;
				font-weight: 500;
			}

            .tags {
                display: flex;
            }
		}
		
		.action-btn {
			padding: 20rpx;
		}
	}
}

.empty-state {
	padding: 60rpx 0;
	text-align: center;
	color: #999;
	font-size: 28rpx;
    margin-bottom: 20rpx;
}

.add-btn-container {
	margin-top: 30rpx;
    padding-bottom: 40rpx;
}

/* 弹窗样式 */
.selection-popup {
	height: 100%;
	display: flex;
	flex-direction: column;
	
	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 30rpx;
		font-size: 32rpx;
		font-weight: bold;
		border-bottom: 1rpx solid #eee;
	}
    
    .popup-search {
        padding: 0 10rpx;
    }
	
	.outfit-scroll {
		flex: 1;
		height: 0; 
		padding: 20rpx;
        box-sizing: border-box;
	}
	
	.select-item {
		display: flex;
		align-items: center;
		padding: 20rpx;
		margin-bottom: 20rpx;
		background: #f9f9f9;
		border-radius: 12rpx;
		
		.mini-cover {
			width: 100rpx;
			height: 100rpx;
			border-radius: 8rpx;
			margin-right: 20rpx;
            background: #fff;
		}
		
		.info {
			flex: 1;
			display: flex;
			flex-direction: column;
			
			.name {
				font-size: 28rpx;
				margin-bottom: 8rpx;
                color: #333;
			}
			
			.tags {
				font-size: 22rpx;
				color: #999;
			}
		}
	}
}

/* 行李箱横幅 */
.suitcase-banner {
    background: linear-gradient(135deg, #4facfe, #00f2fe);
    border-radius: 16rpx;
    padding: 24rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 188, 212, 0.2);
    
    .banner-left {
        display: flex;
        align-items: center;
        
        .banner-icon {
            font-size: 40rpx;
            margin-right: 20rpx;
        }
        
        .banner-info {
            display: flex;
            flex-direction: column;
            .banner-title {
                color: #fff;
                font-size: 30rpx;
                font-weight: bold;
                margin-bottom: 4rpx;
            }
            .banner-sub {
                color: rgba(255,255,255,0.9);
                font-size: 22rpx;
            }
        }
    }
}

/* 根据已有样式保持其他不变，下面新增时间轴样式 */

/* 时间轴视图 */
.timeline-view {
    padding: 30rpx;
}

.timeline-container {
    padding-left: 20rpx;
}

.timeline-item {
    display: flex;
    margin-bottom: 40rpx;
    
    .time-node {
        width: 100rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-right: 20rpx;
        position: relative;
        
        .node-date {
            font-size: 26rpx;
            color: #666;
            font-weight: 500;
            margin-bottom: 10rpx;
        }
        
        .node-dot {
            width: 16rpx;
            height: 16rpx;
            border-radius: 50%;
            background-color: #1989fa;
            border: 4rpx solid #d4e9ff;
            z-index: 1;
        }
        
        .node-line {
            width: 2rpx;
            background-color: #eee;
            flex: 1;
            margin-top: 4rpx;
        }
    }
    
    .content-card {
        flex: 1;
        background: #fff;
        border-radius: 16rpx;
        padding: 24rpx;
        box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.03);
        
        .card-date-full {
             font-size: 24rpx;
             color: #999;
             margin-bottom: 12rpx;
        }

        .card-content {
            font-size: 28rpx;
            color: #333;
            line-height: 1.5;
            margin-bottom: 20rpx;
            display: block;
        }
        
        .image-grid {
            display: grid;
            gap: 10rpx;
            
            // 默认网格
            grid-template-columns: repeat(3, 1fr);
            
            .grid-img-wrapper {
                aspect-ratio: 1; // 正方形
                border-radius: 8rpx;
                overflow: hidden;
                
                 &.grid-1 {
                     // 1张图时占满或定宽
                     grid-column: span 3; 
                     aspect-ratio: 16/9; // 宽屏比例
                 }
                 &.grid-2 {
                     grid-column: span 1.5; // 自定义逻辑比较复杂，uni可以直接用style
                 }
            }
            
            .grid-img {
                width: 100%;
                height: 100%;
            }
        }
    }
}

.loading-state, .empty-timeline {
    padding: 40rpx;
    text-align: center;
}
</style>
