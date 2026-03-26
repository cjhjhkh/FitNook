<template>
    <view class="chat-container">
        <view class="status-bar-placeholder"></view> <!-- 顶部状态栏占位 -->
        
        <!-- 消息列表区 -->
        <scroll-view 
            scroll-y 
            class="chat-history" 
            :scroll-top="scrollTop" 
            scroll-with-animation
            :scroll-into-view="scrollIntoView"
        >
            <view class="msg-wrapper" v-for="(msg, index) in msgList" :key="index" :id="'msg-' + index">
                <!-- 1. 机器人消息 -->
                <view v-if="msg.role === 'assistant'" class="msg-row left fade-in">
                    <view class="msg-content">
                        <view class="bubble">
                            <text class="text-content">{{ msg.content }}</text>
                            
                            <!-- 推荐搭配卡片 -->
                            <view class="outfit-card" v-if="msg.type === 'outfit_card' && msg.meta">
                                <view class="card-header">
                                    <view class="card-icon">✨</view>
                                    <text class="card-title">{{ msg.meta.title || '今日穿搭灵感' }}</text>
                                </view>
                                <scroll-view scroll-x class="card-gallery" show-scrollbar="false">
                                    <view class="gallery-inner">
                                         <view class="outfit-item" v-for="(item, idx) in (msg.meta.items || [])" :key="idx">
                                            <image :src="item.image_url" mode="aspectFill" class="outfit-img"></image>
                                            <text class="outfit-name">{{ item.name }}</text>
                                        </view>
                                    </view>
                                </scroll-view>
                                <view class="card-footer">
                                    <view class="action-btn" hover-class="btn-hover">
                                        <text>保存到收藏夹</text>
                                        <van-icon name="arrow" color="#1989fa" size="12" />
                                    </view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>

                <!-- 2. 用户消息 -->
                <view v-else class="msg-row right fade-in">
                    <view class="msg-content">
                        <!-- 2.1 文本消息 -->
                        <view v-if="msg.type === 'text'" class="bubble user-bubble">
                            <text>{{ msg.content }}</text>
                        </view>
                        
                        <!-- 2.2 图片消息 -->
                        <view v-else-if="msg.type === 'image' && msg.meta" class="bubble image-bubble">
                            <image :src="msg.meta.image_url" mode="aspectFill" class="sent-image shadow-sm" @tap="previewImage(msg.meta.image_url)" />
                        </view>
                    </view>
                </view>
            </view>

            <!-- Loading 状态 -->
            <view v-if="loading" class="loading-wrapper">
                <view class="typing-indicator">
                    <view class="dot"></view>
                    <view class="dot"></view>
                    <view class="dot"></view>
                </view>
            </view>
            
            <!-- 底部占位，防止被输入框遮挡 -->
            <view class="bottom-spacer"></view>
        </scroll-view>

        <!-- 底部输入区 -->
        <view class="input-area safe-area-bottom">
            <view class="toolbar-btn" @tap="showClothesPicker = true" hover-class="icon-hover">
                <van-icon name="photo-o" size="26" color="#666" />
            </view>
            <view class="input-box-wrapper">
                <input 
                    class="main-input"
                    type="text" 
                    v-model="inputContent" 
                    confirm-type="send" 
                    placeholder="问点什么...如：明天约会穿什么？" 
                    placeholder-style="color: #999;"
                    @confirm="handleSendText"
                />
            </view>
            <view class="send-btn" @tap="handleSendText" :class="{ active: inputContent.trim() }" hover-class="send-hover">
                <van-icon name="guide-o" color="#fff" size="22" />
            </view>
        </view>

        <!-- 单品选择器 -->
        <clothes-picker 
            :show="showClothesPicker" 
            @close="showClothesPicker = false"
            @confirm="handleSendItem"
        />
    </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { createSession } from '@/api/chat';
import { BASE_URL, getAuthHeader } from '@/utils/request';
import ClothesPicker from '@/component/clothes-picker.vue';

interface Message {
    role: 'user' | 'assistant';
    type: 'text' | 'image' | 'outfit_card';
    content: string;
    meta?: any;
}

