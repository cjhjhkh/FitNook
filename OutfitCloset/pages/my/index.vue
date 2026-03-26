<template>
	<view class="my-page">
		<!-- 头部用户信息 -->
		<view class="user-header">
			<view class="avatar-box" @tap="onChooseAvatar">
				<image :src="userInfo.avatar_url || '/static/logo.png'" mode="aspectFill" class="avatar" />
			</view>
			<view class="user-info">
				<text class="nickname">{{ userInfo.nickname || 'FitNook用户' }}</text>
				<text class="account">账号: {{ userInfo.account }}</text>
				<text class="signature" v-if="userInfo.signature">{{ userInfo.signature }}</text>
			</view>
			<view class="edit-btn" @tap="showEditProfile = true">
				<van-icon name="edit" size="20px" color="#fff" />
			</view>
		</view>

		 <!-- 新增：资产统计卡片 -->
		<view class="assets-card">
			<view class="asset-item" @tap="goPage('/pages/wardrobe/analysis')">
				<text class="num">{{ stats.clothes || 0 }}</text>
				<text class="label">衣物(件)</text>
			</view>
			<view class="divider"></view>
			<view class="asset-item" @tap="goPage('/pages/outfit/index')">
				<text class="num">{{ stats.outfits || 0 }}</text>
				<text class="label">搭配(套)</text>
			</view>
		</view>

		 <!-- 新增：社区入口卡片 -->
		<view class="social-entry-card" @tap="goPage('/pages/social/index')">
			<view class="left">
				<van-icon name="friends-o" size="24px" color="#fff" class="icon" />
				<view class="text-content">
					<text class="title">穿搭社区</text>
					<text class="desc">发现更多灵感，分享你的OOTD</text>
				</view>
			</view>
			<van-icon name="arrow" color="#fff" />
		</view>

		<!-- 身材数据卡片 -->
		<view class="stats-card">
			<view class="card-header-compact">
				<view class="header-left">
					<view class="header-line"></view>
					<view class="card-title">我的档案</view>
				</view>
				<!-- 基础信息放顶部，右对齐 -->
				<view class="basic-info-tags">
					<view class="info-tag">
						<van-icon name="contact" size="12px" style="margin-right: 2px;"/>
						{{ formatGender(userInfo.gender) }}
					</view>
					<view class="info-tag">
						<van-icon name="gift-o" size="12px" style="margin-right: 2px;"/> 
						{{ formatDate(userInfo.birthday) }}
					</view>
				</view>
			</view>
			
			<!-- 第一行：身高、体重、体型 (紫色系) -->
			<view class="stats-grid-compact">
				<view class="stat-box-compact purple-theme">
					<text class="label">身高</text>
					<text class="value">{{ userInfo.height || '-' }} <text class="unit">cm</text></text>
				</view>
				<view class="stat-box-compact purple-theme">
					<text class="label">体重</text>
					<text class="value">{{ userInfo.weight || '-' }} <text class="unit">kg</text></text>
				</view>
				<view class="stat-box-compact purple-theme">
					<text class="label">体型</text>
					<text class="value">{{ userInfo.body_shape || '-' }}</text>
				</view>
			</view>

			<!-- 第二行：肤色、风格 (黄色系) -->
			<view class="stats-grid-compact mt-16">
				<view class="stat-box-compact yellow-theme">
					<text class="label">肤色</text>
					<text class="value">{{ userInfo.skin_tone || '-' }}</text>
				</view>
				<view class="stat-box-compact yellow-theme flex-2">
					<text class="label">风格偏好</text>
					<text class="value text-ellipsis">{{ userInfo.style_preference || '-' }}</text>
				</view>
			</view>
		</view>

		<!-- 功能列表 -->
		<view class="menu-list">
			<van-cell-group inset>
				<van-cell title="我的衣橱" icon="bag-o" is-link @click="goPage('/pages/wardrobe/index')" />
				<van-cell title="搭配灵感" icon="apps-o" is-link @click="goPage('/pages/outfit/index')" />
				<van-cell title="穿搭日历" icon="calendar-o" is-link @click="goPage('/pages/outfit/diary')" />
			</van-cell-group>
			
			<view class="gap"></view>
			
			<van-cell-group inset>
                <!-- 新增：我的收藏入口，位置在穿搭日历下方 -->
                <van-cell title="我的收藏" icon="star-o" is-link @click="goPage('/pages/my/favorites')" />
				<van-cell title="关于我们" icon="info-o" is-link />
				<van-cell title="设置" icon="setting-o" is-link @click="goPage('/pages/my/settings')" />
			</van-cell-group>
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

				<view class="picker-trigger" @tap="showSkinPicker = true">
					<van-field
						:value="editForm.skin_tone"
						label="肤色"
						placeholder="点击选择肤色"
						readonly
						is-link
					/>
				</view>

				<van-field
					:value="editForm.style_preference"
					label="风格偏好"
					placeholder="例如：极简、复古、运动 (逗号分隔)"
					@change="editForm.style_preference = $event.detail"
				/>

				<van-field
					:value="editForm.signature"
					label="个性签名"
					type="textarea"
					autosize
					placeholder="介绍一下你自己..."
					@change="editForm.signature = $event.detail"
				/>

				<view class="picker-trigger" @tap="showGenderPicker = true">
					<van-field
						:value="formatGender(editForm.gender)"
						label="性别"
						placeholder="点击选择性别"
						readonly
						is-link
					/>
				</view>

				<view class="picker-trigger" @tap="showDatePicker = true">
					<van-field
						:value="editForm.birthday"
						label="生日"
						placeholder="点击选择生日"
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

		<!-- 肤色选择器 -->
		<van-popup :show="showSkinPicker" round position="bottom" @close="showSkinPicker = false">
			<van-picker 
				show-toolbar 
				title="选择肤色"
				:columns="skinColumns" 
				@cancel="showSkinPicker = false"
				@confirm="onSkinConfirm"
			/>
		</van-popup>

		<!-- 性别选择器 -->
		<van-popup :show="showGenderPicker" round position="bottom" @close="showGenderPicker = false">
			<van-picker 
				show-toolbar 
				title="选择性别"
				:columns="genderColumns" 
				@cancel="showGenderPicker = false"
				@confirm="onGenderConfirm"
			/>
		</van-popup>

		<!-- 生日选择器 -->
		<van-popup :show="showDatePicker" round position="bottom" @close="showDatePicker = false">
			<van-datetime-picker
				type="date"
				:value="currentDate"
				:min-date="minDate"
				:max-date="maxDate"
				@cancel="showDatePicker = false"
				@confirm="onDateConfirm"
			/>
		</van-popup>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { updateProfileApi, getUserProfileApi, getUserStatsApi } from '@/api/user';
