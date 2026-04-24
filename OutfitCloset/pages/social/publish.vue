<template>
	<view class="publish-page">
			<view class="content">
			<!-- 搭配选择区 -->
			<view class="section outfit-section" @tap="selectOutfit">
				<view v-if="selectedOutfit" class="outfit-preview">
					<!-- 优先显示合成大图，没有则显示第一张单品图作为示意，或者显示占位 -->
					<image 
						:src="selectedOutfit.image_url || (selectedOutfit.items && selectedOutfit.items[0] ? selectedOutfit.items[0].image_url : '')" 
						mode="aspectFit" 
						class="outfit-img"
					/>
					<view class="outfit-info">
						<text class="name">{{ selectedOutfit.name }}</text>
						<view class="change-tip">点击更换</view>
					</view>
				</view>
				<view v-else class="add-placeholder">
					<view class="icon-box">
						<van-icon name="plus" size="24px" color="#ccc" />
					</view>
					<text class="tip-text">选择一套搭配方案</text>
				</view>
			</view>

			<!-- 文本输入区 -->
			<view class="section input-section">
				<textarea 
					v-model="content" 
					placeholder="这一刻的想法... 分享你的穿搭心得（选填）" 
					class="input-area"
					maxlength="500"
					placeholder-style="color:#ccc"
				></textarea>
				<view class="word-count">{{ content.length }}/500</view>
			</view>

			<!-- 额外选项 (保留扩展性) -->
			<!-- <view class="section option-section">
				<van-cell title="所在位置" is-link icon="location-o" />
				<van-cell title="谁可以看" is-link icon="eye-o" value="公开" />
			</view> -->
		</view>

		<!-- 发布按钮 -->
		<view class="footer-btn safe-area-inset-bottom">
			<van-button 
				type="primary" 
				block 
				round 
				color="linear-gradient(to right, #A4C2F4, #8eb4f3)"
				:disabled="!isValid"
				@click="handlePublish"
				:loading="submitting"
			>
				发布
			</van-button>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { publishPostApi } from '@/api/social';

const content = ref('');
const selectedOutfit = ref<any>(null);
const submitting = ref(false);
const currentUser = uni.getStorageSync('userInfo') || {};

// 校验：必须选择搭配
const isValid = computed(() => {
	return !!selectedOutfit.value;
});

onLoad(() => {
	// 监听搭配选择页面返回的数据
	uni.$on('outfitSelected', (item: any) => {
		selectedOutfit.value = item;
	});
});

onUnload(() => {
	uni.$off('outfitSelected');
});

const selectOutfit = () => {
	// 跳转到搭配列表页，开启单选模式
	// 修复：不能 navigateTo 到 tabBar 页面 (outfit/index)，改为跳转到普通列表页 (outfit/list)
	uni.navigateTo({
		url: '/pages/outfit/list?mode=select_one'
	});
};

const handlePublish = async () => {
	if (!isValid.value || submitting.value) return;

	submitting.value = true;
	try {
        // 构造发布数据
        let finalImageUrl = selectedOutfit.value.image_url;
        
        if (!finalImageUrl && selectedOutfit.value.items && selectedOutfit.value.items.length > 0) {
            const urls = selectedOutfit.value.items.map((item) => item.image_url).filter(Boolean);
            finalImageUrl = JSON.stringify(urls);
        } else if (finalImageUrl) {
            try {
                const parsed = JSON.parse(finalImageUrl);
                if (!Array.isArray(parsed)) throw new Error();
            } catch {
                finalImageUrl = JSON.stringify([finalImageUrl]);
            }
        }

        const postData = {
            user_id: currentUser.id,
            outfit_id: selectedOutfit.value.id,
            content: content.value,
            image_urls: finalImageUrl ? JSON.parse(finalImageUrl) : [],
            image_url: finalImageUrl || '[]'
        };

		const res: any = await publishPostApi(postData);

		if (res.code === 200) {
			uni.showToast({ title: '发布成功', icon: 'success' });
            
            // 触发全局事件通知列表刷新
            uni.$emit('refreshSocialFeed');
            
			setTimeout(() => {
				uni.navigateBack();
			}, 1500);
		} else {
			uni.showToast({ title: res.msg || '发布失败', icon: 'none' });
		}
	} catch (e) {
		console.error(e);
		uni.showToast({ title: '网络异常', icon: 'none' });
	} finally {
		submitting.value = false;
	}
};
</script>

<style lang="scss" scoped>
.publish-page {
	min-height: 100vh;
	background: #f7f8fa;
	display: flex;
	flex-direction: column;
}

.content {
	flex: 1;
	padding: 24rpx;
}

.section {
	background: #fff;
	border-radius: 20rpx;
	margin-bottom: 24rpx;
	overflow: hidden;
}

.outfit-section {
	min-height: 300rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx dashed #eee;
    position: relative;
    
    &:active {
        background: #fafafa;
    }

	.add-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: #999;
		
		.icon-box {
			width: 80rpx;
			height: 80rpx;
			background: #f0f0f0;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			margin-bottom: 16rpx;
		}
		
		.tip-text {
			font-size: 28rpx;
		}
	}

	.outfit-preview {
		width: 100%;
        height: 100%;
        min-height: 400rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
        justify-content: center;
        padding: 40rpx;
        box-sizing: border-box;

		.outfit-img {
			width: 80%;
			height: 400rpx;
            margin-bottom: 20rpx;
            border-radius: 12rpx;
            background-color: #f9f9f9;
		}

		.outfit-info {
			text-align: center;
			
			.name {
				font-size: 32rpx;
				font-weight: 600;
				color: #333;
				margin-bottom: 8rpx;
				display: block;
			}
			
			.change-tip {
				font-size: 24rpx;
				color: #1989fa;
			}
		}
	}
}

.input-section {
	padding: 24rpx;
	position: relative;

	.input-area {
		width: 100%;
		height: 240rpx;
		font-size: 30rpx;
		line-height: 1.5;
		color: #333;
	}

	.word-count {
		text-align: right;
		font-size: 24rpx;
		color: #ccc;
		margin-top: 10rpx;
	}
}

.footer-btn {
	padding: 24rpx 40rpx;
	background: #fff;
    box-shadow: 0 -4rpx 12rpx rgba(0,0,0,0.05);
}
</style>