<template>
    <view class="chat-container">
        <!-- 消息列表区 -->
        <scroll-view 
            scroll-y 
            class="chat-history" 
            :scroll-top="scrollTop" 
            scroll-with-animation
        >
            <view class="msg-wrapper" v-for="(msg, index) in msgList" :key="index">
                <!-- 1. 机器人消息 -->
                <view v-if="msg.role === 'assistant'" class="msg-item left">
                    <image src="/static/logo.png" class="avatar"></image>
                    <view class="bubble">
                        <text class="text-content">{{ msg.content }}</text>
                        
                        <!-- 如果是卡片类型，显示推荐搭配 -->
                        <view class="outfit-card" v-if="msg.type === 'outfit_card' && msg.meta">
                            <view class="card-title">{{ msg.meta.title || '推荐搭配' }}</view>
                            <scroll-view scroll-x class="card-items-scroll">
                                <view class="card-items">
                                     <view class="mini-item" v-for="(item, idx) in (msg.meta.items || [])" :key="idx">
                                        <image :src="item.image_url" mode="aspectFill" class="mini-img"></image>
                                        <text class="mini-name">{{ item.name }}</text>
                                    </view>
                                </view>
                            </scroll-view>
                            <view class="card-actions">
                                <van-button round size="small" type="primary" block>保存灵感</van-button>
                            </view>
                        </view>
                    </view>
                </view>

                <!-- 2. 用户消息 -->
                <view v-else class="msg-item right">
                    <!-- 2.1 文本消息 -->
                    <view v-if="msg.type === 'text'" class="bubble user-bubble">
                        <text>{{ msg.content }}</text>
                    </view>
                    
                    <!-- 2.2 单品图片消息 -->
                    <view v-else-if="msg.type === 'image' && msg.meta" class="bubble image-bubble">
                        <image :src="msg.meta.image_url" mode="aspectFill" class="sent-image" @tap="previewImage(msg.meta.image_url)" />
                    </view>

                    <image :src="userInfo.avatar_url || '/static/date_select.png'" class="avatar"></image>
                </view>
            </view>
            <!-- 占位，防止底部被输入框遮挡 -->
            <view style="height: 120rpx;"></view>
        </scroll-view>

        <!-- 底部输入区 -->
        <view class="input-area">
            <view class="toolbar" @tap="showClothesPicker = true">
                <van-icon name="photo-o" size="24" color="#666" style="margin-right: 20rpx;" />
            </view>
            <view class="input-box">
                <input 
                    type="text" 
                    v-model="inputContent" 
                    confirm-type="send" 
                    placeholder="问点什么...如：明天约会穿什么？" 
                    @confirm="handleSendText"
                />
                <view class="send-btn" @tap="handleSendText" :class="{ active: inputContent.trim() }">
                    <van-icon name="guide-o" color="#fff" size="20" />
                </view>
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
import { createSession, sendMessage, getHistory } from '@/api/chat';
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
const userInfo = ref<any>({});
const loading = ref(false);
const showClothesPicker = ref(false);

onLoad(async (options: any) => {
    const storedUser = uni.getStorageSync('userInfo');
    if (storedUser) {
        userInfo.value = storedUser;
        await initSession();

        // 自动发送从首页带来的上下文
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
                content: `你好，${userInfo.value.nickname || '同学'}！我是你的 AI 智能搭配师。你可以问我“明天面试穿什么”或者“周末去海边怎么穿”。`
            });
        }
    } catch (e) {
        console.error(e);
    }
};

const handleSendText = async () => {
    const text = inputContent.value.trim();
    if (!text) return;
    await doSend(text, 'text');
    inputContent.value = '';
};

const handleSendItem = async (item: any) => {
    // 1. 先展示图片消息
    msgList.value.push({ 
        role: 'user', 
        type: 'image', 
        content: `[图片]`, 
        meta: { image_url: item.image_url } 
    });
    scrollToBottom();

    // 2. 紧接着自动发送一条文本上下文
    await doSend(`这件 ${item.name} 怎么搭？`, 'text', [item.id]);
};

