import { request } from '@/utils/request';

/**
 * 1. 获取仪表盘综合数据
 */
export const getDashboardData = (userId: number) => {
    return request({
        url: '/analytics/dashboard',
        method: 'GET',
        data: { userId }
    });
};

/**
 * 2. 获取 AI 推荐列表
 * type: 'internal_match' | 'style_explore'
 */
export const getRecommendations = () => {
    return request({
        url: '/analytics/recommendation',
        method: 'GET'
    });
};

/**
 * 3. 模拟搭配 (生成图片)
 */
export const simulateOutfit = (data: { userId: number, itemIds: number[], stylePrompt?: string }) => {
    return request({
        url: '/analytics/simulate',
        method: 'POST',
        data
    });
};

/**
 * 4. 收藏灵感
 */
export const collectInspiration = (data: {
    userId: number,
    outfitImageUrl: string,
    reason?: string,
    linkedItems?: number[],
    category?: string,
    profileSnapshot?: any,
    prompt?: string,
    scene?: string
}) => {
    return request({
        url: '/analytics/collection',
        method: 'POST',
        data
    });
};

/**
 * 5. 获取我的灵感收藏
 */
export const getMyCollections = (userId: number) => {
    return request({
        url: '/analytics/collection',
        method: 'GET',
        data: { userId }
    });
};

// 获取仪表盘统计数据
export const getDashboardStats = (userId: number | string) => {
    return request({
        url: '/analytics/dashboard',
        method: 'GET',
        data: { userId }
    });
};
