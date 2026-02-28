<template>
	<view class="suitcase-detail-page">
		<!-- 顶部概览 -->
		<view class="info-header" v-if="detail">
			<view class="header-content">
				<view class="title-row">
					<text class="title">{{ detail.name }}</text>
					<van-tag :type="getStatusType(detail.status)" size="medium" round custom-class="status-tag">
						{{ getStatusText(detail.status) }}
					</van-tag>
				</view>
				<view class="sub-info">
					<view class="info-item">
						<van-icon name="location-o" />
						<text>{{ detail.destination || '目的地未定' }}</text>
					</view>
					<view class="info-item">
						<van-icon name="calendar-o" />
						<text>{{ dateStr }}</text>
					</view>
				</view>
				<view class="desc" v-if="detail.description" @tap="showEditPopup = true">
					{{ detail.description }}
				</view>
			</view>
			<view class="edit-btn" @tap="showEditPopup = true">
				<van-icon name="edit" size="20px" color="#666" />
			</view>
		</view>

		<!-- 进度条 -->
		<view class="progress-section" v-if="detail && detail.items && detail.items.length > 0">
			<view class="progress-info">
				<text>装箱进度</text>
				<text class="count">{{ checkedCount }}/{{ detail.items.length }}</text>
			</view>
			<van-progress :percentage="progressPercentage" stroke-width="8" color="#1989fa" track-color="#e5e5e5" :show-pivot="false" />
		</view>

		<!-- 内容区域 -->
		<view class="content-body">
			<van-tabs :active="activeTab" @change="onTabChange" sticky animated swipeable color="#1989fa">
				<van-tab title="衣物清单">
					<view class="list-container">
						<view v-if="!detail || !detail.items || detail.items.length === 0" class="empty-state">
							<van-empty description="还没添加衣物，快去添加吧" />
							<van-button type="info" size="small" plain round @click="goToAddItems">去添加衣物</van-button>
						</view>

						<view v-else class="items-grid">
							<view v-for="(item, index) in detail.items" :key="item.cloth_id || index" 
								class="cloth-item" :class="{ checked: item.checked }"
								@tap="toggleCheck(index)">
								<view class="img-wrapper">
									<image :src="item.image_url || '/static/logo.png'" mode="aspectFill" class="c-img" />
									<view class="check-overlay" v-if="item.checked">
										<van-icon name="success" color="#fff" size="20px" />
									</view>
								</view>
								<view class="c-info">
									<text class="c-name">{{ item.name || '未命名衣物' }}</text>
								</view>
								<!-- 删除按钮（长按或点击角落） -->
								<view class="del-btn" @tap.stop="removeItem(index)">
									<van-icon name="cross" size="12px" color="#fff" />
								</view>
							</view>
						</view>
					</view>
				</van-tab>
				
				<van-tab title="搭配方案">
					<view class="outfit-container">
						<view v-if="!detail || !detail.outfits_detail || detail.outfits_detail.length === 0" class="empty-state">
							<van-empty description="还没规划搭配，去选几套吧" />
							<van-button type="info" size="small" plain round @click="goToAddOutfits">去添加搭配</van-button>
						</view>

						<view v-else class="outfit-list">
							<view v-for="(outfit, index) in detail.outfits_detail" :key="outfit.id" class="outfit-card" @tap="previewOutfit(outfit)">
								<view class="outfit-cover">
									<image :src="getOutfitCover(outfit)" mode="aspectFill" class="o-img" />
								</view>
								<view class="outfit-info">
									<text class="o-name">{{ outfit.name || '未命名搭配' }}</text>
									<text class="o-sub">{{ outfit.items ? outfit.items.length + '件单品' : '' }}</text>
								</view>
								<view class="o-action" @tap.stop="removeOutfit(index)">
									<van-icon name="delete-o" size="18px" color="#999" />
								</view>
							</view>
						</view>
					</view>
				</van-tab>
			</van-tabs>
		</view>
        
        <!-- 底部添加按钮 -->
        <view class="bottom-action-bar safe-area-inset-bottom">
			<view class="action-btn" @tap="goToAddItems">
				<van-icon name="t-shirt-o" size="20px" />
				<text>加衣物</text>
			</view>
			<view class="divider"></view>
			<view class="action-btn" @tap="goToAddOutfits">
				<van-icon name="apps-o" size="20px" />
				<text>加搭配</text>
			</view>
        </view>

        <!-- 编辑弹窗 -->
        <van-popup :show="showEditPopup" round position="bottom" custom-style="height: 60%" @close="showEditPopup = false">
			<view class="popup-content">
				<view class="popup-title">修改行程信息</view>
				<van-cell-group>
					<van-field :value="editForm.name" label="名称" placeholder="行程名称" @change="e => editForm.name = e.detail" />
					<van-field :value="editForm.destination" label="目的地" placeholder="目的地" @change="e => editForm.destination = e.detail" />
					<van-cell title="日期范围" :value="editDateDisplay" is-link @click="showCalendar = true" />
					<van-field :value="editForm.description" label="备注" type="textarea" placeholder="填写备注..." autosize @change="e => editForm.description = e.detail" />
                    <van-cell title="当前状态">
                        <van-radio-group :value="editForm.status" direction="horizontal" @change="onStatusChange">
                            <van-radio name="planning">计划中</van-radio>
                            <van-radio name="departed">进行中</van-radio>
                            <van-radio name="finished">已结束</van-radio>
                        </van-radio-group>
                    </van-cell>
				</van-cell-group>
				<view class="popup-footer">
					<van-button type="info" block round @click="handleUpdateInfo">保存修改</van-button>
				</view>
			</view>
        </van-popup>
        
        <van-calendar :show="showCalendar" type="range" @close="showCalendar = false" @confirm="onCalendarConfirm" color="#1989fa" />
	</view>
