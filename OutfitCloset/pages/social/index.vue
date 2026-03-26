<template>
	<view class="social-page">
		<!-- 列表区域 -->
		<scroll-view 
            scroll-y 
            class="feed-scroll" 
            @scrolltolower="loadFeed" 
            enable-back-to-top
            refresher-enabled
            :refresher-triggered="isRefreshing"
            @refresherrefresh="onRefresh"
        >
			<view class="feed-list">
				<view v-for="item in feedList" :key="item.id" class="post-card" @tap="goToDetail(item)">
					<!-- 用户头部 -->
					<view class="card-header">
						<image :src="item.user_avatar || '/static/logo.png'" mode="aspectFill" class="avatar" />
						<view class="user-info">
							<text class="nickname">{{ item.user_nickname || '神秘用户' }}</text>
							<text class="time">{{ item.time_ago }}</text>
						</view>
                        <!-- 删除按钮：仅显示自己的帖子 -->
                        <view 
                            v-if="String(item.user_id) === String(currentUser.id)" 
                            class="delete-btn" 
                            @tap.stop="onDeletePost(item)"
                        >
                             <van-icon name="delete-o" size="18px" color="#999" />
                        </view>
					</view>

					<!-- 内容区域 -->
					<view class="card-content">
						<text v-if="item.content" class="post-text">{{ item.content }}</text>
						<!-- 穿搭卡片 (点击可查看大图或详情) -->
						<view class="outfit-preview" v-if="item.image_url">
							<image :src="item.image_url" mode="widthFix" class="outfit-img"/>
							<view class="outfit-tag">
								<van-icon name="bag-o" size="12px" color="#fff" style="margin-right: 4px"/>
								<text>{{ item.outfit_name }}</text>
							</view>
						</view>
					</view>

					<!-- 底部操作栏 -->
					<view class="card-footer">
						<view class="action-item" @tap.stop="toggleLike(item)">
							<van-icon 
                                :name="item.is_liked ? 'like' : 'like-o'" 
                                :color="item.is_liked ? '#ff4d4f' : '#666'" 
                                size="20px" 
                            />
							<text class="count" :class="{ active: item.is_liked }">{{ item.like_count || 0 }}</text>
						</view>
                        <view class="action-item">
                            <van-icon name="eye-o" size="20px" color="#666" />
                            <text class="count">{{ item.view_count || 0 }}</text>
                        </view>
					</view>
				</view>
			</view>

            <!-- 空状态 -->
            <view v-if="feedList.length === 0 && !loading" class="empty-state">
                <van-empty description="暂时没有动态，快来发布第一条吧！" />
            </view>

            <!-- 底部加载状态 -->
            <view v-if="loading && feedList.length > 0" class="loading-more">
                <van-loading size="24px">加载中...</van-loading>
            </view>
            <view v-if="finished && feedList.length > 0" class="no-more">
                - 到底啦 -
            </view>
		</scroll-view>

		<!-- 悬浮发布按钮 -->
		<view class="fab-btn" @tap="goToPublish">
			<van-icon name="plus" color="#fff" size="24px" />
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { getSocialFeedApi, toggleLikeApi, deletePostApi } from '@/api/social';

const feedList = ref<any[]>([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);
const isRefreshing = ref(false);
const currentUser = uni.getStorageSync('userInfo') || {};

onLoad(() => {
    loadFeed();
    
    // 监听发布成功的事件
    uni.$on('refreshSocialFeed', () => {
        onRefresh();
    });
});

onUnload(() => {
    uni.$off('refreshSocialFeed');
});

const loadFeed = async (isLoadMore = false) => {
    if (loading.value || (isLoadMore && finished.value)) return;
    loading.value = true;

    if (!isLoadMore) {
        page.value = 1;
        finished.value = false;
    }

    try {
        const res: any = await getSocialFeedApi({
            page: page.value,
            limit: 10,
            current_user_id: currentUser.id
        });

        if (res.code === 200) {
            const list = res.data || [];
            if (isLoadMore) {
                feedList.value = [...feedList.value, ...list];
            } else {
                feedList.value = list;
            }

            if (list.length < 10) {
                finished.value = true;
            } else {
                page.value++;
            }
        }
    } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' });
    } finally {
        loading.value = false;
        isRefreshing.value = false;
    }
};

const onRefresh = () => {
    isRefreshing.value = true;
    loadFeed(false);
};

