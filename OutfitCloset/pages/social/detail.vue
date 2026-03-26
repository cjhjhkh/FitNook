<template>
    <view class="social-detail">
        <!-- 自定义导航栏 (透明背景渐变效果可自行扩展) -->
        <view class="nav-bar">
            <view class="nav-left" @click="goBack">
                <van-icon name="arrow-left" size="22px" color="#333" />
            </view>
            <view class="user-info" v-if="post.user_nickname">
                <image :src="post.user_avatar || '/static/default-avatar.png'" class="avatar-sm" mode="aspectFill" />
                <text class="nickname">{{ post.user_nickname }}</text>
            </view>
        </view>

        <!-- 内容滚动区域 -->
        <scroll-view scroll-y class="content-scroll">
            <!-- 图片轮播 -->
            <swiper class="post-swiper" indicator-dots autoplay circular v-if="imageList.length > 0">
                <swiper-item v-for="(img, index) in imageList" :key="index" @click="previewImage(index)">
                    <image :src="img" mode="aspectFill" class="slide-image" />
                </swiper-item>
            </swiper>

            <view class="post-container">
                <!-- 帖子文本 -->
                <view class="post-content">
                    <text class="text">{{ post.content }}</text>
                </view>

                <!-- 发布时间 -->
                <view class="post-meta">
                    <text class="time">{{ formatDate(post.created_at) }}</text>
                </view>

                <!-- 关联搭配 -->
                <view class="related-outfit" v-if="post.outfit_id" @click="goToOutfit(post.outfit_id)">
                    <view class="outfit-card">
                        <view class="icon-wrap">
                            <van-icon name="shopping-cart-o" size="20px" color="#fff" />
                        </view>
                        <view class="outfit-info">
                            <text class="label">关联搭配</text>
                            <text class="name">{{ post.outfit_name || '查看搭配详情' }}</text>
                        </view>
                        <van-icon name="arrow" color="#999" />
                    </view>
                </view>

                <view class="divider"></view>

                <!-- 评论区 -->
                <view class="comments-section">
                    <view class="section-title">评论 ({{ comments.length }})</view>
                    
                    <view v-if="comments.length === 0" class="empty-comment">
                        <text>暂无评论，快来抢沙发吧~</text>
                    </view>

                    <view v-else class="comment-list">
                        <view v-for="item in comments" :key="item.id" class="comment-item">
                            <image :src="item.user_avatar || '/static/default-avatar.png'" class="comment-avatar" mode="aspectFill" />
                            <view class="comment-right">
                                <view class="comment-header">
                                    <text class="comment-user">{{ item.user_nickname || '神秘用户' }}</text>
                                    <text class="comment-time">{{ formatTimeAgo(item.created_at) }}</text>
                                </view>
                                <text class="comment-content">{{ item.content }}</text>
                            </view>
                        </view>
                    </view>
                </view>
                
                <!-- 底部垫高，防止被输入框遮挡 -->
                <view style="height: 120rpx;"></view>
            </view>
        </scroll-view>

        <!-- 底部操作栏 -->
        <view class="footer-bar">
            <view class="input-box" @click="openCommentInput">
                <van-icon name="edit" size="16px" color="#999" />
                <text class="placeholder">说点什么...</text>
            </view>
            
            <view class="actions">
                <view class="action-btn" @click="toggleLike">
                    <van-icon 
                        :name="post.is_liked ? 'like' : 'like-o'" 
                        :color="post.is_liked ? '#ff4d4f' : '#333'" 
                        size="24px" 
                    />
                    <text class="count">{{ post.like_count || 0 }}</text>
                </view>
                <view class="action-btn" @click="toggleFavorite">
                     <van-icon :name="post.is_favorited ? 'star' : 'star-o'" size="24px" :color="post.is_favorited ? '#ffcc00' : '#333'" />
                     <text class="count">收藏</text>
                </view>
            </view>
        </view>

        <!-- 评论输入弹窗 -->
        <van-popup :show="showCommentPopup" position="bottom" @close="closeCommentPopup" round>
            <view class="comment-popup">
                <view class="popup-header">
                    <text>发表评论</text>
                    <van-icon name="cross" @click="closeCommentPopup" />
                </view>
                <textarea 
                    v-model="commentText" 
                    placeholder="友善评论是交流的起点..." 
                    class="comment-textarea"
                    :cursor-spacing="20"
                    fixed
                    auto-height
					:adjust-position="true"
                />
                <view class="popup-footer">
                    <button class="send-btn" @click="submitComment" :disabled="!commentText.trim()">发送</button>
                </view>
            </view>
        </van-popup>

    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getPostDetailApi, getCommentsApi, toggleLikeApi, publishCommentApi as addCommentApi } from '@/api/social';