</template>

// @ts-ignore
<script setup lang="ts">
import { ref, computed } from 'vue';
// @ts-ignore
import { onLoad, onShow, onUnload, onPullDownRefresh } from '@dcloudio/uni-app';
import { getSuitcaseDetail, updateSuitcase } from '@/api/suitcase';

const detail = ref<any>(null);
const suitcaseId = ref<string | number>('');
const activeTab = ref(0);
const showEditPopup = ref(false);
const showCalendar = ref(false);

// 编辑表单
const editForm = ref({
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    description: '',
    status: 'planning'
});

// 处理状态变更
const onStatusChange = (event: any) => {
    editForm.value.status = event.detail;
};

// 计算属性
const dateStr = computed(() => {
    if (!detail.value || !detail.value.start_date || !detail.value.end_date) return '未定日期';
    return `${formatDate(detail.value.start_date)} - ${formatDate(detail.value.end_date)}`;
});

const editDateDisplay = computed(() => {
    if (!editForm.value.start_date || !editForm.value.end_date) return '点击选择';
    return `${formatDate(editForm.value.start_date)} - ${formatDate(editForm.value.end_date)}`;
});

const checkedCount = computed(() => {
    if (!detail.value || !detail.value.items) return 0;
    return detail.value.items.filter((item: any) => item.checked).length;
});

const progressPercentage = computed(() => {
    if (!detail.value || !detail.value.items || detail.value.items.length === 0) return 0;
    return Math.round((checkedCount.value / detail.value.items.length) * 100);
});

// 辅助函数
const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

const getStatusText = (status: string) => {
    const map: Record<string, string> = {
        'planning': '计划中',
        'departed': '进行中',
        'finished': '已结束'
    };
    return map[status] || status;
};

const getStatusType = (status: string) => {
    const map: Record<string, string> = {
        'planning': 'primary',
        'departed': 'success',
        'finished': 'default'
    };
    return map[status] || 'primary';
};

// 获取搭配封面图
const getOutfitCover = (outfit: any) => {
    // 1. 优先使用合成图
    if (outfit.image_url) return outfit.image_url;
    // 2. 其次使用 cover_image 字段
    if (outfit.cover_image) return outfit.cover_image;
    // 3. 如果都没有，尝试取 items 里的第一张图作为封面
    if (outfit.items && outfit.items.length > 0) {
        return outfit.items[0].image_url || outfit.items[0].image || '';
    }
    // 4. 默认图 (可以在 static 目录下放一个默认图)
    return '/static/logo.png'; 
};

// 生命周期
onLoad((options: any) => {
    if (options.id) {
        suitcaseId.value = options.id;
        loadDetail();
    }
    
    // 监听子页面更新事件
    uni.$on('suitcaseUpdated', (data: any) => {
        if (data.id == suitcaseId.value) {
            loadDetail();
        }
    });
});

onUnload(() => {
    uni.$off('suitcaseUpdated');
});

