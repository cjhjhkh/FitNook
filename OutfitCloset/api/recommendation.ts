import request from '@/utils/request';

/**
 * 获取每日推荐
 * @param params { account?: string, userId?: number, count?: number, weather?: string, strategy?: string }
 */
export const getDailyRecommendation = (params: any) => {
  return request({
    url: '/recommendation/daily',
    method: 'GET',
    data: params
  });
};

/**
 * 发送推荐反馈
 * @param data { recommendation_id?: string, action: 'like' | 'dislike' | 'click' }
 */
export const sendFeedback = (data: any) => {
  return request({
    url: '/recommendation/feedback',
    method: 'POST',
    data: data
  });
};