import { addFavorite, removeFavorite } from '@/api/favorites';

const postId = ref('');
const post = ref<any>({});
const imageList = ref<string[]>([]);
const comments = ref<any[]>([]);
const currentUser = uni.getStorageSync('userInfo') || {};
const statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 20;

const showCommentPopup = ref(false);
const commentText = ref('');
const actionLoading = ref(false);

onLoad((options: any) => {
    if (options.id) {
        postId.value = options.id;
        loadData();
    }
});

const loadData = async () => {
    uni.showLoading({ title: '加载中' });
    try {
        // 并行加载详情和评论
        const [postRes, commentRes] = await Promise.all([
            getPostDetailApi(postId.value, currentUser.id),
            getCommentsApi(postId.value)
        ]);

        if (postRes.code === 200) {
            post.value = postRes.data;
            imageList.value = postRes.data.images || [];
        }

        if (commentRes.code === 200) {
            comments.value = commentRes.data || [];
        }
    } catch (e) {
        console.error(e);
        uni.showToast({ title: '加载失败', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};

const goBack = () => {
    uni.navigateBack();
};

const previewImage = (current: number) => {
    uni.previewImage({
        urls: imageList.value,
        current
    });
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
};

const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const now = new Date();
    const past = new Date(dateStr);
    const diff = (now.getTime() - past.getTime()) / 1000;

    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    return past.toLocaleDateString(); // 超过一天显示日期
};

const goToOutfit = (outfitId: number) => {
    uni.navigateTo({ url: `/pages/outfit/create?id=${outfitId}&readonly=true` });
};

const toggleLike = async () => {
    const originalStatus = post.value.is_liked;
    
    // 乐观更新
    post.value.is_liked = !post.value.is_liked;
    post.value.like_count = post.value.is_liked ? post.value.like_count + 1 : post.value.like_count - 1;

    try {
        await toggleLikeApi({
            user_id: currentUser.id,
            post_id: Number(postId.value)
        });
        // 通知上一页更新（如果需要在列表页同步点赞状态）
        uni.$emit('refreshSocialFeed');
    } catch (e) {
        // 回滚
        post.value.is_liked = originalStatus;
        post.value.like_count = originalStatus ? post.value.like_count + 1 : post.value.like_count - 1;
        uni.showToast({ title: '操作失败', icon: 'none' });
    }
};

const toggleFavorite = async () => {
    if (actionLoading.value) return;
    actionLoading.value = true;
    
    const originalStatus = post.value.is_favorited;
    post.value.is_favorited = !originalStatus; // 乐观更新

    try {
        if (originalStatus) {
            await removeFavorite({
                userId: currentUser.id,
                itemType: 'post',
                itemId: Number(postId.value)
            });
            uni.showToast({ title: '已取消收藏', icon: 'none' });
        } else {
            await addFavorite({
                userId: currentUser.id,
                itemType: 'post',
                itemId: Number(postId.value)
            });
            uni.showToast({ title: '收藏成功', icon: 'success' });
        }
    } catch (e) {
        post.value.is_favorited = originalStatus; // 回滚
        uni.showToast({ title: '操作失败', icon: 'none' });
    } finally {
        actionLoading.value = false;
    }
};

const openCommentInput = () => {
    showCommentPopup.value = true;
};

const closeCommentPopup = () => {
    showCommentPopup.value = false;
};

const submitComment = async () => {
    if (!commentText.value.trim()) return;

    uni.showLoading({ title: '发送中' });
    try {
        const res: any = await addCommentApi({
            user_id: currentUser.id,
            post_id: postId.value,
            content: commentText.value
        });

        if (res.code === 200) {
            uni.showToast({ title: '评论成功', icon: 'success' });
            commentText.value = '';
            showCommentPopup.value = false;
            // 重新加载评论列表
            const commentRes: any = await getCommentsApi(postId.value);
            if (commentRes.code === 200) {
                comments.value = commentRes.data || [];
            }
        } else {
            uni.showToast({ title: res.msg || '评论失败', icon: 'none' });
        }
    } catch (e) {
        uni.showToast({ title: '网络异常', icon: 'none' });
    } finally {
        uni.hideLoading();
    }
};
</script>

<style lang="scss" scoped>
.social-detail {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: #fff;
    position: relative;
}

.nav-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    height: 44px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1rpx solid #eee;

    .nav-left {
        padding: 8px;
    }

    .user-info {
        display: flex;
        align-items: center;
        margin-left: 10px;

        .avatar-sm {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            margin-right: 8px;
            background: #eee;
        }

        .nickname {
            font-size: 14px;
            font-weight: 600;
            color: #333;
        }
    }
}

.content-scroll {
    flex: 1;
    height: 100%; // 确保占满
}

.post-swiper {
    width: 100%;
    height: 750rpx; // 1:1 图片展示

    .slide-image {
        width: 100%;
        height: 100%;
    }
}

.post-container {
    padding: 30rpx;
}

.post-content {
    margin-bottom: 20rpx;
    .text {
        font-size: 32rpx;
        color: #333;
        line-height: 1.6;
    }
}

.post-meta {
    margin-bottom: 30rpx;
    .time {
        font-size: 24rpx;
        color: #999;
    }
}

.related-outfit {
    margin-bottom: 30rpx;
    .outfit-card {
        background: #f7f8fa;
        border-radius: 16rpx;
        padding: 20rpx;
        display: flex;
        align-items: center;

        .icon-wrap {
            width: 80rpx;
            height: 80rpx;
            background: #A4C2F4;
            border-radius: 12rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 20rpx;
        }

        .outfit-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            
            .label {
                font-size: 22rpx;
                color: #999;
                margin-bottom: 4rpx;
            }
            .name {
                font-size: 28rpx;
                font-weight: 600;
                color: #333;
            }
        }
    }
}