// 下拉刷新
onPullDownRefresh(() => {
    loadDetail().then(() => {
        uni.stopPullDownRefresh();
    });
});

onShow(() => {
    // 每次显示页面时刷新数据，确保从 selector 返回时数据是最新的
    if (suitcaseId.value) {
        loadDetail();
    }
});

// 方法
const loadDetail = async () => {
    try {
        const res = await getSuitcaseDetail(suitcaseId.value);
        if (res.code === 200) {
            detail.value = res.data;
            // 初始化编辑表单
            editForm.value = {
                name: detail.value.name,
                destination: detail.value.destination,
                start_date: detail.value.start_date,
                end_date: detail.value.end_date,
                description: detail.value.description,
                status: detail.value.status || 'planning'
            };
        }
    } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' });
    }
};

const onTabChange = (e: any) => {
    activeTab.value = e.detail.index;
};

// 物品勾选状态切换
const toggleCheck = async (index: number) => {
    if (!detail.value || !detail.value.items) return;
    
    // 切换状态
    detail.value.items[index].checked = !detail.value.items[index].checked;
    
    // 这是一个频繁操作，是否需要防抖或延迟保存？
    // 暂时实现为立即保存
    await syncItems();
};

// 移除物品
const removeItem = async (index: number) => {
    uni.showModal({
        title: '提示',
        content: '确定要移除这个物品吗？',
        success: async (res) => {
            if (res.confirm) {
                detail.value.items.splice(index, 1);
                await syncItems();
                uni.showToast({ title: '已移除', icon: 'none' });
            }
        }
    });
};

// 移除搭配
const removeOutfit = async (index: number) => {
    uni.showModal({
        title: '提示',
        content: '确定要移出这个搭配方案吗？',
        success: async (res) => {
            if (res.confirm) {
                // 注意：这里需要确保后端支持更新 outfits 列表
                // 假设后端接受 outfits 数组 (包含id列表)
                const newOutfits = [...detail.value.outfits_detail];
                newOutfits.splice(index, 1);
                
                // 提取 id 数组用于保存
                const outfitIds = newOutfits.map(o => o.id);
                
                try {
                    await updateSuitcase({
                        id: suitcaseId.value,
                        outfits: outfitIds
                    });
                     // 只在UI上移除，或者重新拉取
                    detail.value.outfits_detail.splice(index, 1);
                    uni.showToast({ title: '已移除', icon: 'none' });
                } catch(e) {
                    uni.showToast({ title: '移除失败', icon: 'none' });
                }
            }
        }
    });
};

// 同步物品列表到后端
const syncItems = async () => {
    try {
        // 只需要传 items 字段，注意 item 结构是否匹配后端要求
        // 过滤出纯净的数据结构发送给后端，避免发送冗余的 populate 字段
        const cleanItems = (detail.value.items || []).map((item: any) => ({
            cloth_id: item.cloth_id,
            checked: !!item.checked
        }));

        await updateSuitcase({
            id: suitcaseId.value,
            items: cleanItems
        });
    } catch (e) {
        console.error('Sync failed', e);
        uni.showToast({ title: '同步状态失败', icon: 'none' });
    }
};

// 编辑信息相关
const onCalendarConfirm = (event: any) => {
    const [start, end] = event.detail;
    editForm.value.start_date = start.toISOString();
    editForm.value.end_date = end.toISOString();
    showCalendar.value = false;
};

// 跳转到添加衣物/搭配页面 (合并为一个入口页面，通过参数区分默认 tab)
const goToAddItems = () => {
    uni.navigateTo({
        url: `/pages/suitcase/selector?id=${suitcaseId.value}&tab=0`
    });
};

const goToAddOutfits = () => {
    uni.navigateTo({
        url: `/pages/suitcase/selector?id=${suitcaseId.value}&tab=1`
    });
};

const previewOutfit = (outfit: any) => {
    // 跳转到搭配详情页查看详情（只读模式）
    uni.navigateTo({
       url: `/pages/outfit/create?id=${outfit.id}&mode=view`
    });
};

const handleUpdateInfo = async () => {
    try {
        await updateSuitcase({
            id: suitcaseId.value,
            ...editForm.value
        });
        uni.showToast({ title: '保存成功', icon: 'success' });
        showEditPopup.value = false;
        loadDetail(); // 刷新数据
    } catch (e) {
        uni.showToast({ title: '保存失败', icon: 'none' });
    }
};
</script>

