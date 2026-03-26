import { request } from '@/utils/request';

// 添加收藏
export const addFavorite = (data: { userId: number, itemType: string, itemId: number }) => {
    return request({
        url: '/favorites/add',
        method: 'POST',
        data: {
            user_id: data.userId,
            item_type: data.itemType,
            item_id: data.itemId
        }
    });
};

// 取消收藏
export const removeFavorite = (data: { userId: number, itemType: string, itemId: number }) => {
    return request({
        url: '/favorites/remove',
        method: 'POST',
        data: {
            user_id: data.userId,
            item_type: data.itemType,
            item_id: data.itemId
        }
    });
};

// 检查收藏状态
export const checkFavorite = (userId: number, itemType: string, itemId: number) => {
    return request({
        url: '/favorites/check',
        method: 'GET',
        data: {
            user_id: userId,
            item_type: itemType,
            item_id: itemId
        }
    });
};

// 获取收藏列表
export const getFavoriteList = (userId: number, itemType: string, page: number = 1, limit: number = 20) => {
    return request({
        url: '/favorites/list',
        method: 'GET',
        data: {
            user_id: userId,
            type: itemType,
            page,
            limit
        }
    });
};
