<template>
	<view class="login-container">
		<view class="content-wrapper">
			<view class="header">
				<text class="title">Welcome Back</text>
				<text class="subtitle">Log in to your smart wardrobe</text>
			</view>

			<view class="auth-card">
				<view class="input-group">
					<view class="input-item">
						<van-icon name="manager-o" size="20px" color="#9d84e8" class="icon" />
						<input v-model="form.account" placeholder="Account" placeholder-class="placeholder" />
					</view>
					<view class="divider"></view>
					<view class="input-item">
						<van-icon name="lock" size="20px" color="#9d84e8" class="icon" />
						<input v-model="form.password" type="password" placeholder="Password" placeholder-class="placeholder" />
					</view>
				</view>
				
				<button class="submit-btn" @click="handleLogin">
					<text>Log In</text>
					<van-icon name="arrow" color="#fff" size="16px" />
				</button>
			</view>

			<view class="footer-actions">
				<text class="action-text" @click="toRegister">Create Account</text>
				<text class="separator">|</text>
				<text class="action-text">Forgot Password?</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { loginApi } from '@/api/user'; // 确保路径正确

const form = reactive({
	account: '',
	password: ''
});

const handleLogin = async () => {
	// 1. 必填验证
	if (!form.account || !form.password) {
		return uni.showToast({ title: 'Please fill in all fields', icon: 'none' });
	}

	// 2. 显示加载中
	uni.showLoading({ title: 'Signing in...' });

	try {
		// 3. 调用 API (修正类型定义)
		const res: any = await loginApi({
			account: form.account,
			password: form.password
		});
		
		console.log('Login response:', res);

		// 4. 处理响应
		if (res && res.code === 200) {
			// 兼容处理：防止后端返回结构变化
			const userInfo = res.userInfo || (res.data && res.data.userInfo);
			const token = res.token || (res.data && res.data.token);
			
			if (!userInfo) {
				uni.showToast({ title: 'Login error: User info missing', icon: 'none' });
				return;
			}
			
			uni.setStorageSync('token', token);
			uni.setStorageSync('userInfo', userInfo);

			uni.showToast({ title: 'Welcome Back!', icon: 'success' });

			// 5. 跳转首页
			setTimeout(() => {
				const isCompleted = userInfo.is_profile_completed;
				// 如果是 0，跳转首页带 guide 参数
				const url = (isCompleted === 0)
					? '/pages/index/index?isNewUser=true'
					: '/pages/index/index';
					
				uni.reLaunch({ url });
			}, 800);
		} else {
			uni.showToast({ title: res.msg || 'Login failed', icon: 'none' });
		}
	} catch (err: any) {
		// 错误提示已由 request.ts 拦截器统一处理，这里不需要再弹窗
		console.error('Login Error:', err);
	} finally {
		uni.hideLoading();
	}
};

const toRegister = () => {
	// 跳转到你定义的注册页
	uni.navigateTo({ url: '/pages/register/register' });
};
</script>

<style lang="scss" scoped>
.login-container {
	min-height: 100vh;
	background-color: #ffffff; /* 纯白背景 */
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 0 40rpx;

	.content-wrapper {
		width: 100%;
	}

	.header {
		margin-bottom: 60rpx;
		.title {
			font-size: 56rpx;
			font-weight: 800;
			color: #4a4a4a; /* 深灰字体 */
			display: block;
			margin-bottom: 16rpx;
		}
		.subtitle {
			font-size: 28rpx;
			color: #999;
		}
	}

	.auth-card {
		background: #fff;
		border-radius: 32rpx;
		padding: 40rpx;
		box-shadow: 0 10rpx 40rpx rgba(157, 132, 232, 0.15); /* 浅紫色阴影 */
		border: 1px solid #f2effd; /* 极淡紫边框 */

		.input-group {
			background: #fbfaff; /* 极淡紫输入框背景 */
			border-radius: 20rpx;
			padding: 10rpx 30rpx;
			margin-bottom: 40rpx;

			.input-item {
				display: flex;
				align-items: center;
				height: 100rpx;
				
				.icon {
					margin-right: 20rpx;
				}
				
				input {
					flex: 1;
					font-size: 30rpx;
					color: #333;
				}
				
				.placeholder {
					color: #c4b5fd; /* 浅紫占位符 */
				}
			}

			.divider {
				height: 2rpx;
				background: #eee; // 保持灰色以免太花
				margin: 0 10rpx;
			}
		}

		.submit-btn {
			background: linear-gradient(135deg, #b4a0f8 0%, #8e72dc 100%); /* 浅紫色渐变 */
			color: #fff;
			height: 96rpx;
			border-radius: 48rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 32rpx;
			font-weight: 600;
			box-shadow: 0 8rpx 20rpx rgba(142, 114, 220, 0.3);
			
			text {
				margin-right: 8rpx;
			}
			
			&:active {
				opacity: 0.9;
				transform: scale(0.99);
			}
		}
	}

	.footer-actions {
		display: flex;
		justify-content: center;
		align-items: center;
		margin-top: 60rpx;
		
		.action-text {
			font-size: 28rpx;
			color: #8e72dc; /* 浅紫色链接 */
			padding: 20rpx;
			
			&:active {
				color: #6a53a8;
			}
		}
		
		.separator {
			color: #ddd;
			margin: 0 10rpx;
			font-size: 24rpx;
		}
	}
}
</style>