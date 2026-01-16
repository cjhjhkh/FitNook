<template>
	<view class="my-page">
		<!-- 头部用户信息 -->
		<view class="user-header">
			<view class="avatar-box">
				<image :src="userInfo.avatar_url || '/static/logo.png'" mode="aspectFill" class="avatar" />
			</view>
			<view class="user-info">
				<text class="nickname">{{ userInfo.nickname || 'FitNook用户' }}</text>
				<text class="account">账号: {{ userInfo.account }}</text>
			</view>
			<view class="edit-btn" @tap="showEditProfile = true">
				<van-icon name="edit" size="20px" color="#fff" />
			</view>
		</view>

		 <!-- 新增：资产统计卡片 -->
		<view class="assets-card">
			<view class="asset-item" @tap="goPage('/pages/wardrobe/index')">
				<text class="num">{{ stats.clothes || 0 }}</text>
				<text class="label">衣物(件)</text>
			</view>
			<view class="divider"></view>
			<view class="asset-item" @tap="goPage('/pages/outfit/index')">
				<text class="num">{{ stats.outfits || 0 }}</text>
				<text class="label">搭配(套)</text>
			</view>
		</view>

		<!-- 身材数据卡片 -->
		<view class="stats-card">
			<view class="card-title">我的档案</view>
			<view class="stats-grid">
				<view class="stat-item">
					<text class="value">{{ userInfo.height || '-' }}</text>
					<text class="label">身高(cm)</text>
				</view>
				<view class="stat-item">
					<text class="value">{{ userInfo.weight || '-' }}</text>
					<text class="label">体重(kg)</text>
				</view>
				<view class="stat-item">
					<text class="value">{{ userInfo.body_shape || '-' }}</text>
					<text class="label">体型</text>
				</view>
			</view>
		</view>

		<!-- 功能列表 -->
		<view class="menu-list">
			<van-cell-group inset>
				<van-cell title="我的衣橱" icon="bag-o" is-link url="/pages/wardrobe/index" />
				<van-cell title="搭配灵感" icon="apps-o" is-link url="/pages/outfit/index" />
				<van-cell title="穿搭日历" icon="calendar-o" is-link url="/pages/outfit/diary" />
			</van-cell-group>
			
			<view class="gap"></view>
			
			<van-cell-group inset>
				<van-cell title="关于我们" icon="info-o" is-link />
				<van-cell title="设置" icon="setting-o" is-link />
			</van-cell-group>
		</view>

		<!-- 退出登录 -->
		<view class="logout-area">
			<van-button block type="default" @click="handleLogout">退出登录</van-button>
		</view>

		<!-- 编辑资料弹窗 -->
		<van-popup :show="showEditProfile" round position="bottom" custom-style="height: 60%" @close="showEditProfile = false">
			<view class="edit-popup">
				<view class="popup-title">编辑资料</view>
				<van-field
					:value="editForm.nickname"
					label="昵称"
					placeholder="请输入昵称"
					@change="editForm.nickname = $event.detail"
				/>
				<van-field
					:value="editForm.height"
					label="身高(cm)"
					type="number"
					placeholder="请输入身高"
					@change="editForm.height = $event.detail"
				/>
				<van-field
					:value="editForm.weight"
					label="体重(kg)"
					type="number"
					placeholder="请输入体重"
					@change="editForm.weight = $event.detail"
				/>
				
				<view class="picker-trigger" @tap="showShapePicker = true">
					<van-field
						:value="editForm.body_shape"
						label="体型"
						placeholder="点击选择体型"
						readonly
						is-link
					/>
				</view>

				<view class="btn-area">
					<van-button block type="primary" @click="saveProfile">保存</van-button>
				</view>
			</view>
		</van-popup>

		<!-- 体型选择器 -->
		<van-popup :show="showShapePicker" round position="bottom" @close="showShapePicker = false">
			<van-picker 
				show-toolbar 
				title="选择体型"
				:columns="shapeColumns" 
				@cancel="showShapePicker = false"
				@confirm="onShapeConfirm"
			/>
		</van-popup>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { updateProfileApi, getUserProfileApi, getUserStatsApi } from '@/api/user';

const userInfo = ref<any>({});
const stats = ref({ clothes: 0, outfits: 0 });
const showEditProfile = ref(false);
const showShapePicker = ref(false);

const editForm = ref({
	nickname: '',
	height: '',
	weight: '',
	body_shape: ''
});

const shapeColumns = ['H型', 'A型', 'V型', 'O型', 'X型'];

onShow(() => {
	const stored = uni.getStorageSync('userInfo');
	if (stored) {
		userInfo.value = stored;
		loadData(stored.account);
		
		// 初始化表单
		editForm.value = {
			nickname: stored.nickname || '',
			height: stored.height || '',
			weight: stored.weight || '',
			body_shape: stored.body_shape || ''
		};
	} else {
		// 未登录跳转
		uni.reLaunch({ url: '/pages/login/login' });
	}
});

