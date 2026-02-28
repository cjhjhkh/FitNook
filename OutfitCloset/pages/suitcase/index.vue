<template>
	<view class="suitcase-list-page">
		<!-- 列表区域 -->
		<scroll-view scroll-y class="list-container" enable-flex @scrolltolower="onLoadMore">
			 <!-- 顶部工具栏：筛选+编辑 -->
			<view class="tools-bar">
				<view class="left">
                    <!-- 这里将来可以放分类筛选 -->
				</view>
				<view class="right">
					<view class="action-btn" @tap="toggleEditMode" v-if="suitcaseList.length > 0">
						<text>{{ isEditMode ? '完成' : '管理' }}</text>
					</view>
				</view>
			</view>

			<!-- 新建按钮区域 -->
			<view class="create-section" @tap="openCreatePopup">
				<view class="dashed-box">
					<van-icon name="plus" size="24px" color="#1989fa" />
					<text class="create-text">创建新行程</text>
				</view>
			</view>

			<!-- 列表项 -->
			<view v-for="item in suitcaseList" :key="item.id" class="suitcase-card" @tap="goToDetail(item.id)">
				<!-- 增加多选框模式 -->
				<view class="check-col" v-if="isEditMode" @tap.stop="toggleSelectSuitcase(item.id)">
					<van-checkbox :value="selectedSuitcaseIds.includes(item.id)" />
				</view>
				
				<van-swipe-cell right-width="65" :disabled="isEditMode" async-close @close="(e) => handleSwipeClose(e, item)">
					<view class="card-content">
						<view class="card-header">
							<text class="destination">{{ item.destination || '未定目的地' }}</text>
							<van-tag :type="getStatusType(item.status)" size="medium" round>
								{{ getStatusText(item.status) }}
							</van-tag>
						</view>
						<view class="card-body">
							<text class="name">{{ item.name }}</text>
							<view class="date-row">
								<van-icon name="calendar-o" size="14px" color="#999" />
								<text class="date-text">
									{{ formatDate(item.start_date) }} 至 {{ formatDate(item.end_date) }}
								</text>
							</view>
							<view class="desc" v-if="item.description">{{ item.description }}</view>
                            
                            <!-- 简要概览 -->
                            <view class="stats-row">
                                <view class="stat-item">
                                    <van-icon name="points" />
                                    <text>{{ item.items ? item.items.length : 0 }} 件物品</text>
                                </view>
                                 <view class="stat-item">
                                    <van-icon name="apps-o" />
                                    <text>{{ item.outfits ? item.outfits.length : 0 }} 套搭配</text>
                                </view>
                            </view>
						</view>
					</view>
					<template #right>
						<view class="delete-btn">删除</view>
					</template>
				</van-swipe-cell>
			</view>

			<!-- 空状态 -->
			<van-empty v-if="suitcaseList.length === 0 && !loading" description="还没有行程计划，快去创建一个吧" />
            
            <view class="safe-bottom"></view>
		</scroll-view>

		 <!-- 底部批量操作栏 -->
		<view v-if="isEditMode" class="batch-action-bar safe-area-inset-bottom">
			<view class="select-info">已选 {{ selectedSuitcaseIds.length }} 个行程</view>
			<van-button type="danger" size="small" round @click="handleBatchDelete">批量删除</van-button>
		</view>

		<!-- 创建/编辑弹窗 -->
		<van-popup :show="showCreatePopup" round position="bottom" custom-style="height: 60%" @close="onPopupClose">
			<view class="popup-content">
				<view class="popup-title">创建新行程</view>
				<van-cell-group>
					<van-field :value="form.name" label="行程名称" placeholder="例如：春节回家、三亚旅行" @change="onFieldChange('name', $event)" required />
					<van-field :value="form.destination" label="目的地" placeholder="请输入目的地" @change="onFieldChange('destination', $event)" />
					<van-cell title="日期范围" :value="dateDisplay" is-link @click="showCalendar = true" />
					<van-field :value="form.description" label="备注" type="textarea" placeholder="备注信息..." autosize @change="onFieldChange('description', $event)" />
                    <van-cell title="当前状态">
                        <van-radio-group :value="form.status" direction="horizontal" @change="onStatusChange">
                            <van-radio name="planning">计划中</van-radio>
                            <van-radio name="departed">进行中</van-radio>
                            <van-radio name="finished">已结束</van-radio>
                        </van-radio-group>
                    </van-cell>
				</van-cell-group>

				<view class="popup-footer">
					<van-button type="info" block round @click="submitCreate" :loading="submitting">确认创建</van-button>
				</view>
			</view>
		</van-popup>

		<!-- 日历弹窗 -->
		<van-calendar :show="showCalendar" type="range" @close="showCalendar = false" @confirm="onCalendarConfirm" color="#1989fa" />
        
        <van-dialog id="van-dialog" />
	</view>
