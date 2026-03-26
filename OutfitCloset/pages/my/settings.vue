<template>
	<view class="settings-container">
		<view class="section-box">
			<van-cell-group inset>
				<van-cell title="账号安全" is-link />
				<van-cell title="通用设置" is-link />
				<van-cell title="消息通知" is-link />
				<van-cell title="隐私设置" is-link />
			</van-cell-group>
		</view>

		<view class="section-box">
			<van-cell-group inset>
				<van-cell title="清除缓存" value="12.5MB" is-link @click="handleClearCache" />
				<van-cell title="关于 FitNook" value="v1.0.0" is-link />
			</van-cell-group>
		</view>

		<view class="logout-btn">
			<van-button block type="danger" @click="handleLogout">退出登录</van-button>
		</view>
	</view>
</template>

<script setup lang="ts">
const handleLogout = () => {
	uni.showModal({
		title: '提示',
		content: '确定要退出登录吗？',
		success: (res) => {
			if (res.confirm) {
				// 清除本地存储
				uni.removeStorageSync('userInfo');
				uni.removeStorageSync('token');
				// 跳转回登录页
				uni.reLaunch({ url: '/pages/login/login' });
			}
		}
	});
};

const handleClearCache = () => {
	uni.showToast({ title: '清理完成', icon: 'success' });
};
</script>

<style lang="scss" scoped>
.settings-container {
	min-height: 100vh;
	background-color: #f7f8fa;
	padding-top: 20rpx;
}

.section-box {
	margin-bottom: 30rpx;
}

.logout-btn {
	margin-top: 60rpx;
	padding: 0 30rpx;
}
</style>