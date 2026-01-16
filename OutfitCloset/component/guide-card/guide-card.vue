<template>
	<view class="guide-overlay" v-if="visible" @touchmove.stop.prevent>
		<view class="guide-card">
			<view class="step-indicator">
				<view class="dot" :class="{ active: currentStep >= 0 }"></view>
				<view class="line" :class="{ active: currentStep >= 1 }"></view>
				<view class="dot" :class="{ active: currentStep >= 1 }"></view>
				<view class="line" :class="{ active: currentStep >= 2 }"></view>
				<view class="dot" :class="{ active: currentStep >= 2 }"></view>
			</view>

			<view class="card-header">
				<text class="title">{{ steps[currentStep].title }}</text>
				<text class="skip-btn" @click="handleSkip">跳过</text>
			</view>

			<scroll-view scroll-y class="step-body">
				<view v-if="currentStep === 0" class="step-content animate-fade">
					<view class="avatar-wrapper" @click="chooseAvatar">
						<image :src="form.avatar || '/static/images/default-avatar.png'" mode="aspectFill"
							class="avatar-img" />
						<view class="upload-icon"><van-icon name="photograph" size="14" color="#fff" /></view>
					</view>
					<view class="input-item">
						<text class="input-label">你的昵称</text>
						<input v-model="form.nickname" placeholder="想叫什么好呢?" class="my-input" />
					</view>
					<view class="input-item">
						<text class="input-label">性别</text>
						<view class="gender-group">
							<view v-for="g in ['男', '女', '保密']" :key="g"
								:class="['gender-btn', form.gender === g ? 'active' : '']" @click="form.gender = g">
								{{ g }}</view>
						</view>
					</view>
				</view>

				<view v-if="currentStep === 1" class="step-content animate-fade">
					<view class="body-data-row">
						<view class="data-item">
							<text class="input-label">身高 (cm)</text>
							<input type="number" v-model="form.height" placeholder="170" class="my-input" />
						</view>
						<view class="data-item">
							<text class="input-label">体重 (kg)</text>
							<input type="number" v-model="form.weight" placeholder="60" class="my-input" />
						</view>
					</view>
					<text class="input-label">选择你的体型</text>
					<view class="shape-grid">
						<view v-for="s in ['梨型', '沙漏型', '倒三角', '矩形', '苹果型']" :key="s"
							:class="['shape-tag', form.shape === s ? 'active' : '']" @click="form.shape = s">{{ s }}
						</view>
					</view>
				</view>

				<view v-if="currentStep === 2" class="step-content animate-fade">
					<text class="input-label">你喜欢的穿搭风格 (多选)</text>
					<view class="style-grid">
						<view v-for="t in ['简约', '复古', '美式', '通勤', '甜美', '极简', '多巴胺']" :key="t"
							:class="['style-tag', (form.styles && form.styles.includes(t)) ? 'active' : '']"
							@click="toggleStyle(t)">
							{{ t }}
						</view>
					</view>
				</view>
			</scroll-view>

			<view class="card-footer">
				<button v-if="currentStep > 0" class="footer-btn prev-btn" @click="currentStep--">上一步</button>
				<button class="footer-btn next-btn" @click="handleNext">
					{{ currentStep === 2 ? '开启我的衣橱' : '下一步' }}
				</button>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const props = defineProps({
	visible: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'submit']);

const currentStep = ref(0);
const steps = [
	{ title: '完善个人资料' },
	{ title: '身材建模数据' },
	{ title: '你的时尚偏好' }
];

const form = reactive({
	avatar: '',
	nickname: '',
	gender: '保密',
	height: '',
	weight: '',
	shape: '',
	styles: [] as string[]
});

const toggleStyle = (style: string) => {
	if (!form.styles) form.styles = [];
	const idx = form.styles.indexOf(style);
	idx > -1 ? form.styles.splice(idx, 1) : form.styles.push(style);
};