import { BASE_URL } from '@/utils/request';

const userInfo = ref<any>({});
const stats = ref({ clothes: 0, outfits: 0 });
const showEditProfile = ref(false);
const showShapePicker = ref(false);
const showSkinPicker = ref(false);
const showGenderPicker = ref(false); // 新增
const showDatePicker = ref(false); // 新增

// 日期选择器配置
const minDate = new Date(1950, 0, 1).getTime();
const maxDate = new Date().getTime();
const currentDate = ref(new Date().getTime());

const editForm = ref({
	nickname: '',
	avatar_url: '', // 新增
	height: '',
	weight: '',
	body_shape: '',
	skin_tone: '',
	style_preference: '',
	signature: '', // 新增
	gender: '',    // 新增
	birthday: ''   // 新增
});

const shapeColumns = ['H型', 'A型', 'V型', 'O型', 'X型'];
const skinColumns = ['冷白皮', '暖白皮', '黄一白', '黄二白', '小麦色', '黝黑'];
const genderColumns = ['男', '女', '保密', '其他']; // 性别选项

// 性别映射
const genderMapReverse: Record<string, string> = { '男': 'MALE', '女': 'FEMALE', '保密': 'SECRET', '其他': 'OTHER' };
const genderMap: Record<string, string> = { 'MALE': '男', 'FEMALE': '女', 'SECRET': '保密', 'OTHER': '其他' };