const msgList = ref<Message[]>([]);
const inputContent = ref('');
const sessionId = ref<number | null>(null);
const scrollTop = ref(0);
const scrollIntoView = ref(''); // 用于锚点定位
const userInfo = ref<any>({});
const loading = ref(false);
const showClothesPicker = ref(false);

onLoad(async (options: any) => {
    const storedUser = uni.getStorageSync('userInfo');
    if (storedUser) {
        userInfo.value = storedUser;
        await initSession();

        if (options && options.query) {
            const queryText = decodeURIComponent(options.query);
            setTimeout(() => {
                doSend(queryText);
            }, 600);
        }
    } else {
        uni.showToast({ title: '请先登录', icon: 'none' });
        setTimeout(() => {
            uni.reLaunch({ url: '/pages/login/login' });
        }, 1500);
    }
});

const initSession = async () => {
    try {
        const res: any = await createSession(userInfo.value.id);
        if (res.code === 200) {
            sessionId.value = res.data.sessionId;
            msgList.value.push({
                role: 'assistant',
                type: 'text',
                content: `你好，${userInfo.value.nickname || '朋友'}👋\n我是你的 AI 搭配顾问。无论是面试、约会还是旅行，我都能帮你找到合适的穿搭方案。`
            });
        }
    } catch (e) {
        console.error(e);
    }
};

const handleSendText = async () => {
    const text = inputContent.value.trim();
    if (!text) return;
    inputContent.value = ''; // 立即清空，提升体验
    await doSend(text, 'text');
};

const handleSendItem = async (item: any) => {
    msgList.value.push({ 
        role: 'user', 
        type: 'image', 
        content: `[图片]`, 
        meta: { image_url: item.image_url } 
    });
    scrollToBottom();

    await doSend(`这件 ${item.name} 怎么搭？`, 'text', [item.id]);
};

// 统一发送逻辑
const doSend = async (content: string, type: 'text'|'image' = 'text', linkedEntities: number[] = []) => {
    if (!sessionId.value || loading.value) return;

    // 1. 推入用户消息
    if (type === 'text') {
        msgList.value.push({ role: 'user', type: 'text', content });
    }
    
    scrollToBottom();
    loading.value = true;

    // 2. 准备 AI 消息占位
    const aiMsgIndex = msgList.value.length;
    msgList.value.push({
        role: 'assistant',
        type: 'text',
        content: '' // 初始为空，流式追加
    });

    // 定义解码器 (放在请求外部，保持状态)
    let decoder: TextDecoder | null = null;
    // @ts-ignore
    if (typeof TextDecoder !== 'undefined') {
        // @ts-ignore
        decoder = new TextDecoder('utf-8');
    }

    try {
        const requestTask = uni.request({
            url: BASE_URL + '/chat/send',
            method: 'POST',
            header: getAuthHeader(),
            data: {
                sessionId: sessionId.value,
                userId: userInfo.value.id,
                content,
                msgType: type,
                linkedEntities,
                stream: true
            },
            enableChunked: true, // 开启流式接收
            responseType: 'text', // 部分平台需要 text
            success: (res) => {
                 // 请求完成后的处理（流式主要在 onChunkReceived 处理）
            },
            fail: (err) => {
                console.error('Stream Request Failed:', err);
                 msgList.value[aiMsgIndex].content = '网络有点小卡顿，请重试...';
            },
            complete: () => {
                loading.value = false;
                scrollToBottom();
            }
        });

        // 3. 处理流式数据
        // @ts-ignore
        requestTask.onChunkReceived((res) => {
            if (res.data) {
                let chunkText = '';
                
                // --- 稳健的 UTF-8 解码逻辑 ---
                if (decoder) {
                    // stream: true 保持解码器内部 buffer，防止中文字符被截断
                    // @ts-ignore
                    chunkText = decoder.decode(new Uint8Array(res.data), { stream: true });
                } else {
                    // 降级方案：简单转换 (仅英文安全)
                    const uint8 = new Uint8Array(res.data);
                    chunkText = String.fromCharCode.apply(null, uint8 as any);
                }
                
                // 处理 SSE 格式 (data: {...}\n\n)
                const lines = chunkText.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('data:')) {
                        const jsonStr = line.replace('data:', '').trim();
                        if (jsonStr === '[DONE]') break;
                        if (!jsonStr) continue;

                        try {
                            const data = JSON.parse(jsonStr);
                            
                            // 第一帧：Session ID
                            if (data.type === 'meta' && data.sessionId) {
                                sessionId.value = data.sessionId;
                            }
                            
                            // 增量帧：Delta Content
                            if (data.type === 'delta' && data.content) {
                                msgList.value[aiMsgIndex].content += data.content;
                                // 实时滚动
                                // 节流滚动，防止抖动过于剧烈 (可选)
                                scrollToBottom(); 
                            }
                            
                            // 错误帧
                            if (data.error) {
                                msgList.value[aiMsgIndex].content = data.error;
                            }

                        } catch (e) {
                            // 忽略 JSON 解析错误 (粘包可能导致 jsonStr 不完整，暂未实现复杂 buffer 拼接)
                            // 生产环境需做 buffer 缓存拼接
                        }
                    }
                }
            }
        });

    } catch (e) {
        msgList.value[aiMsgIndex].content = 'API 连接似乎断开了...';
        loading.value = false;
    }
};

