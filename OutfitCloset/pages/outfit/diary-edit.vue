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

            <!-- 行程选择 -->
            <view class="form-item">
                <view class="label">行程</view>
                <view class="value-display" @tap="showSuitcasePicker = true">
                    <text>{{ currentSuitcaseName }}</text>
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

			<!-- 关联行程 -->
			<view class="form-item" @tap="showSuitcasePicker = true">
				<text class="label">关联行程</text>
				<view class="value-placeholder">
					<text v-if="selectedSuitcaseName" class="value">{{ selectedSuitcaseName }}</text>
					<text v-else class="placeholder">选择关联的旅行（可选）</text>
					<van-icon name="arrow" color="#999" />
				</view>
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

		<!-- 底部操作栏 -->
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

        <!-- 行程选择弹窗 -->
        <van-action-sheet
            v-model:show="showSuitcasePicker"
            :actions="suitcaseList"
            @select="onSelectSuitcase"
            cancel-text="清除关联"
            @cancel="clearSuitcase"
        />
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { createDiary, getDiaryDetail, updateDiary, deleteDiary } from '@/api/diary';
import { getSuitcaseRanges } from '@/api/suitcase';
import { BASE_URL } from '@/utils/request';

// --- 状态 ---
const diaryId = ref<string | null>(null);
const showCalendar = ref(false);
const showSuitcasePicker = ref(false); // 控制行程选择弹窗
const suitcaseList = ref<any[]>([]); // 可选行程列表
const form = ref({
    date: new Date().toISOString().split('T')[0],
    content: '',
    images: [] as string[],
    suitcase_id: null as number | null // 新增
});
const fileList = ref<any[]>([]); //用于 uploader 显示

// --- 计算属性 ---
const defaultCalendarDate = computed(() => {
    return new Date(form.value.date).getTime();
});

const currentSuitcaseName = computed(() => {
    if (!form.value.suitcase_id) return '无';
    const found = suitcaseList.value.find(s => s.id === form.value.suitcase_id);
    return found ? found.name : '未知行程';
});

const selectedSuitcaseName = computed(() => currentSuitcaseName.value === '无' ? '' : currentSuitcaseName.value);

// --- 生命周期 ---
onLoad(async (options: any) => {
    // 1. 获取行程列表供选择
    loadSuitcases();

    // 2. 如果是编辑模式
    if (options.id) {
        diaryId.value = options.id;
        loadDiaryDetail(options.id);
    } else if (options.date) {
        // 从日历点进来的新建
        form.value.date = options.date;
    }
});

// --- 方法 ---

// 加载行程列表
const loadSuitcases = async () => {
    try {
        const account = uni.getStorageSync('account');
        if(!account) return;
        // 复用 ranges 接口获取所有行程
        const res: any = await getSuitcaseRanges({ account });
        if (res.code === 200) {
            suitcaseList.value = res.data.map((item: any) => ({
                id: item.id,
                name: item.name,
                subname: `${item.start_date} ~ ${item.end_date}` // 显示时间段 (picker显示用)
            }));
        }
    } catch (error) {
        console.error('加载行程失败', error);
    }
};

// 加载日记详情
const loadDiaryDetail = async (id: string) => {
    try {
        const res: any = await getDiaryDetail(id);
        if (res.code === 200) {
            const data = res.data;
            form.value = {
                date: data.log_date,
                content: data.content,
                images: data.images || [],
                suitcase_id: data.suitcase_id || null
            };
            
            // 回显图片
            fileList.value = (data.images || []).map((url: string) => ({
                url: url,
                name: 'image'
            }));
        }
    } catch (error) {
        uni.showToast({ title: '加载失败', icon: 'none' });
    }
};

// 图片上传
// event: { file: { url: string, ... }, ... }
const afterRead = async (event: any) => {
    // Vant Weapp 的 file 对象结构可能嵌套在 detail.file 中
    const file = event.detail.file;
    if (!file || !file.url) {
        console.error('未获取到文件对象', event);
        return;
    }
    
    // 立即展示 Loading
    uni.showLoading({ title: '上传中...' });
    
    uni.uploadFile({
        url: BASE_URL + '/upload', 
        filePath: file.url,
        name: 'file',
        formData: {
            type: 'diary'
        },
        header: {
            'Authorization': 'Bearer ' + (uni.getStorageSync('token') || '')
        },
        success: (uploadFileRes) => {
            try {
                const res = JSON.parse(uploadFileRes.data);
                if (res.code === 200) {
                    const imageUrl = res.url;
                    // 更新表单数据
                    form.value.images.push(imageUrl);
                    // 同步更新 fileList 用于显示
                    // 注意：Vant 的 uploader 会自动预览本地图片，我们需要确保 fileList 最终用的是服务器 URL
                    // 或者为了简单，我们追加到 fileList 即可，Vant 会管理它自己的预览
                    fileList.value.push({ url: imageUrl, name: 'image', isImage: true });
                } else {
                    uni.showToast({ title: '上传失败: ' + res.msg, icon: 'none' });
                }
            } catch (e) {
                console.error(e);
                uni.showToast({ title: '上传异常', icon: 'none' });
            }
        },
        fail: (err) => {
            console.error(err);
             uni.showToast({ title: '网络错误', icon: 'none' });
        },
        complete: () => {
            uni.hideLoading();
        }
    });
};

