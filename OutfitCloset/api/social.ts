import request from '@/utils/request';

// 获取社区 Feed 流
export const getSocialFeedApi = (params: { page: number; limit: number; current_user_id?: number }) => {
  return request({
    url: '/social/feed',
    method: 'GET',
    data: params
  });
};

// 获取单条帖子详情
export const getPostDetailApi = (id: number | string, current_user_id?: number) => {
  return request({
    url: `/social/post/${id}`,
    method: 'GET',
    data: { current_user_id }
  });
};

// 发布动态
export const publishPostApi = (data: { user_id: number; outfit_id?: number; content: string; image_url?: string; image_urls?: string[] }) => {
  return request({
    url: '/social/publish',
    method: 'POST',
    data
  });
};

// 点赞/取消点赞
export const likePostApi = (data: { post_id: number | string; user_id: number }) => {
  return request({
    url: '/social/like',
    method: 'POST',
    data
  });
};

export const toggleLikeApi = likePostApi;

// 获取评论列表
export const getCommentsApi = (postId: number | string) => {
  return request({
    url: '/social/comments',
    method: 'GET',
    data: { post_id: postId }
  });
};

// 发表评论
export const publishCommentApi = (data: { post_id: number | string; content: string; user_id: number; parent_id?: number }) => {
  return request({
    url: '/social/comments',
    method: 'POST',
    data
  });
};

// 删除帖子 (预留)
export const deletePostApi = (postId: number, data: { user_id: number }) => {
  return request({
    url: `/social/post/${postId}`,
    method: 'DELETE',
    data
  });
};