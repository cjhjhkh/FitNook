<template>
    <view class="container">
        <text>我的衣橱</text>

        <guide-card :visible="showGuide" @close="showGuide = false" @submit="onGuideSubmit" />
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import GuideCard from '@/component/guide-card/guide-card.vue'; // 确保路径正确
import { request } from '@/utils/request'; // 假设你的请求工具路径在此

const showGuide = ref(false);

onLoad((options) => {
    // 逻辑：如果是新用户，显示引导卡片
    if (options.isNewUser === 'true') {
        showGuide.value = true;
    }
});

// 处理引导卡片提交的数据
const onGuideSubmit = async (formData: any) => {
    uni.showLoading({ title: '正在同步资料...' });
    try {
        // 调用后端刚才写的 PUT 接口
        const res: any = await request({
            url: '/user/profile',
            method: 'PUT',
            data: formData
        });

        if (res.code === 200) {
            uni.showToast({ title: '开启个性化穿搭', icon: 'success' });
            showGuide.value = false;

            // 重要：更新本地存储，标记资料已完善
            const userInfo = uni.getStorageSync('userInfo');
            userInfo.is_profile_completed = 1;
            uni.setStorageSync('userInfo', userInfo);
        }
    } catch (err) {
        console.error('同步失败', err);
        uni.showToast({ title: '同步失败，请重试', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};


</script>