const loadData = async (account: string) => {
	try {
		// 并行获取详情和统计
		const [profileRes, statsRes] = await Promise.all([
			getUserProfileApi(account),
			getUserStatsApi(account)
		]);

		if (profileRes.code === 200) {
			userInfo.value = { ...userInfo.value, ...profileRes.data };
			// 更新本地缓存
			uni.setStorageSync('userInfo', userInfo.value);
			
			// 更新表单回显
			editForm.value.nickname = userInfo.value.nickname;
			editForm.value.height = userInfo.value.height;
			editForm.value.weight = userInfo.value.weight;
			editForm.value.body_shape = userInfo.value.body_shape;
		}

		if (statsRes.code === 200) {
			stats.value = statsRes.data;
		}
	} catch (e) {
		console.error('加载个人数据失败', e);
	}
};

const goPage = (url: string) => {
	uni.switchTab({ url });
};

const onShapeConfirm = (event: any) => {
	const { value } = event.detail;
	editForm.value.body_shape = value;
	showShapePicker.value = false;
};

const saveProfile = async () => {
	try {
		const res: any = await updateProfileApi({
			account: userInfo.value.account,
			...editForm.value
		});
		
		if (res.code === 200) {
			uni.showToast({ title: '更新成功', icon: 'success' });
			showEditProfile.value = false;
			
			// 重新拉取最新数据
			loadData(userInfo.value.account);
		} else {
			uni.showToast({ title: res.msg || '更新失败', icon: 'none' });
		}
	} catch (e) {
		uni.showToast({ title: '网络错误', icon: 'none' });
	}
};

const handleLogout = () => {
	uni.showModal({
		title: '提示',
		content: '确定要退出登录吗？',
		success: (res) => {
			if (res.confirm) {
				uni.removeStorageSync('userInfo');
				uni.removeStorageSync('token');
				uni.reLaunch({ url: '/pages/login/login' });
			}
		}
	});
};
</script>

<style lang="scss" scoped>
.my-page {
	min-height: 100vh;
	background-color: #f7f8fa;
	padding-bottom: 40rpx;
}

.user-header {
	background: linear-gradient(135deg, #A4C2F4 0%, #d4e4fc 100%);
	padding: 60rpx 40rpx 80rpx;
	display: flex;
	align-items: center;
	position: relative;
	/* 增加底部圆弧效果，让卡片嵌入更自然 */
	border-bottom-left-radius: 40rpx;
	border-bottom-right-radius: 40rpx;

	.avatar-box {
		width: 120rpx;
		height: 120rpx;
		border-radius: 50%;
		border: 4rpx solid rgba(255,255,255,0.6);
		overflow: hidden;
		margin-right: 30rpx;
		background: #fff;
		
		.avatar {
			width: 100%;
			height: 100%;
		}
	}

	.user-info {
		flex: 1;
		color: #fff;
		
		.nickname {
			font-size: 36rpx;
			font-weight: bold;
			display: block;
			margin-bottom: 10rpx;
		}
		
		.account {
			font-size: 24rpx;
			opacity: 0.9;
		}
	}

	.edit-btn {
		padding: 20rpx;
	}
}

.assets-card {
	margin: -40rpx 30rpx 30rpx;
	background: #fff;
	border-radius: 20rpx;
	padding: 40rpx 0;
	box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);
	position: relative;
	z-index: 2;
	display: flex;
	align-items: center;

	.asset-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		
		.num {
			font-size: 40rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 8rpx;
		}
		.label {
			font-size: 24rpx;
			color: #666;
		}
	}

	.divider {
		width: 1px;
		height: 60rpx;
		background: #eee;
	}
}

.stats-card {
	margin: 0 30rpx 30rpx;
	background: #fff;
	border-radius: 20rpx;
	padding: 30rpx;
	box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
	position: relative;
	z-index: 1;

	.card-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #333;
		margin-bottom: 30rpx;
	}

	.stats-grid {
		display: flex;
		justify-content: space-around;
		
		.stat-item {
			display: flex;
			flex-direction: column;
			align-items: center;
			
			.value {
				font-size: 36rpx;
				font-weight: bold;
				color: #333;
				margin-bottom: 8rpx;
			}
			
			.label {
				font-size: 24rpx;
				color: #999;
			}
		}
	}
}

.menu-list {
	margin-bottom: 40rpx;
	.gap {
		height: 20rpx;
	}
}

.logout-area {
	padding: 0 30rpx;
}

.edit-popup {
	padding: 30rpx;
	
	.popup-title {
		font-size: 32rpx;
		font-weight: bold;
		text-align: center;
		margin-bottom: 40rpx;
	}
	
	.btn-area {
		margin-top: 60rpx;
	}
}
</style>
