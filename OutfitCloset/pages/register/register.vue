<template>
	<view class="register-container">
		<view class="content-wrapper">
			<view class="header">
				<text class="title">Create Account</text>
				<text class="subtitle">Join FitNook today</text>
			</view>

			<view class="auth-card">
				<view class="input-group">
					<view class="input-item">
						<van-icon name="manager-o" size="20px" color="#9d84e8" class="icon" />
						<input v-model="form.account" placeholder="Account Name" placeholder-class="placeholder" />
					</view>
					<view class="divider"></view>
					<view class="input-item">
						<van-icon name="lock" size="20px" color="#9d84e8" class="icon" />
						<input v-model="form.password" type="password" placeholder="Password" placeholder-class="placeholder" />
					</view>
					<view class="divider"></view>
					<view class="input-item">
						<van-icon name="checked" size="20px" color="#9d84e8" class="icon" />
						<input v-model="form.confirmPassword" type="password" placeholder="Confirm Password" placeholder-class="placeholder" />
					</view>
				</view>
				
				<button class="submit-btn" @click="handleRegister">
					<text>Sign Up</text>
					<van-icon name="arrow" color="#fff" size="16px" />
				</button>
			</view>

			<view class="footer-actions">
				<text class="action-text">Already have an account?</text>
				<text class="link-text" @click="goLogin">Log In</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { registerApi } from '@/api/user';

const form = reactive({
	account: '',
	password: '',
	confirmPassword: ''
});

const handleRegister = async () => {
	if (!form.account || !form.password || !form.confirmPassword) {
		return uni.showToast({ title: 'Please fill in all fields', icon: 'none' });
	}
	if (form.password !== form.confirmPassword) {
		return uni.showToast({ title: 'Passwords do not match', icon: 'none' });
	}

	try {
		uni.showLoading({ title: 'Creating account...' });
		const res: any = await registerApi({
			account: form.account,
			password: form.password,
			confirmPassword: form.confirmPassword
		});

		if (res.code === 200) {
			uni.showToast({ title: 'Success! Please Login', icon: 'success' });
			setTimeout(() => {
				uni.navigateBack();
			}, 1500);
		} else {
			uni.showToast({ title: res.msg || 'Registration failed', icon: 'none' });
		}
	} catch (err) {
		console.error(err);
	} finally {
		uni.hideLoading();
	}
};

const goLogin = () => {
	uni.navigateBack();
};
</script>

<style lang="scss" scoped>
.register-container {
	min-height: 100vh;
	background-color: #ffffff; /* 纯白背景 */
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 0 40rpx;

	.header {
		margin-bottom: 60rpx;
		.title {
			font-size: 56rpx;
			font-weight: 800;
			color: #4a4a4a; /* 深灰 */
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
		border: 1px solid #f2effd;

		.input-group {
			background: #fbfaff; /* 极淡紫 */
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
					color: #c4b5fd;
				}
			}

			.divider {
				height: 2rpx;
				background: #eee;
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
			color: #999;
			margin-right: 12rpx;
		}
		
		.link-text {
			font-size: 28rpx;
			color: #8e72dc; /* 浅紫 */
			font-weight: bold;
            padding: 10rpx;
		}
	}
}
</style>