.divider {
    height: 1rpx;
    background: #eee;
    margin: 40rpx 0;
}

.comments-section {
    .section-title {
        font-size: 30rpx;
        font-weight: 600;
        margin-bottom: 30rpx;
        color: #333;
    }

    .empty-comment {
        text-align: center;
        padding: 40rpx 0;
        color: #ccc;
        font-size: 26rpx;
    }

    .comment-list {
        .comment-item {
            display: flex;
            margin-bottom: 30rpx;
            
            .comment-avatar {
                width: 70rpx;
                height: 70rpx;
                border-radius: 50%;
                margin-right: 20rpx;
                flex-shrink: 0;
                background: #eee;
            }

            .comment-right {
                flex: 1;
                
                .comment-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8rpx;
                    
                    .comment-user {
                        font-size: 26rpx;
                        color: #666;
                        font-weight: 500;
                    }
                    
                    .comment-time {
                        font-size: 22rpx;
                        color: #ccc;
                    }
                }
                
                .comment-content {
                    font-size: 28rpx;
                    color: #333;
                    line-height: 1.5;
                }
            }
        }
    }
}

.footer-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1rpx solid #eee;
    padding: 20rpx 30rpx;
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    justify-content: space-between;

    .input-box {
        flex: 1;
        background: #f5f5f5;
        height: 70rpx;
        border-radius: 35rpx;
        padding: 0 30rpx;
        display: flex;
        align-items: center;
        margin-right: 30rpx;
        
        .placeholder {
            font-size: 28rpx;
            color: #999;
            margin-left: 10rpx;
        }
    }

    .actions {
        display: flex;
        align-items: center;
        
        .action-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-left: 40rpx;
            
            .count {
                font-size: 20rpx;
                color: #666;
                margin-top: 4rpx;
            }
        }
    }
}

.comment-popup {
    background: #fff;
    padding: 30rpx;
    padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
    border-radius: 24rpx 24rpx 0 0;
    
    .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30rpx;
        font-size: 32rpx;
        font-weight: 600;
    }
    
    .comment-textarea {
        width: 100%;
        min-height: 160rpx;
        background: #f7f8fa;
        border-radius: 12rpx;
        padding: 20rpx;
        font-size: 28rpx;
        box-sizing: border-box;
        margin-bottom: 20rpx;
    }
    
    .popup-footer {
        display: flex;
        justify-content: flex-end;
        
        .send-btn {
            background: #A4C2F4;
            color: #fff;
            border-radius: 40rpx;
            font-size: 28rpx;
            padding: 0 40rpx;
            height: 70rpx;
            line-height: 70rpx;
            border: none;
            
            &[disabled] {
                opacity: 0.5;
            }
            
            &:active {
                opacity: 0.8;
            }
        }
    }
}
</style>