</template>

// @ts-ignore
<script setup lang="ts">
import { ref, computed } from 'vue';
// @ts-ignore
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { getSuitcaseList, createSuitcase, deleteSuitcase, batchDeleteSuitcase } from '@/api/suitcase';
// @ts-ignore
import Dialog from '@/wxcomponents/vant/dialog/dialog';

// --- 状态定义 ---
const suitcaseList = ref<any[]>([]);
const loading = ref(false);
const showCreatePopup = ref(false);
const showCalendar = ref(false);
const submitting = ref(false);

const isEditMode = ref(false);
const selectedSuitcaseIds = ref<number[]>([]);

const form = ref({
	name: '',
	destination: '',
	start_date: '',
	end_date: '',
	description: '',
    status: 'planning'
});

// --- 计算属性 ---
const dateDisplay = computed(() => {
	if (form.value.start_date && form.value.end_date) {
		return `${form.value.start_date} - ${form.value.end_date}`;
	}
	return '选择日期';
});

// --- 生命周期 ---
onShow(() => {
	refreshList();
});

onPullDownRefresh(() => {
    refreshList().then(() => {
        uni.stopPullDownRefresh();
    });
});

const onLoadMore = () => {
    // 目前后端暂不支持分页，此处预留
};

const openCreatePopup = () => {
    // 重置表单
    form.value = {
        name: '',
        destination: '',
        start_date: '',
        end_date: '',
        description: '',
        status: 'planning'
    };
    showCreatePopup.value = true;
};

const toggleEditMode = () => {
    if (suitcaseList.value.length === 0) return;
	isEditMode.value = !isEditMode.value;
	selectedSuitcaseIds.value = [];
};

const toggleSelectSuitcase = (id: number) => {
	const idx = selectedSuitcaseIds.value.indexOf(id);
	if (idx > -1) {
		selectedSuitcaseIds.value.splice(idx, 1);
	} else {
		selectedSuitcaseIds.value.push(id);
	}
};

const handleBatchDelete = () => {
    if (selectedSuitcaseIds.value.length === 0) {
        uni.showToast({ title: '请先选择需要删除的行程', icon: 'none' });
        return;
    }
    
    // 使用原生模态框替代 Vant Dialog，避免调用失败
    uni.showModal({
        title: '批量删除',
        content: `确定要删除选中的 ${selectedSuitcaseIds.value.length} 个行程吗？此操作无法恢复。`,
        confirmColor: '#ee0a24',
        success: async (res) => {
            if (res.confirm) {
                try {
                    uni.showLoading({ title: '删除中' });
                    // 使用批量删除接口
                    await batchDeleteSuitcase(selectedSuitcaseIds.value);
                    
                    uni.hideLoading();
                    uni.showToast({ title: '删除成功' });
                    // 清空选择并退出编辑模式
                    selectedSuitcaseIds.value = [];
                    isEditMode.value = false;
                    // 刷新列表
                    await refreshList();
                } catch(e) {
                    uni.hideLoading();
                    console.error(e);
                    uni.showToast({ title: '删除失败', icon: 'none' });
                }
            }
        }
    });
};

