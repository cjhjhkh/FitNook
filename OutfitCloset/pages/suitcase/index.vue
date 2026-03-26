<template>
	<view class="suitcase-list-page">
		 <!-- 顶部背景装饰 -->
		<view class="page-bg-decoration"></view>

		<scroll-view scroll-y class="list-container" enable-flex @scrolltolower="onLoadMore">
			<!-- 1. 页面大标题 & 工具栏 -->
			<view class="page-header">
				<view class="title-row">
					<text class="page-title">行程</text>
					<view class="action-btn" @tap="toggleEditMode" v-if="suitcaseList.length > 0">
						<text>{{ isEditMode ? '完成' : '编辑' }}</text>
					</view>
				</view>
				<text class="page-subtitle">规划你的每一次出发</text>
			</view>

			<!-- 2. 新建按钮 (Banner 样式) -->
			<view class="create-banner" @tap="openCreatePopup">
				<view class="banner-content">
					<view class="icon-box">
						<van-icon name="plus" size="24px" color="#fff" />
					</view>
					<view class="text-box">
						<text class="main-text">开启新旅程</text>
						<text class="sub-text">添加新的行李箱规划</text>
					</view>
				</view>
					<view class="banner-decoration">
						<van-icon name="guide-o" size="40px" color="rgba(255,255,255,0.3)" />
					</view>
			</view>

			<!-- 3. 列表项 -->
			<view v-for="item in suitcaseList" :key="item.id" 
                class="suitcase-card" 
                :class="{ 'card-hover': !isEditMode, 'checking': isEditMode }">
				
				<!-- 编辑模式下的遮罩与勾选 -->
				<view class="edit-overlay" v-if="isEditMode" @tap.stop="toggleSelectSuitcase(item.id)">
					<view class="checkbox" :class="{ checked: selectedSuitcaseIds.includes(item.id) }">
						<van-icon name="success" color="#fff" v-if="selectedSuitcaseIds.includes(item.id)" />
					</view>
				</view>
				
				<van-swipe-cell right-width="65" :disabled="isEditMode" async-close @close="handleSwipeClose($event, item)">
					<view class="card-content" @tap="goToDetail(item.id)">
						<view class="card-header-row">
							<view class="dest-wrapper">
								<text class="destination">{{ item.destination || '未定目的地' }}</text>
								<text class="name">{{ item.name }}</text>
							</view>
							<view class="status-tag" :class="item.status">
								{{ getStatusText(item.status) }}
							</view>
						</view>

						<view class="card-info-row">
							<view class="info-pill">
								<van-icon name="calendar-o" />
								<text>{{ formatDateRefined(item.start_date) }}</text>
							</view>
							<view class="info-pill">
								<van-icon name="clock-o" />
								<text>{{ calculateDays(item.start_date, item.end_date) }}天</text>
							</view>
						</view>

						<view class="card-divider"></view>

						<!-- 底部：数据概览与进度 -->
						<view class="card-footer-row">
							<view class="stats-area">
								<view class="stat-item">
									<view class="stat-icon bg-purple">
										<van-icon name="shopping-bag-o" color="#9F7AEA" size="14px" />
									</view>
									<text class="stat-text"><text class="stat-num">{{ item.items ? item.items.length : 0 }}</text> 物品</text>
								</view>
								<view class="stat-item">
									<view class="stat-icon bg-orange">
										<van-icon name="apps-o" color="#F6AD55" size="14px" />
									</view>
									<text class="stat-text"><text class="stat-num">{{ item.outfits ? item.outfits.length : 0 }}</text> 搭配</text>
								</view>
							</view>
							
							<!-- 进度显示 -->
							<view class="progress-area" v-if="item.items && item.items.length > 0">
								<view class="progress-capsule">
									<view class="progress-fill" :style="{ width: getPackPercent(item) + '%' }"></view>
								</view>
								<text class="p-text">{{ getPackPercent(item) }}%</text>
							</view>
							<view class="go-icon" v-else>
								<van-icon name="arrow" color="#cbd5e0" />
							</view>
						</view>
					</view>
					
					<template #right>
						<view class="delete-btn">
							<van-icon name="delete-o" size="24px" />
						</view>
					</template>
				</van-swipe-cell>
			</view>

			<!-- 空状态 -->
			<view v-if="suitcaseList.length === 0 && !loading" class="empty-state">
				<van-empty description="世界那么大，不想去看看吗？" image="search" />
			</view>
            
            <view class="safe-bottom"></view>
		</scroll-view>

		 <!-- 底部批量操作栏 -->
		<view v-if="isEditMode" class="batch-action-bar safe-area-inset-bottom">
			<view class="select-info">已选 {{ selectedSuitcaseIds.length }} 个行程</view>
			<van-button type="danger" size="small" round @click="handleBatchDelete">批量删除</van-button>
		</view>

		<!-- 创建/编辑弹窗 -->
		<van-popup :show="showCreatePopup" round position="bottom" custom-style="height: 70%" @close="onPopupClose">
			<view class="popup-content">
				<view class="popup-header">
					<text class="title">开启新旅程</text>
				</view>
				
				<scroll-view scroll-y class="form-scroll-area">
					<view class="form-group-title">基本信息</view>
					<view class="form-group-card">
						<!-- 行程名称 -->
						<view class="form-item border-bottom">
							<view class="label-box">
								<text class="required">*</text>
								<text class="label-text">行程名称</text>
							</view>
							<input 
								class="input-control"
								:value="form.name" 
								placeholder="例如：东京五日游" 
								placeholder-class="placeholder-style"
								@input="form.name = $event.detail.value" 
							/>
						</view>

						<!-- 目的地 -->
						<view class="form-item border-bottom">
							<view class="label-box">
								<text class="label-text">目的地</text>
							</view>
							<input 
								class="input-control"
								:value="form.destination" 
								placeholder="请输入目的地" 
								placeholder-class="placeholder-style"
								@input="form.destination = $event.detail.value" 
							/>
						</view>

						<!-- 日期范围 -->
						<view class="form-item clickable" @tap="showCalendar = true">
							<view class="label-box">
								<text class="label-text">日期范围</text>
							</view>
							<view class="picker-value">
								<text :class="dateDisplay === '选择日期' ? 'placeholder-style' : 'value-text'">
									{{ dateDisplay }}
								</text>
								<van-icon name="arrow" color="#969799" size="16px" />
							</view>
						</view>
					</view>

					<view class="form-group-title">更多设置</view>
					<view class="form-group-card">
						<!-- 备注 -->
						<view class="form-item border-bottom">
							<view class="label-box">
								<text class="label-text">备注</text>
							</view>
							<input 
								class="input-control"
								:value="form.description" 
								placeholder="选填，备注信息" 
								placeholder-class="placeholder-style"
								@input="form.description = $event.detail.value" 
							/>
						</view>
						
						<!-- 状态选择 -->
						<view class="status-selection-row">
							<view 
								class="status-tab" 
								:class="{ active: form.status === 'planning' }"
								@tap="form.status = 'planning'"
							>
								<text>计划中</text>
							</view>
							<view class="split-bar"></view>
							<view 
								class="status-tab" 
								:class="{ active: form.status === 'departed' }"
								@tap="form.status = 'departed'"
							>
								<text>进行中</text>
							</view>
							<view class="split-bar"></view>
							<view 
								class="status-tab" 
								:class="{ active: form.status === 'finished' }"
								@tap="form.status = 'finished'"
							>
								<text>已结束</text>
							</view>
						</view>
					</view>

					<!-- 底部占位，防止内容被按钮遮挡 -->
					<view style="height: 120rpx;"></view>
				</scroll-view>

				<view class="popup-footer safe-area-inset-bottom">
					<button 
						class="confirm-btn-blue"
						@tap="submitCreate" 
						:loading="submitting"
					>
						立即创建
					</button>
				</view>
			</view>
		</van-popup>

		<!-- 日历弹窗 -->
		<van-calendar 
			:show="showCalendar" 
			type="range" 
			@close="showCalendar = false" 
			@confirm="onCalendarConfirm" 
			color="#9F7AEA" 
		/>
        
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
		departed: '进行中',
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

