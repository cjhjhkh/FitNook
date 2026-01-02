<template>
	<view class="container">
		<view class="header">
			<text class="title">新用户注册</text>
			<text class="subtitle">创建您的智慧衣橱账号</text>
		</view>

		<view class="form">
			<view class="input-item">
				<text class="label">用户名</text>
				<input v-model="form.account" placeholder="请输入用户名" class="my-input" />
			</view>
			<view class="input-item">
				<text class="label">设置密码</text>
				<input v-model="form.password" type="password" placeholder="请输入密码" class="my-input" />
			</view>
			<view class="input-item">
				<text class="label">确认密码</text>
				<input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" class="my-input" />
			</view>
			
			<button class="submit-btn" @click="handleRegister">注 册</button>
			
			<view class="footer" @click="goLogin">
				<text>已有账号？立即登录</text>
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
	// 1. 前端简单校验
	if (!form.account || !form.password) {
		return uni.showToast({ title: '请完整填写信息', icon: 'none' });
	}
	if (form.password !== form.confirmPassword) {
		return uni.showToast({ title: '两次密码不一致', icon: 'none' });
	}

	try {
		uni.showLoading({ title: '提交中...' });
		// 2. 调用封装好的 API
		await registerApi({
			account: form.account,
			password: form.password,
			confirmPassword: form.confirmPassword
		});
		
		uni.showToast({ title: '注册成功' });
		// 3. 注册成功后去登录
		setTimeout(() => {
			uni.navigateTo({ url: '/pages/login/login' });
		}, 1500);
	} catch (err) {
		// 错误已由 request.ts 拦截并弹窗，这里无需处理
	} finally {
		uni.hideLoading();
	}
};

const goLogin = () => {
	uni.navigateTo({ url: '/pages/login/login' });
};
</script>

<style lang="scss" scoped>
.container { padding: 60rpx; background: #fff; min-height: 100vh; }
.header { margin-bottom: 80rpx; .title { font-size: 48rpx; font-weight: bold; } .subtitle { font-size: 26rpx; color: #999; margin-top: 10rpx; display: block; } }
.input-item { margin-bottom: 40rpx; .label { font-size: 24rpx; color: #666; margin-bottom: 10rpx; display: block; } .my-input { background: #f8f8f8; height: 90rpx; border-radius: 12rpx; padding: 0 30rpx; } }
.submit-btn { background: #1989fa; color: #fff; height: 90rpx; line-height: 90rpx; border-radius: 45rpx; margin-top: 60rpx; font-size: 32rpx; }
.footer { text-align: center; margin-top: 40rpx; color: #1989fa; font-size: 26rpx; }
</style>