const toggleLike = async (item: any) => {
    // 乐观更新 UI
    const originalStatus = item.is_liked;
    const originalCount = item.like_count;

    item.is_liked = !item.is_liked;
    item.like_count = item.is_liked ? item.like_count + 1 : item.like_count - 1;

    try {
        const res: any = await toggleLikeApi({
            user_id: currentUser.id,
            post_id: item.id
        });
        
        if (res.code !== 200) {
            throw new Error('Failed'); // 触发回滚
        }
    } catch (e) {
        // 回滚
        item.is_liked = originalStatus;
        item.like_count = originalCount;
        uni.showToast({ title: '操作失败', icon: 'none' });
    }
};

const onDeletePost = (item: any) => {
    uni.showModal({
        title: '提示',
        content: '确定要删除这条动态吗？',
        success: async (res) => {
            if (res.confirm) {
                try {
                    const apiRes: any = await deletePostApi(item.id, { user_id: currentUser.id });
                    if (apiRes.code === 200) {
                        uni.showToast({ title: '已删除', icon: 'success' });
                        // 从列表中移除
                        feedList.value = feedList.value.filter(post => post.id !== item.id);
                    } else {
                        uni.showToast({ title: apiRes.msg || '删除失败', icon: 'none' });
                    }
                } catch (e) {
                    uni.showToast({ title: '网络异常', icon: 'none' });
                }
            }
        }
    });
};

const goToPublish = () => {
    uni.navigateTo({ url: '/pages/social/publish' });
};

const goToDetail = (item: any) => {
    uni.navigateTo({
        url: `/pages/social/detail?id=${item.id}`
    });
};

</script>

<style lang="scss" scoped>
.social-page {
	height: 100vh;
	background-color: #f7f8fa;
	position: relative;
}

.feed-scroll {
    height: 100%;
}

.feed-list {
	padding: 20rpx;
}

.post-card {
	background: #fff;
	border-radius: 20rpx;
	padding: 30rpx;
	margin-bottom: 24rpx;
	box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
    
    .card-header {
        display: flex;
        align-items: center;
        margin-bottom: 24rpx;
        position: relative; // 增加相对定位以便放置右上角按钮
        
        .avatar {
            width: 80rpx;
            height: 80rpx;
            border-radius: 50%;
            margin-right: 20rpx;
            background: #eee;
        }
        
        .user-info {
            flex: 1; // 占满剩余空间
            display: flex;
            flex-direction: column;
            
            .nickname {
                font-size: 30rpx;
                font-weight: 600;
                color: #333;
                margin-bottom: 4rpx;
            }
            .time {
                font-size: 24rpx;
                color: #999;
            }
        }

        // 新增删除按钮样式
        .delete-btn {
            padding: 10rpx;
            opacity: 0.6;
            
            &:active {
                opacity: 1;
            }
        }
    }
    
    .card-content {
        margin-bottom: 24rpx;
        
        .post-text {
            font-size: 30rpx;
            color: #333;
            line-height: 1.6;
            margin-bottom: 20rpx;
            display: block;
        }
        
        .outfit-preview {
            background: #f8f9fa;
            border-radius: 16rpx;
            overflow: hidden;
            position: relative;
            
            .outfit-img {
                width: 100%;
                display: block;
                // height is auto
            }
            
            .outfit-tag {
                position: absolute;
                bottom: 20rpx;
                left: 20rpx;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(4px);
                padding: 6rpx 16rpx;
                border-radius: 30rpx;
                display: flex;
                align-items: center;
                
                text {
                    font-size: 24rpx;
                    color: #fff;
                }
            }
        }
    }
    
    .card-footer {
        display: flex;
        align-items: center;
        border-top: 1rpx solid #eee;
        padding-top: 24rpx;
        
        .action-item {
            display: flex;
            align-items: center;
            margin-right: 40rpx;
            
            .count {
                font-size: 26rpx;
                color: #666;
                margin-left: 10rpx;
                
                &.active {
                    color: #ff4d4f;
                }
            }
        }
    }
}

.fab-btn {
    position: fixed;
    bottom: 60rpx;
    right: 40rpx;
    width: 100rpx;
    height: 100rpx;
    background: linear-gradient(135deg, #A4C2F4 0%, #d4e4fc 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 20rpx rgba(164, 194, 244, 0.4);
    z-index: 100;
    
    &:active {
        transform: scale(0.9);
    }
}

.loading-more, .no-more {
    text-align: center;
    padding: 20rpx;
    font-size: 24rpx;
    color: #999;
    display: flex;
    justify-content: center;
}
</style>