const formatGender = (val: string) => genderMap[val] || val || '-';
const formatDate = (val: string) => val ? val.substring(0, 10) : '-';

onShow(() => {
	const stored = uni.getStorageSync('userInfo');
	if (stored) {
		userInfo.value = stored;
		loadData(stored.account);
		
		// 初始化表单
		initEditForm(stored);
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
			initEditForm(userInfo.value);
		}

		if (statsRes.code === 200) {
			stats.value = statsRes.data;
		}
	} catch (e) {
		console.error('加载个人数据失败', e);
	}
};

// 抽取表单初始化逻辑
const initEditForm = (data: any) => {
	editForm.value = {
		nickname: data.nickname || '',
		avatar_url: data.avatar_url || '',
		height: data.height || '',
		weight: data.weight || '',
		body_shape: data.body_shape || '',
		skin_tone: data.skin_tone || '',
		style_preference: data.style_preference || '',
		signature: data.signature || '',
		gender: data.gender || 'SECRET',
		birthday: data.birthday || ''
	};
	if (data.birthday) {
		currentDate.value = new Date(data.birthday).getTime();
	}
};

const goPage = (url: string) => {
	const tabBarPages = [
		'/pages/index/index',
		'/pages/wardrobe/index',
		'/pages/outfit/index',
		'/pages/my/index'
	];
	
	if (tabBarPages.includes(url)) {
		uni.switchTab({ url });
	} else {
		uni.navigateTo({ url });
	}
};

// 头像上传逻辑
const onChooseAvatar = () => {
	uni.chooseImage({
		count: 1,
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: async (res) => {
			const tempFilePath = res.tempFilePaths[0];
			uni.showLoading({ title: '上传中...' });
			
			uni.uploadFile({
				url: `${BASE_URL}/upload`, 
				filePath: tempFilePath,
				name: 'file',
				formData: {
					type: 'avatar'
				},
				header: {
					'Authorization': uni.getStorageSync('token') ? `Bearer ${uni.getStorageSync('token')}` : ''
				},
				success: (uploadRes) => {
					uni.hideLoading();
					try {
						const data = JSON.parse(uploadRes.data);
						if (data.code === 200) {
							const newAvatarUrl = data.url;
							
							// 立即更新头像到后端
							updateProfileApi({
								account: userInfo.value.account,
								avatar_url: newAvatarUrl
							}).then(apiRes => {
								if (apiRes.code === 200) {
									// 更新本地显示
									userInfo.value.avatar_url = newAvatarUrl;
									// 同步到 editForm
									editForm.value.avatar_url = newAvatarUrl;
									// 更新缓存
									uni.setStorageSync('userInfo', userInfo.value);
									uni.showToast({ title: '头像更新成功', icon: 'success' });
								} else {
									uni.showToast({ title: apiRes.msg || '头像保存失败', icon: 'none' });
								}
							}).catch(() => {
								uni.showToast({ title: '网络异常，保存失败', icon: 'none' });
							});

						} else {
							uni.showToast({ title: data.msg || '上传失败', icon: 'none' });
						}
					} catch (e) {
						uni.showToast({ title: '解析失败', icon: 'none' });
					}
				},
				fail: (err) => {
					uni.hideLoading();
					console.error(err);
					uni.showToast({ title: '网络错误', icon: 'none' });
				}
			});
		}
	});
};

const onShapeConfirm = (event: any) => {
	const { value } = event.detail;
	editForm.value.body_shape = value;
	showShapePicker.value = false;
};

// 新增肤色选择回调
const onSkinConfirm = (event: any) => {
	const { value } = event.detail;
	editForm.value.skin_tone = value;
	showSkinPicker.value = false;
};

// 性别选择
const onGenderConfirm = (event: any) => {
	const { value } = event.detail;
	editForm.value.gender = genderMapReverse[value];
	showGenderPicker.value = false;
};

