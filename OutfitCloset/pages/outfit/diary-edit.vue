<template>
	<view class="diary-edit-page">
        <!-- 导航 -->
        <van-nav-bar
            :title="diaryId ? '编辑日记' : '写日记'"
            left-arrow
            @click-left="goBack"
        />

		<view class="form-container">
            <!-- 日期选择 -->
            <view class="form-item">
                <view class="label">日期</view>
                <view class="value-display" @tap="showCalendar = true">
                    <text>{{ form.date }}</text>
                    <van-icon name="arrow" color="#999" />
                </view>
            </view>

            <!-- 文本内容 -->
			<view class="content-wrapper">
				<textarea 
					class="content-input" 
					placeholder="记录今天的穿搭心得、天气心情..." 
					:value="form.content"
                    @input="onContentInput"
					maxlength="1000"
                    auto-height
				/>
                <view class="word-limit">{{ form.content.length }}/1000</view>
			</view>

            <!-- 图片上传 -->
            <view class="upload-section">
                <view class="section-header">照片</view>
                <van-uploader 
                    :file-list="fileList" 
                    :max-count="9"
                    @after-read="afterRead" 
                    @delete="deleteImg"
                    upload-text="添加照片"
                />
            </view>
		</view>

		<!-- 底部按钮 -->
		<view class="bottom-action">
            <view style="flex: 1;">
			    <van-button block type="primary" color="#1989fa" @click="submit">保存</van-button>
            </view>
            <view v-if="diaryId" style="flex: 1;">
                 <van-button block type="danger" plain @click="handleDelete">删除</van-button>
            </view>
		</view>

        <!-- 日历弹窗 -->
        <van-calendar
            :show="showCalendar"
            :default-date="defaultCalendarDate"
            @close="showCalendar = false"
            @confirm="onConfirmDate"
            color="#1989fa"
        />
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { createDiary, getDiaryDetail, updateDiary, deleteDiary } from '@/api/diary';
import { BASE_URL } from '@/utils/request';

// --- 状态 ---
const diaryId = ref<string | null>(null);
const showCalendar = ref(false);
const form = ref({
    date: new Date().toISOString().split('T')[0],
    content: '',
    images: [] as string[]
});
const fileList = ref<any[]>([]); //用于 uploader 显示

// --- 计算属性 ---
const defaultCalendarDate = computed(() => {
    return new Date(form.value.date).getTime();
});

// --- 生命周期 ---
onLoad((options: any) => {
    if (options.date) {
        form.value.date = options.date;
    }
    if (options.id) {
        diaryId.value = options.id;
        loadDetail(options.id);
    }
});

// --- 方法 ---
const goBack = () => uni.navigateBack();

const onContentInput = (e: any) => {
    form.value.content = e.detail.value;
};

const onConfirmDate = (e: any) => {
    const date = e.detail;
    // vant calendar 返回的是 Date 对象
    form.value.date = formatDate(date);
    showCalendar.value = false;
};

const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// 加载详情
const loadDetail = async (id: string) => {
    try {
        const res = await getDiaryDetail(id);
        if (res.code === 200) {
            const data = res.data;
            form.value.date = data.log_date;
            form.value.content = data.content;
            
            // 处理图片回显
            if (data.image_list && Array.isArray(data.image_list)) {
                form.value.images = data.image_list;
                fileList.value = data.image_list.map((url: string) => ({
                    url: url,
                    isImage: true,
                    deletable: true
                }));
            }
        }
    } catch (e) {
        console.error(e);
        uni.showToast({ title: '加载详情失败', icon: 'none' });
    }
};