const scrollToBottom = () => {
    nextTick(() => {
        // 使用锚点定位更准确
        scrollIntoView.value = `msg-${msgList.value.length - 1}`;
        // 也可以同时设置 scrollTop 兜底
        scrollTop.value += 5000;
    });
};

const previewImage = (url: string) => {
    uni.previewImage({ urls: [url] });
};
</script>

<style lang="scss">
page {
    background-color: #F7F8FA; /* 更清爽的背景 */
}

/* 动画定义 */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20rpx); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

.fade-in {
    animation: fadeInUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.chat-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #F7F8FA;
}

.status-bar-placeholder {
    height: var(--status-bar-height);
    background: transparent;
}

.chat-history {
    flex: 1;
    padding: 24rpx 32rpx;
    box-sizing: border-box;
    /* 隐藏滚动条 */
    ::-webkit-scrollbar {
        width: 0;
        height: 0;
        color: transparent;
    }
}

.msg-wrapper {
    margin-bottom: 48rpx;
    position: relative;
    padding-bottom: 10rpx; /* Prevent shadow clipping */
}

.msg-row {
    display: flex;
    align-items: flex-start;
    
    .msg-content {
        max-width: 80%; /* 增加消息内容宽度 */
        display: flex;
        flex-direction: column;
    }

    /* 左侧机器人 */
    &.left {
        .bubble {
            background: #ffffff;
            color: #2c3e50;
            border-radius: 4rpx 28rpx 28rpx 28rpx;
            padding: 28rpx 32rpx;
            font-size: 30rpx;
            line-height: 1.65;
            letter-spacing: 0.5rpx;
            box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
            position: relative;
            
            /* 气泡小三角微调 */
            &::before {
                content: '';
                position: absolute;
                top: 0;
                left: -12rpx;
                width: 20rpx;
                height: 20rpx;
                background: radial-gradient(circle at top right, transparent 70%, #fff 71%);
                z-index: 1;
                /* Note: Triangle logic adjusted for cleaner rounded look usually just border-radius tricks */
                display: none; /* Modern look prefers just radius */
            }
        }
    }

    /* 右侧用户 */
    &.right {
        flex-direction: row-reverse;
        .msg-content { align-items: flex-end; }
        
        .user-bubble {
            background: linear-gradient(135deg, #222536, #3C4257); /* 深色高级感 */
            color: #ffffff;
            border-radius: 28rpx 4rpx 28rpx 28rpx;
            padding: 28rpx 32rpx;
            font-size: 30rpx;
            line-height: 1.65;
            box-shadow: 0 8rpx 20rpx rgba(60, 66, 87, 0.25);
            font-weight: 300;
        }
        
        .image-bubble {
            padding: 0;
            background: transparent;
            
            .sent-image {
                width: 280rpx;
                height: 280rpx;
                border-radius: 24rpx;
                border: 4rpx solid #fff;
                box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.1);
            }
        }
    }
}

/* 推荐穿搭卡片优化 - 杂志风 */
.outfit-card {
    margin-top: 24rpx;
    background: #ffffff;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.03);
    border: 1rpx solid rgba(0,0,0,0.02);
    width: 100%;

    .card-header {
        padding: 24rpx 28rpx;
        display: flex;
        align-items: center;
        border-bottom: 1rpx solid #f5f5f5;
        background: #fcffff;
        
        .card-icon {
            font-size: 32rpx;
            margin-right: 12rpx;
        }
        .card-title {
            font-size: 26rpx;
            font-weight: 600;
            color: #333;
            letter-spacing: 1rpx;
        }
    }

    .card-gallery {
        padding: 28rpx 0;
        background: #fff;
        
        .gallery-inner {
            display: flex;
            padding: 0 28rpx;
        }
        
        .outfit-item {
            margin-right: 24rpx;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 160rpx;
            position: relative;

            .outfit-img {
                width: 160rpx;
                height: 200rpx; /* 长图更有海报感 */
                border-radius: 16rpx;
                background: #f8f8f8;
                margin-bottom: 16rpx;
                border: 1rpx solid #f0f0f0;
                box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
            }
            .outfit-name {
                font-size: 22rpx;
                color: #555;
                width: 100%;
                text-align: center;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                font-family: 'PingFang SC', sans-serif;
            }
        }
    }

    .card-footer {
        border-top: 1rpx solid #f8f8f8;
        
        .action-btn {
            padding: 20rpx;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 24rpx;
            color: #222536; /* 品牌黑 */
            font-weight: 500;
            transition: all 0.2s;
            
            text { margin-right: 8rpx; }
            
            &:active {
                background: #f5f5f5;
            }
        }
    }
}

/* 正在输入 Loading */
.loading-wrapper {
    padding-left: 120rpx; 
    margin-bottom: 40rpx;
    
    .typing-indicator {
        background: rgba(255,255,255,0.6);
        padding: 20rpx 30rpx;
        border-radius: 30rpx;
        display: inline-flex;
        align-items: center;
        width: fit-content;
        border: 1rpx solid rgba(0,0,0,0.05);
        
        .dot {
            width: 12rpx;
            height: 12rpx;
            background: #B0B3C7;
            border-radius: 50%;
            margin: 0 6rpx;
            animation: bounce 1.4s infinite ease-in-out both;
            
            &:nth-child(1) { animation-delay: -0.32s; }
            &:nth-child(2) { animation-delay: -0.16s; }
        }
    }
}
@keyframes bounce {
    0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
}

.bottom-spacer {
    height: 180rpx; /* 加高底部占位 */
    width: 100%;
}

/* 底部输入区 - 悬浮胶囊风 */
.input-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(255,255,255,0.85); /* 半透明磨砂 */
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    padding: 24rpx 32rpx;
    padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
    box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.03);
    display: flex;
    align-items: center;
    z-index: 100;
    
    .toolbar-btn {
        width: 80rpx;
        height: 80rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 20rpx;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
        color: #444;
        transition: transform 0.2s;
        
        &:active { transform: scale(0.92); }
    }

    .input-box-wrapper {
        flex: 1;
        background: #ffffff;
        border-radius: 40rpx;
        padding: 0 32rpx;
        height: 88rpx;
        display: flex;
        align-items: center;
        border: 2rpx solid #f0f0f0;
        transition: all 0.25s ease;
        box-shadow: inset 0 2rpx 6rpx rgba(0,0,0,0.02);
        
        &:focus-within {
            border-color: #222536; /* 聚焦变黑 */
            box-shadow: 0 4rpx 12rpx rgba(34, 37, 54, 0.1);
            background: #fff;
        }

        .main-input {
            width: 100%;
            height: 100%;
            font-size: 30rpx;
            color: #333;
            caret-color: #222536;
        }
    }

    .send-btn {
        width: 88rpx;
        height: 88rpx;
        border-radius: 50%;
        background: #E0E2E5;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 24rpx;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform: scale(0.9);
        
        &.active {
            background: #222536; /* 激活态深黑 */
            box-shadow: 0 6rpx 16rpx rgba(34, 37, 54, 0.3);
            transform: scale(1);
        }
        
        &:active { transform: scale(0.95); opacity: 0.9; }
    }
}
</style>