// 日期选择
const onDateConfirm = (event: any) => {
	const timestamp = event.detail;
	const date = new Date(timestamp);
	// 格式化为 YYYY-MM-DD
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	editForm.value.birthday = `${year}-${month}-${day}`;
	showDatePicker.value = false;
};

const saveProfile = async () => {
	if (!userInfo.value.account) {
		uni.showToast({ title: '账号异常', icon: 'none' });
		return;
	}
	
	uni.showLoading({ title: '保存中...', mask: true });
	try {
		const res: any = await updateProfileApi({
			account: userInfo.value.account,
			...editForm.value
		});
		
		uni.hideLoading();
		
		if (res.code === 200) {
			uni.showToast({ title: '更新成功', icon: 'success' });
			showEditProfile.value = false;
			
			// 重新拉取最新数据
			loadData(userInfo.value.account);
		} else {
			uni.showToast({ title: res.msg || '更新失败', icon: 'none' });
		}
	} catch (e) {
		uni.hideLoading();
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

		.signature {
			font-size: 22rpx;
			opacity: 0.8;
			margin-top: 8rpx;
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			overflow: hidden;
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

.social-entry-card {
	margin: 0 30rpx 30rpx;
	background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%);
	border-radius: 20rpx;
	padding: 30rpx 40rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-shadow: 0 8rpx 16rpx rgba(255, 154, 158, 0.3);
	
	.left {
		display: flex;
		align-items: center;
		
		.icon {
			margin-right: 20rpx;
			background: rgba(255,255,255,0.2);
			padding: 10rpx;
			border-radius: 50%;
		}
		
		.text-content {
			display: flex;
			flex-direction: column;
			
			.title {
				font-size: 32rpx;
				font-weight: bold;
				color: #fff;
				margin-bottom: 4rpx;
			}
			.desc {
				font-size: 24rpx;
				color: rgba(255,255,255,0.9);
			}
		}
	}
}

.stats-card {
	margin: 0 30rpx 30rpx;
	background: #fff;
	border-radius: 24rpx;
	padding: 30rpx; /* 减小内边距 */
	box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.03);
	position: relative;
	z-index: 1;

	.card-header-compact {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24rpx;
		
		.header-left {
			display: flex;
			align-items: center;
			
			.header-line {
				width: 6rpx;
				height: 28rpx;
				background: #9B7EBD;
				border-radius: 4rpx;
				margin-right: 16rpx;
			}
			
			.card-title {
				font-size: 30rpx;
				font-weight: 600;
				color: #2c3e50;
			}
		}
		
		.basic-info-tags {
			display: flex;
			gap: 12rpx;
			
			.info-tag {
				font-size: 22rpx;
				color: #666;
				background: #f5f5f5;
				padding: 4rpx 16rpx;
				border-radius: 20rpx;
				display: flex;
				align-items: center;
			}
		}
	}

	.stats-grid-compact {
		display: flex;
		gap: 16rpx;
		width: 100%;
		
		&.mt-16 {
			margin-top: 16rpx;
		}
		
		.flex-2 {
			flex: 1.5; /* 稍微给多一点空间 */
		}

		.stat-box-compact {
			flex: 1;
			background: #F8F9FA;
			border-radius: 12rpx;
			padding: 16rpx 20rpx; /* 紧凑padding */
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: flex-start; /* 左对齐更紧凑 */
			
			/* 紫色主题 */
			&.purple-theme {
				background: rgba(155, 126, 189, 0.08);
				.label { color: #8E7AA5; }
			}
			
			/* 黄色主题 */
			&.yellow-theme {
				background: rgba(249, 231, 159, 0.15);
				.label { color: #A89552; }
			}
			
			.label {
				font-size: 20rpx;
				margin-bottom: 4rpx;
			}

			.value {
				font-size: 28rpx; /* 字体稍微改小，适应紧凑布局 */
				font-weight: bold;
				color: #333;
				line-height: 1.2;
				
				.unit {
					font-size: 20rpx;
					font-weight: normal;
					color: #666;
					margin-left: 2rpx;
				}
			}
			
			.text-ellipsis {
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				max-width: 100%;
				display: block;
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