// 统一发送逻辑
const doSend = async (content: string, type: 'text'|'image' = 'text', linkedEntities: number[] = []) => {
    if (!sessionId.value || loading.value) return;

    if (type === 'text') {
        msgList.value.push({ role: 'user', type: 'text', content });
    }
    
    scrollToBottom();
    loading.value = true;

    try {
        const res: any = await sendMessage({
            sessionId: sessionId.value,
            userId: userInfo.value.id,
            content,
            msgType: type,
            linkedEntities
        });

        if (res.code === 200) {
            const reply = res.data;
            msgList.value.push({
                role: 'assistant',
                type: reply.msg_type || 'text',
                content: reply.content,
                meta: {
                    items: reply.linked_entities, 
                    title: reply.meta?.title || '推荐搭配' 
                }
            });
        }
    } catch (e) {
        msgList.value.push({
            role: 'assistant',
            type: 'text',
            content: '抱歉，我好像断网了，请稍后再试。'
        });
    } finally {
        loading.value = false;
        scrollToBottom();
    }
};

const scrollToBottom = () => {
    nextTick(() => {
        scrollTop.value += 1000;
    });
};

const previewImage = (url: string) => {
    uni.previewImage({ urls: [url] });
};
</script>

<style lang="scss">
page {
    background-color: #f7f8fa;
}
.chat-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.chat-history {
    flex: 1;
    padding: 30rpx;
    box-sizing: border-box;
}

.msg-item {
    display: flex;
    margin-bottom: 40rpx;
    align-items: flex-start;

    .avatar {
        width: 80rpx;
        height: 80rpx;
        border-radius: 50%;
        background: #fff;
        flex-shrink: 0;
    }

    .bubble {
        max-width: 65%;
        padding: 24rpx;
        border-radius: 20rpx;
        font-size: 28rpx;
        line-height: 1.6;
        position: relative;
        word-break: break-all;
    }
    
    .image-bubble {
        padding: 10rpx;
        background: transparent !important;
        
        .sent-image {
            width: 200rpx;
            height: 200rpx;
            border-radius: 12rpx;
            display: block;
        }
    }

    &.left {
        .avatar { margin-right: 20rpx; }
        .bubble {
            background: #fff;
            color: #333;
            border-top-left-radius: 4rpx;
        }
    }

    &.right {
        flex-direction: row-reverse;
        .avatar { margin-left: 20rpx; }
        .bubble {
            background: #1989fa;
            color: #fff;
            border-top-right-radius: 4rpx;
        }
        .user-bubble {
             background: #1989fa;
             color: #fff;
        }
    }
}

.outfit-card {
    margin-top: 20rpx;
    background: #fdfdfd;
    border-radius: 12rpx;
    padding: 16rpx;
    border: 1rpx solid #eee;

    .card-title {
        font-weight: bold;
        color: #333;
        margin-bottom: 12rpx;
        font-size: 26rpx;
        border-left: 6rpx solid #1989fa;
        padding-left: 10rpx;
    }

    .card-items-scroll {
        white-space: nowrap;
        margin-bottom: 16rpx;
        
        .card-items {
            display: flex;
        }
        
        .mini-item {
            margin-right: 16rpx;
            width: 120rpx;
            display: flex;
            flex-direction: column;
            align-items: center;

            .mini-img {
                width: 120rpx;
                height: 120rpx;
                border-radius: 8rpx;
                background: #f0f0f0;
                margin-bottom: 8rpx;
            }
            .mini-name {
                font-size: 20rpx;
                color: #666;
                width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                text-align: center;
            }
        }
    }
}

.input-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    padding: 20rpx 30rpx;
    padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
    box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.03);
    display: flex;
    align-items: flex-end; 
    
    .toolbar {
        padding: 0 10rpx;
        height: 72rpx;
        display: flex;
        align-items: center;
    }

    .input-box {
        flex: 1;
        display: flex;
        align-items: center;
        background: #f5f5f5;
        border-radius: 40rpx;
        padding: 10rpx 10rpx 10rpx 30rpx;

        input {
            flex: 1;
            height: 72rpx;
            font-size: 28rpx;
        }

        .send-btn {
            width: 72rpx;
            height: 72rpx;
            border-radius: 50%;
            background: #ccc;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 10rpx;
            transition: all 0.2s;
            
            &.active {
                background: #1989fa;
            }
        }
    }
}
</style>