const handleNext = () => {
	if (currentStep.value < 2) {
		currentStep.value++;
	} else {
		// 从本地缓存拿登录时存的信息
		const userInfo = uni.getStorageSync('userInfo');

		// 关键：字段名必须和后端接口对应的 mysql 表名对齐
		const submitData = {
			account: userInfo.account,          // 用于定位用户
			nickname: form.nickname,
			gender: form.gender,
			height: form.height,
			weight: form.weight,
			body_shape: form.shape,            // 后端字段名
			style_preference: (form.styles || []).join(',') // 后端字段名
		};

		emit('submit', submitData);
	}
};

const handleSkip = () => {
	emit('close');
};

const chooseAvatar = () => {
	uni.chooseImage({
		count: 1,
		success: (res) => {
			form.avatar = res.tempFilePaths[0];
		}
	});
};
</script>

<style lang="scss" scoped>
/* 样式保持原样即可... */
.guide-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10000;
}

.guide-card {
	width: 85%;
	background: #ffffff;
	border-radius: 40rpx;
	padding: 40rpx;
	position: relative;
	box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
}

.step-indicator {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 40rpx;

	.dot {
		width: 16rpx;
		height: 16rpx;
		border-radius: 50%;
		background: #eee;
		transition: 0.3s;
	}

	.line {
		width: 60rpx;
		height: 4rpx;
		background: #eee;
		transition: 0.3s;
	}

	.dot.active,
	.line.active {
		background: #1989fa;
		box-shadow: 0 0 10rpx rgba(25, 137, 250, 0.4);
	}
}

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 40rpx;

	.title {
		font-size: 38rpx;
		font-weight: bold;
		color: #333;
	}

	.skip-btn {
		font-size: 26rpx;
		color: #999;
		padding: 10rpx;
	}
}

.step-body {
	max-height: 600rpx;
}

.avatar-wrapper {
	width: 160rpx;
	height: 160rpx;
	margin: 0 auto 40rpx;
	position: relative;

	.avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: #f7f8fa;
		border: 4rpx solid #fff;
	}

	.upload-icon {
		position: absolute;
		right: 0;
		bottom: 0;
		background: #1989fa;
		color: #fff;
		width: 44rpx;
		height: 44rpx;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
}

.input-label {
	font-size: 24rpx;
	color: #666;
	margin-bottom: 12rpx;
	display: block;
}

.my-input {
	background: #f7f8fa;
	height: 80rpx;
	border-radius: 16rpx;
	padding: 0 20rpx;
	font-size: 28rpx;
	margin-bottom: 30rpx;
}

.gender-group {
	display: flex;
	gap: 20rpx;

	.gender-btn {
		flex: 1;
		height: 70rpx;
		line-height: 70rpx;
		text-align: center;
		background: #f7f8fa;
		border-radius: 12rpx;
		font-size: 26rpx;

		&.active {
			background: #eef6ff;
			color: #1989fa;
			border: 1rpx solid #1989fa;
		}
	}
}

.body-data-row {
	display: flex;
	gap: 30rpx;

	.data-item {
		flex: 1;
	}
}

.shape-grid,
.style-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	margin-top: 10rpx;

	.shape-tag,
	.style-tag {
		padding: 14rpx 28rpx;
		background: #f7f8fa;
		border-radius: 30rpx;
		font-size: 24rpx;
		transition: 0.2s;

		&.active {
			background: #1989fa;
			color: #fff;
			transform: translateY(-2rpx);
		}
	}
}

.card-footer {
	margin-top: 50rpx;
	display: flex;
	gap: 20rpx;

	.footer-btn {
		flex: 1;
		height: 88rpx;
		line-height: 88rpx;
		border-radius: 44rpx;
		font-size: 30rpx;
		border: none;
	}

	.prev-btn {
		background: #f5f5f5;
		color: #666;
	}

	.next-btn {
		background: #1989fa;
		color: #fff;
		font-weight: bold;
	}
}

.animate-fade {
	animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(10rpx);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>