// 图片上传处理
const afterRead = async (event: any) => {
    const { file } = event.detail;
    // 微信小程序中 file 可能是一个对象或数组
    const fileToUpload = Array.isArray(file) ? file[0] : file;
    
    try {
        uni.showLoading({ title: '上传中...' });
        
        // 调用上传 API (复用 request.ts 中的 BASE_URL 或单独的 upload 方法)
        const uploadTask = await new Promise((resolve, reject) => {
             uni.uploadFile({
                url: `${BASE_URL}/upload`, 
                filePath: fileToUpload.url,
                name: 'file',
                header: {
                    'Authorization': uni.getStorageSync('token') ? `Bearer ${uni.getStorageSync('token')}` : ''
                },
                success: (res) => {
                    resolve(res);
                },
                fail: (err) => {
                    reject(err);
                }
            });
        }) as any;

        uni.hideLoading();

        if (uploadTask.statusCode === 200) {
            // 解析后端返回的结果
            // 假设后端返回结构 { code: 200, data: { url: '...' } } 或直接返回 url
            let data;
            try {
                data = JSON.parse(uploadTask.data);
            } catch (e) {
                data = uploadTask.data;
            }
            
            const imageUrl = data.data ? data.data.url : (data.url || data); // 根据实际后端调整
            
            // 更新 form 和 fileList
            form.value.images.push(imageUrl);
            fileList.value.push({
                url: imageUrl,
                isImage: true,
                deletable: true
            });
        } else {
            uni.showToast({ title: '上传失败', icon: 'none' });
        }
    } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: '上传出错', icon: 'none' });
        console.error(e);
    }
};

// 删除已上传图片
const deleteImg = (event: any) => {
    const { index } = event.detail;
    fileList.value.splice(index, 1);
    form.value.images.splice(index, 1);
};

// 提交保存
const submit = async () => {
    if (!form.value.content && form.value.images.length === 0) {
        return uni.showToast({ title: '虽然是日记，但也写点什么吧~', icon: 'none' });
    }

    try {
        uni.showLoading({ title: '保存中...' });
        const userInfo = uni.getStorageSync('userInfo') || {};
        
        const payload = {
            user_id: userInfo.id, // 如果后端从token取可省略
            date: form.value.date,
            content: form.value.content,
            images: form.value.images
        };

        let res;
        if (diaryId.value) {
            res = await updateDiary(diaryId.value, payload);
        } else {
            res = await createDiary(payload);
        }

        uni.hideLoading();

        if (res.code === 200) {
            uni.showToast({ title: '保存成功', icon: 'success' });
            setTimeout(() => {
                uni.navigateBack();
            }, 800);
        } else {
            uni.showToast({ title: res.msg || '保存失败', icon: 'none' });
        }
    } catch (e) {
        uni.hideLoading();
        console.error(e);
        uni.showToast({ title: '网络错误', icon: 'none' });
    }
};

// 删除日记
const handleDelete = () => {
    uni.showModal({
        title: '提示',
        content: '确定要删除这篇日记吗？',
        confirmColor: '#ee0a24',
        success: async (res) => {
            if (res.confirm) {
                try {
                    await deleteDiary(diaryId.value!);
                    uni.showToast({ title: '已删除', icon: 'success' });
                    setTimeout(() => {
                        uni.navigateBack();
                    }, 800);
                } catch (e) {
                    uni.showToast({ title: '删除失败', icon: 'none' });
                }
            }
        }
    });
};
</script>

<style lang="scss" scoped>
.diary-edit-page {
	min-height: 100vh;
	background-color: #f7f8fa;
	display: flex;
	flex-direction: column;
}

.form-container {
	flex: 1;
	padding: 24rpx;
}

.form-item {
    background: #fff;
    padding: 30rpx;
    border-radius: 16rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24rpx;
    
    .label {
        font-size: 30rpx;
        color: #333;
        font-weight: 500;
    }
    
    .value-display {
        display: flex;
        align-items: center;
        font-size: 30rpx;
        color: #666;
        
        text {
            margin-right: 10rpx;
        }
    }
}

.content-wrapper {
	background: #fff;
	border-radius: 16rpx;
	padding: 30rpx;
	margin-bottom: 24rpx;
    min-height: 300rpx;
    position: relative;
	
	.content-input {
		width: 100%;
		min-height: 200rpx;
		font-size: 30rpx;
		line-height: 1.6;
		color: #333;
	}

    .word-limit {
        text-align: right;
        font-size: 24rpx;
        color: #999;
        margin-top: 20rpx;
    }
}

.upload-section {
    background: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    
    .section-header {
        font-size: 30rpx;
        font-weight: 500;
        margin-bottom: 24rpx;
        color: #333;
    }
}

.bottom-action {
	background: #fff;
	padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
    display: flex;
    gap: 20rpx;
	box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.03);
}
</style>
