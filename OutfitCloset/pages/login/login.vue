<template>
	<view class="login-container">
		<view class="illustration-section">
			<!-- 临时替换为已存在的图片，原路径 /static/images/fashion-girl.png 不存在 -->
			<image class="main-char" src="/static/image/clothing1.png" mode="aspectFit" />
			<view class="floating-icons">
				<view class="icon-item t-shirt"></view>
				<view class="icon-item pants"></view>
			</view>
		</view>

		<view class="slogan-section">
			<text class="title">Unlock Your Style Journey!</text>
			<text class="subtitle">Your Passport to a Smarter Wardrobe</text>
		</view>

		<view class="form-section">
			<view class="input-wrap">
					<van-icon name="manager" size="18px" color="#999" />
				<input v-model="form.account" placeholder="account / Email" placeholder-class="placeholder-style" />
			</view>

			<view class="input-wrap">
					<van-icon name="lock" size="18px" color="#999" />
				<input v-model="form.password" type="password" placeholder="Password"
					placeholder-class="placeholder-style" />
				<view class="eye-icon">
					<van-icon name="eye-o" size="18px" color="#999" />
				</view>
			</view>

			<button class="btn-camera-login" @click="handleLogin">
				<van-icon name="guide-o" size="20px" color="#fff" style="margin-right: 8px;" />
				<text>Sign In Now</text>
			</button>

			<view class="register-link" @click="toRegister">
				<van-icon name="add-o" size="18px" color="#fff" />
				<text>Create New Account</text>
			</view>
		</view>

		<view class="footer-links">
			<text class="link">Forgot Password</text>
			<text class="link">Browse as Guest</text>
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


	uni.showLoading({ title: 'Signing in...' });

	try {
		// 2. 调用真实的 API 接口
		const res: any = await loginApi({
			account: form.account,
			password: form.password
		});
		
		console.log('Login response:', res);

		// 3. 存储 Token 和用户信息到本地缓存
		if (res && res.code === 200) {
			// 兼容处理：防止后端返回结构变化，尝试从 res 或 res.data 中获取
			const userInfo = res.userInfo || (res.data && res.data.userInfo);
			const token = res.token || (res.data && res.data.token);
			
			if (!userInfo) {
				console.error('User info is missing in response', res);
				uni.showToast({ title: 'Login error: User info missing', icon: 'none' });
				return;
			}
			
			uni.setStorageSync('token', token);
			uni.setStorageSync('userInfo', userInfo);

			uni.showToast({ title: 'Welcome Back!', icon: 'success' });

			// 4. 跳转首页：通过 URL 参数告知首页弹出你的“引导卡片”
			setTimeout(() => {
				// 严格检查 userInfo 是否存在，以及 is_profile_completed 属性
				// 使用可选链 ?. (如果环境支持) 或者传统检查
				const isCompleted = userInfo ? userInfo.is_profile_completed : 1;
				
				// 如果是 0，说明未完成资料
				const url = (isCompleted === 0)
					? '/pages/index/index?isNewUser=true'
					: '/pages/index/index';
					
				uni.reLaunch({ url });
			}, 1000);
		} else {
			uni.showToast({ title: res.message || 'Login failed', icon: 'none' });
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
/* 完全保留你提供的 UI 样式 */
.login-container {
	min-height: 100vh;
	background-color: #1a5286;
	padding: 60rpx 50rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	position: relative;

	.illustration-section {
		height: 400rpx;
		position: relative;
		margin-top: 40rpx;

		.main-char {
			width: 350rpx;
			height: 350rpx;
		}
	}

	.slogan-section {
		text-align: center;
		margin: 60rpx 0;

		.title {
			font-size: 44rpx;
			font-weight: 600;
			color: #ffffff;
			display: block;
			letter-spacing: 1rpx;
		}

		.subtitle {
			font-size: 26rpx;
			color: rgba(255, 255, 255, 0.7);
			margin-top: 15rpx;
			display: block;
		}
	}

	.form-section {
		width: 100%;

		.input-wrap {
			background-color: #ffffff;
			height: 100rpx;
			border-radius: 20rpx;
			display: flex;
			align-items: center;
			padding: 0 30rpx;
			margin-bottom: 30rpx;

			input {
				flex: 1;
				margin-left: 20rpx;
				font-size: 28rpx;
				color: #333;
			}

			.placeholder-style {
				color: #ccc;
			}
		}

		.btn-camera-login {
			background-color: #0c1c2c;
			height: 110rpx;
			border-radius: 55rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			color: #fff;
			font-weight: 500;
			margin-top: 50rpx;
			border: none;

			&:active {
				opacity: 0.9;
				transform: scale(0.98);
			}

			text {
				margin-left: 15rpx;
			}
		}

		.register-link {
			display: flex;
			align-items: center;
			justify-content: center;
			margin-top: 40rpx;
			color: #fff;
			font-size: 28rpx;

			text {
				margin-left: 10rpx;
				border-bottom: 1px solid #fff;
			}
		}
	}

	.footer-links {
		position: absolute;
		bottom: 80rpx;
		width: 80%;
		display: flex;
		justify-content: space-between;

		.link {
			font-size: 24rpx;
			color: rgba(255, 255, 255, 0.8);
		}
	}
}
</style>