const deleteImg = (event: any) => {
    const { index } = event.detail;
    // 移除显示列表
    fileList.value.splice(index, 1);
    // 移除表单数据 - 假设 fileList 和 form.images 是一一对应的
    if (form.value.images[index]) {
        form.value.images.splice(index, 1);
    }
};

// 保存提交
const submit = async () => {
    if (!form.value.content && form.value.images.length === 0) {
        uni.showToast({ title: '写点什么吧~', icon: 'none' });
        return;
    }

    try {
        uni.showLoading({ title: '保存中...' });
        const userInfo = uni.getStorageSync('userInfo');
        
        const payload = {
            ...form.value,
            user_id: userInfo ? userInfo.id : undefined,
            account: userInfo ? userInfo.account : undefined
        };

        let res: any;
        if (diaryId.value) {
            // 编辑模式：调用更新
            res = await updateDiary({ id: diaryId.value, ...payload });
        } else {
            // 新建模式
            res = await createDiary(payload);
        }

        if (res.code === 200) {
            uni.showToast({ title: '保存成功', icon: 'success' });
            setTimeout(() => {
                uni.navigateBack();
            }, 1000);
        } else {
            uni.showToast({ title: res.msg || '保存失败', icon: 'none' });
        }
    } catch (e) {
        uni.showToast({ title: '网络请求失败', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};

const handleDelete = () => {
    if (!diaryId.value) return;
    uni.showModal({
        title: '提示',
        content: '确定要删除这篇日记吗？',
        success: async (res) => {
            if (res.confirm) {
                try {
                    const apiRes: any = await deleteDiary(diaryId.value);
                    if (apiRes.code === 200) {
                        uni.showToast({ title: '已删除', icon: 'none' });
                        setTimeout(() => {
                            uni.navigateBack();
                        }, 1000);
                    }
                } catch (e) {
                     uni.showToast({ title: '删除失败', icon: 'none' });
                }
            }
        }
    });
};

// 日历确认
const onConfirmDate = (event: any) => {
    // Vant Calendar confirm event detail is Date object (single date)
    const date = event.detail; 
    const d = new Date(date);
    // 简单的格式化 YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    form.value.date = `${y}-${m}-${day}`;
    showCalendar.value = false;
};

// 选定行程
const onSelectSuitcase = (event: any) => {
    // Vant ActionSheet select event detail is the action object
    const item = event.detail;
    form.value.suitcase_id = item.id;
    showSuitcasePicker.value = false;
};

const clearSuitcase = () => {
    form.value.suitcase_id = null;
    showSuitcasePicker.value = false;
};

// 输入同步
const onContentInput = (e: any) => {
    // Uniapp textarea input event: e.detail.value is the string
    form.value.content = e.detail.value;
};

const goBack = () => uni.navigateBack();
</script>

<style lang="scss" scoped>
.diary-edit-page {
    min-height: 100vh;
    background-color: #f7f8fa;
    padding-bottom: 100px;
}

.form-container {
    padding: 12px;
}

.form-item {
    background: #fff;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .label {
        font-size: 16px;
        color: #333;
        font-weight: 500;
    }
    
    .value-display {
        display: flex;
        align-items: center;
        color: #666;
        font-size: 14px;
        
        text {
            margin-right: 4px;
        }
    }

    .value-placeholder {
        display: flex;
        align-items: center;
        
        .value {
            color: #1989fa;
            font-size: 14px;
            margin-right: 4px;
        }
        
        .val-none {
             color: #999;
             font-size: 14px;
             margin-right: 4px;
        }
    }
}

.content-wrapper {
    background: #fff;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 12px;
    position: relative;
    
    // 修复 textarea 样式
    :deep(.van-field__control) {
        min-height: 150px !important;
        font-size: 16px;
        line-height: 1.6;
    }
}

.upload-section {
    background: #fff;
    padding: 16px;
    border-radius: 8px;
    
    .section-header {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 12px;
    }
}

.bottom-action {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    padding: 12px 16px;
    padding-bottom: calc(12px + constant(safe-area-inset-bottom));
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    display: flex;
    gap: 12px;
}
</style>