<style lang="scss">
.suitcase-detail-page {
    min-height: 100vh;
    background-color: #f7f8fa;
    padding-bottom: 100px;
}

.info-header {
    background: #fff;
    padding: 24rpx 32rpx;
    margin-bottom: 20rpx;
    position: relative;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.03);

    .header-content {
        padding-right: 60rpx;
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 16rpx;
        margin-bottom: 16rpx;
        
        .title {
			font-size: 36rpx;
			font-weight: bold;
			color: #333;
		}
		
		.status-tag {
			vertical-align: middle;
		}
    }

    .sub-info {
        display: flex;
        flex-wrap: wrap;
        gap: 24rpx;
        margin-bottom: 16rpx;

        .info-item {
			display: flex;
			align-items: center;
			gap: 8rpx;
			font-size: 26rpx;
			color: #666;
		}
    }

    .desc {
        font-size: 26rpx;
        color: #888;
        line-height: 1.5;
        background: #f9f9f9;
        padding: 12rpx 16rpx;
        border-radius: 8rpx;
    }

    .edit-btn {
        position: absolute;
        top: 32rpx;
        right: 32rpx;
        padding: 10rpx;
    }
}

.progress-section {
	background: #fff;
	padding: 20rpx 32rpx 32rpx;
	margin-bottom: 20rpx;
	
	.progress-info {
		display: flex;
		justify-content: space-between;
		font-size: 26rpx;
		color: #666;
		margin-bottom: 12rpx;
		
		.count {
			color: #1989fa;
			font-weight: bold;
		}
	}
}

.content-body {
    background: #fff;
    min-height: 500rpx;
}

.list-container {
    padding: 24rpx;
	
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 60rpx 0;
	}

	.items-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 20rpx;
	}
	
	.cloth-item {
		position: relative;
		width: 100%;
		
		.img-wrapper {
			width: 100%;
			aspect-ratio: 1;
			border-radius: 12rpx;
			overflow: hidden;
			background: #f5f5f5;
			position: relative;
			margin-bottom: 8rpx;
			
			.c-img {
				width: 100%;
				height: 100%;
			}
			
			.check-overlay {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(25, 137, 250, 0.6);
				display: flex;
				align-items: center;
				justify-content: center;
			}
		}
		
		.c-info {
			text-align: center;
			
			.c-name {
				font-size: 20rpx;
				color: #333;
				display: block;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
		}
		
		.del-btn {
			position: absolute;
			top: -10rpx;
			right: -10rpx;
			width: 36rpx;
			height: 36rpx;
			background: rgba(0,0,0,0.4);
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 2;
		}
		
		&.checked {
			.img-wrapper {
				border: 4rpx solid #1989fa;
			}
			.c-name {
				color: #999;
				text-decoration: line-through;
			}
		}
	}
}

.outfit-container {
    padding: 24rpx;
	
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 60rpx 0;
	}

    .outfit-list {
		display: flex;
		flex-direction: column;
		gap: 24rpx;
	}

    .outfit-card {
		background: #fff;
		border-radius: 16rpx;
		box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
		padding: 20rpx;
		display: flex;
		align-items: center;
		border: 1rpx solid #eee;
		position: relative;
		
		.outfit-cover {
			width: 120rpx;
			height: 120rpx;
			border-radius: 8rpx;
			overflow: hidden;
			background: #f0f0f0;
			margin-right: 20rpx;
			
			.o-img {
				width: 100%;
				height: 100%;
			}
		}
		
		.outfit-info {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 8rpx;
			
			.o-name {
				font-size: 30rpx;
				font-weight: 500;
				color: #333;
			}
			
			.o-sub {
				font-size: 24rpx;
				color: #999;
			}
		}
		
		.o-action {
			padding: 20rpx;
		}
	}
}

.bottom-action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1rpx solid #eee;
    padding: 20rpx 32rpx;
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 100;
    box-shadow: 0 -4rpx 12rpx rgba(0,0,0,0.03);
	padding-bottom: calc(20rpx + env(safe-area-inset-bottom));

    .action-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6rpx;
		color: #555;
		font-size: 24rpx;
		
		&:active {
			opacity: 0.7;
		}
	}
	
	.divider {
		width: 1px;
		height: 40rpx;
		background: #eee;
	}
}

.popup-content {
    display: flex;
    flex-direction: column;
    height: 100%;
	background: #fff;
    
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
</style>