const formatDateRefined = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
};

const calculateDays = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diff = end.getTime() - start.getTime();
    // 包含起始日，所以 +1
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
};

const getPackPercent = (item: any) => {
    if (!item.items || item.items.length === 0) return 0;
    // 后端返回的是 checked 字段，不是 packed
    const packedItems = item.items.filter((i: any) => i.checked).length;
    return Math.round((packedItems / item.items.length) * 100);
};
</script>

<style lang="scss" scoped>
.suitcase-list-page {
	min-height: 100vh;
	background-color: #FDFDFE;
	display: flex;
	flex-direction: column;
	position: relative;

	.list-container {
		flex: 1;
		padding: 30rpx;
		box-sizing: border-box;
        padding-bottom: 120rpx;
		z-index: 1;
	}

	.create-banner {
		margin-bottom: 30rpx;
		background: linear-gradient(135deg, #b794f4 0%, #e0bbf7 50%, #f6ad55 100%);
		border-radius: 24rpx;
		padding: 40rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-shadow: 0 8rpx 20rpx rgba(183, 148, 244, 0.3);
		color: #fff;
		position: relative;
		overflow: hidden;

		.banner-content {
			display: flex;
			align-items: center;
			gap: 20rpx;
			z-index: 1;

			.icon-box {
				background: rgba(255, 255, 255, 0.25);
				border-radius: 20rpx;
				width: 80rpx;
				height: 80rpx;
				display: flex;
				align-items: center;
				justify-content: center;
				backdrop-filter: blur(4px);
			}

			.text-box {
				display: flex;
				flex-direction: column;
				gap: 4rpx;

				.main-text {
					font-size: 34rpx;
					font-weight: 600;
					letter-spacing: 1rpx;
				}

				.sub-text {
					font-size: 24rpx;
					opacity: 0.9;
				}
			}
		}

		.banner-decoration {
			position: absolute;
			right: -10rpx;
			bottom: -10rpx;
			transform: rotate(-15deg);
		}
	}

	.page-header {
		padding: 10rpx 0 30rpx;
		display: flex;
		flex-direction: column;
		gap: 8rpx;

		.title-row {
			display: flex;
			justify-content: space-between;
			align-items: center;

			.page-title {
				font-size: 48rpx;
				font-weight: 800;
				color: #4A5568;
				letter-spacing: -1rpx;
			}

			.action-btn {
				font-size: 28rpx;
				color: #805AD5;
				background: rgba(128, 90, 213, 0.1);
				padding: 8rpx 24rpx;
				border-radius: 30rpx;
				font-weight: 500;
			}
		}

		.page-subtitle {
			font-size: 26rpx;
			color: #A0AEC0;
		}
	}

    .suitcase-card {
        margin-bottom: 30rpx;
        background: #fff;
        border-radius: 30rpx;
        overflow: hidden;
        box-shadow: 0 10rpx 30rpx rgba(0,0,0,0.03), 0 4rpx 10rpx rgba(130, 95, 200, 0.05);
        transition: all 0.2s;
        position: relative;
		border: 1rpx solid rgba(255, 255, 255, 0.6);

        &.card-hover:active {
            transform: scale(0.98);
        }

        &.checking {
            opacity: 0.9;
        }

        .edit-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.2);
			backdrop-filter: blur(0px);
            display: flex;
            align-items: flex-start;
            justify-content: flex-end;
            padding: 20rpx;
            z-index: 2;

            .checkbox {
                width: 44rpx;
                height: 44rpx;
                border: 2rpx solid #CBD5E0;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
				background: #fff;
				transition: all 0.2s;
                margin-top: 10rpx;
                margin-right: 10rpx;

				&.checked {
					background-color: #F56565;
					border-color: #F56565;
				}
            }
        }
    }

    .card-content {
        padding: 32rpx;
        background: #fff;
        width: 100%;
        box-sizing: border-box;
        position: relative;
    }

	.card-header-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24rpx;

		.dest-wrapper {
			display: flex;
			flex-direction: column;
			gap: 6rpx;

			.destination {
				font-size: 36rpx;
				font-weight: 700;
				color: #2D3748;
			}
			.name {
				font-size: 24rpx;
				color: #A0AEC0;
			}
		}

		.status-tag {
			padding: 6rpx 16rpx;
			border-radius: 12rpx;
			font-size: 22rpx;
			font-weight: 600;

			&.planning {
				background: rgba(159, 122, 234, 0.1);
				color: #9F7AEA;
			}
			&.departed {
				background: rgba(246, 173, 85, 0.15);
				color: #DD6B20;
			}
			&.finished {
				background: #EDF2F7;
				color: #718096;
			}
		}
	}

	.card-info-row {
		display: flex;
		gap: 20rpx;
		margin-bottom: 24rpx;

		.info-pill {
			display: flex;
			align-items: center;
			gap: 8rpx;
			background: #F7FAFC;
			padding: 8rpx 16rpx;
			border-radius: 8rpx;
			font-size: 22rpx;
			color: #718096;
		}
	}

	.card-divider {
		height: 2rpx;
		background: #EDF2F7;
		margin-bottom: 24rpx;
	}

	.card-footer-row {
		display: flex;
		justify-content: space-between;
		align-items: center;

		.stats-area {
			display: flex;
			gap: 30rpx;

			.stat-item {
				display: flex;
				align-items: center;
				gap: 12rpx;
				
				.stat-icon {
					width: 48rpx;
					height: 48rpx;
					border-radius: 16rpx;
					display: flex;
					align-items: center;
					justify-content: center;

					&.bg-purple { background: rgba(159, 122, 234, 0.1); }
					&.bg-orange { background: rgba(246, 173, 85, 0.15); }
				}

				.stat-text {
					font-size: 22rpx;
					color: #A0AEC0;
					
					.stat-num {
						font-size: 28rpx;
						font-weight: 700;
						color: #4A5568;
						margin-right: 2rpx;
					}
				}
			}
		}

		.progress-area {
			display: flex;
			align-items: center;
			gap: 12rpx;

			.progress-capsule {
				width: 100rpx;
				height: 12rpx;
				background: #EDF2F7;
				border-radius: 6rpx;
				overflow: hidden;

				.progress-fill {
					height: 100%;
					background: linear-gradient(90deg, #D4A5FF 0%, #F6AD55 100%);
					border-radius: 6rpx;
					transition: width 0.3s ease;
				}
			}

			.p-text {
				font-size: 22rpx;
				color: #A0AEC0;
				font-weight: 600;
				min-width: 50rpx;
				text-align: right;
			}
		}
	}

    .delete-btn {
        background-color: #FC8181;
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
        padding: 24rpx 40rpx;
        padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
        border-top: 1rpx solid #EDF2F7;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 99;
		box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05);

        .select-info {
            font-size: 28rpx;
            color: #4A5568;
			font-weight: 500;
        }
    }

    .page-bg-decoration {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 500rpx;
        background: linear-gradient(180deg, #F3E8FF 0%, #FEF3C7 50%, rgba(255,255,255,0) 100%);
        z-index: 0;
        pointer-events: none;
        opacity: 0.6;
    }

	/* Popup Styles Refined */
	.popup-content {
		height: 100%;
		display: flex;
		flex-direction: column;
		background-color: #F7F8FA;
	}

	.popup-header {
		padding: 32rpx 32rpx;
		background: #fff;
		text-align: left;
		display: flex;
		align-items: center;
		
		.title {
			font-size: 36rpx;
			font-weight: 600;
			color: #323233;
		}
	}

	.form-scroll-area {
		flex: 1;
		padding: 24rpx;
		box-sizing: border-box;
	}

	.form-group-title {
		font-size: 28rpx;
		color: #969799;
		margin: 0 12rpx 16rpx;
	}

	.form-group-card {
		background: #fff;
		border-radius: 16rpx;
		overflow: hidden;
		margin-bottom: 32rpx;
	}

	.form-item {
		display: flex;
		align-items: center;
		min-height: 108rpx;
		background: #fff;
		padding: 0 32rpx;
		
		&.border-bottom {
			position: relative;
			&:after {
				content: '';
				position: absolute;
				bottom: 0;
				left: 32rpx;
				right: 0;
				height: 1rpx;
				background-color: #ebedf0;
				transform: scaleY(0.5);
			}
		}

		&.clickable {
			&:active {
				background-color: #f9f9f9;
			}
		}

		.label-box {
			width: 180rpx;
			display: flex;
			align-items: center;
			font-size: 30rpx;
			color: #323233;
			
			.required {
				color: #ee0a24;
				margin-right: 4rpx;
				font-size: 32rpx;
				position: relative;
				top: 4rpx;
			}

			.label-text {
				font-weight: 500;
			}
		}

		.input-control {
			flex: 1;
			font-size: 30rpx;
			color: #323233;
			height: 100%;
			text-align: left;
		}
		
		.placeholder-style {
			color: #c8c9cc;
		}

		.picker-value {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: flex-end;
			font-size: 30rpx;
			
			.value-text {
				color: #323233;
				margin-right: 8rpx;
			}
			.placeholder-style {
				color: #c8c9cc;
				margin-right: 8rpx;
			}
		}
	}

	/* 状态选择改为左右横排平分布局 */
	.status-selection-row {
		display: flex;
		align-items: center;
		height: 88rpx;
		background: #fff;
		border-top: 1rpx solid #f5f6f7;

		.status-tab {
			flex: 1;
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100%;
			font-size: 28rpx;
			color: #646566;
			transition: all 0.2s;

			&.active {
				color: #1989fa;
				font-weight: 500;
				background-color: rgba(25, 137, 250, 0.08);
			}

			&:active {
				background-color: #f2f3f5;
			}
		}

		.split-bar {
			width: 1rpx;
			height: 32rpx;
			background-color: #ebedf0;
		}
	}

	.popup-footer {
		background: #fff;
		padding: 16rpx 32rpx;
		/* 确保 safe-area 处理在内 */
		padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
		box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.03);
	}

	.confirm-btn-blue {
		background: #1989fa; /* 纯蓝色 */
		color: #fff;
		border: none;
		border-radius: 999px; /* 圆角按钮 */
		font-size: 32rpx;
		height: 88rpx;
		line-height: 88rpx;
		font-weight: 600;
		letter-spacing: 1rpx;
		
		&:active {
			opacity: 0.9;
		}

		&::after {
			border: none;
		}
	}

    .empty-state {
        margin-top: 100rpx;
    }
}
</style>