const refreshList = async () => {
    try {
        loading.value = true;
        const userInfo = uni.getStorageSync('userInfo');
        if (!userInfo?.account) return;

        const res: any = await getSuitcaseList({ account: userInfo.account });
        if (res.code === 200) {
            suitcaseList.value = res.data;
        }
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const goToDetail = (id: number) => {
    if (isEditMode.value) return; // 编辑模式下不跳转
	uni.navigateTo({
		url: `/pages/suitcase/detail?id=${id}`
	});
};

const onPopupClose = () => {
	showCreatePopup.value = false;
};

const onFieldChange = (field: string, e: any) => {
	form.value[field] = e.detail;
};

const onStatusChange = (e: any) => {
    form.value.status = e.detail;
};

const onCalendarConfirm = (e: any) => {
	const [start, end] = e.detail;
    // 格式化日期为 YYYY-MM-DD
    const formatDateYMD = (date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    
	form.value.start_date = formatDateYMD(start);
	form.value.end_date = formatDateYMD(end);
	showCalendar.value = false;
};

const submitCreate = async () => {
    // 校验必填项
	if (!form.value.name) {
		uni.showToast({ title: '请输入行程名称', icon: 'none' });
		return;
	}

	submitting.value = true;
	try {
        const userInfo = uni.getStorageSync('userInfo');
		const res: any = await createSuitcase({
			...form.value,
			account: userInfo.account
		});
		if (res.code === 200) {
			uni.showToast({ title: '创建成功', icon: 'success' });
			showCreatePopup.value = false;
            // 延迟跳转，让用户看清提示
            setTimeout(() => {
                if (res.data && res.data.id) {
                    uni.navigateTo({
                        url: `/pages/suitcase/detail?id=${res.data.id}`
                    });
                } else {
                    refreshList();
                }
            }, 800);
		} else {
            uni.showToast({ title: res.msg || '创建失败', icon: 'none' });
        }
	} catch (e) {
		uni.showToast({ title: '网络错误', icon: 'none' });
	} finally {
		submitting.value = false;
	}
};

const handleSwipeClose = (e: any, item: any) => {
    const { position, instance } = e.detail;
    
    if (position === 'right') {
        // 使用原生模态框替代 Vant Dialog
        uni.showModal({
            title: '确认删除',
            content: `确定要删除行程"${item.name}"吗？这将无法恢复。`,
            confirmColor: '#ee0a24',
            success: async (res) => {
                if (res.confirm) {
                    try {
                        const res: any = await deleteSuitcase(item.id);
                        if (res && res.code === 200) {
                            uni.showToast({ title: '删除成功' });
                            instance.close();
                            refreshList();
                        } else {
                            uni.showToast({ title: '删除失败', icon: 'none' });
                            instance.close(); // 即使失败也关闭滑块，避免卡住
                        }
                    } catch(e) {
                        console.error(e);
                        instance.close();
                    }
                } else {
                    instance.close();
                }
            },
            fail: () => {
                 instance.close();
            }
        });
    } else {
        instance.close();
    }
};

const getStatusText = (status: string) => {
	const map: any = {
		planning: '计划中',
		departed: '旅途中',
		finished: '已结束'
	};
	return map[status] || '计划中';
};

const getStatusType = (status: string) => {
	const map: any = {
		planning: 'primary',
		departed: 'warning',
		finished: 'default'
	};
	return map[status] || 'primary';
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
};
</script>

<style lang="scss" scoped>
.suitcase-list-page {
	min-height: 100vh;
	background-color: #f7f8fa;
	display: flex;
	flex-direction: column;

	.list-container {
		flex: 1;
		padding: 30rpx;
		box-sizing: border-box;
        padding-bottom: 120rpx;
	}

	.create-section {
		margin-bottom: 30rpx;
		background: #fff;
		border-radius: 16rpx;
		padding: 30rpx;
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.03);

		.dashed-box {
			border: 2rpx dashed #1989fa;
			border-radius: 12rpx;
			height: 100rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 16rpx;
			background: #f0f7ff;

			.create-text {
				color: #1989fa;
				font-size: 30rpx;
				font-weight: 500;
			}
		}
	}

	.tools-bar {
		padding: 0 0 20rpx;
		display: flex;
		justify-content: flex-end;
		
		.action-btn {
            font-size: 28rpx;
            color: #1989fa;
            padding: 10rpx 20rpx;
        }
	}

    .suitcase-card {
        margin-bottom: 24rpx;
        background: #fff;
        border-radius: 16rpx;
        overflow: hidden;
        box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.02);
        display: flex;
        align-items: center;

        .check-col {
            padding-left: 20rpx;
        }
    }

    .card-content {
        padding: 30rpx;
        background: #fff;
        width: 100%;
        box-sizing: border-box;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16rpx;

        .destination {
            font-size: 32rpx;
            font-weight: bold;
            color: #333;
        }
    }

    .card-body {
        .name {
            font-size: 28rpx;
            color: #666;
            margin-bottom: 12rpx;
            display: block;
        }
        
        .date-row {
            display: flex;
            align-items: center;
            gap: 8rpx;
            font-size: 24rpx;
            color: #999;
            margin-bottom: 12rpx;
        }

        .desc {
            font-size: 24rpx;
            color: #ccc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 16rpx;
        }
    }

    .stats-row {
        display: flex;
        gap: 24rpx;
        border-top: 2rpx solid #f5f5f5;
        padding-top: 16rpx;
        margin-top: 16rpx;

        .stat-item {
            display: flex;
            align-items: center;
            gap: 6rpx;
            font-size: 22rpx;
            color: #888;
        }
    }

    .delete-btn {
        background-color: #ee0a24;
        color: #fff;
        width: 65px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28rpx;
    }

    .batch-action-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #fff;
        padding: 20rpx 30rpx;
        padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
        border-top: 2rpx solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 99;

        .select-info {
            font-size: 28rpx;
            color: #333;
        }
    }

    .popup-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        
        .popup-title {
            text-align: center;
            font-size: 32rpx;
            font-weight: bold;
            padding: 30rpx 0;
        }
        
        .popup-footer {
            margin-top: auto;
            padding: 30rpx;
            padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
        }
    }
}
</style>