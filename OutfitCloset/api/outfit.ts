import { request, BASE_URL } from '@/utils/request';

// 保存搭配
export const createOutfit = (data: any) => {
    return request({
        url: '/outfits',
        method: 'POST',
        data: data
    });
};

// 获取搭配列表
export const getOutfitList = (params: any) => {
    return request({
        url: '/outfits',
        method: 'GET',
        data: params
    });
};

// 获取搭配详情
export const getOutfitDetail = (id: string | number) => {
    return request({
        url: `/outfits/${id}`,
        method: 'GET'
    });
};

// 更新搭配
export const updateOutfit = (id: number | string, data: any) => {
    return request({
        url: `/outfits/${id}`,
        method: 'PUT',
        data: data
    });
};

// 删除搭配
export const deleteOutfit = (id: number | string) => {
    return request({
        url: `/outfits/${id}`,
        method: 'DELETE'
    });
};

// --- 日历相关 ---

// 获取日历数据
export const getCalendarList = (params: { account: string, year: number, month: number }) => {
    return request({
        url: '/outfits/calendar/list',
        method: 'GET',
        data: params
    });
};

// 添加到日历
export const addToCalendar = (data: { account: string, outfit_id: number | string, date: string }) => {
    return request({
        url: '/outfits/calendar',
        method: 'POST',
        data: data
    });
};

// 从日历移除
export const removeFromCalendar = (id: number | string) => {
    return request({
        url: `/outfits/calendar/${id}`,
        method: 'DELETE'
    });
};

// 上传合成图 (Snapshot)
export const uploadSnapshot = (filePath: string) => {
    return new Promise((resolve, reject) => {
        uni.uploadFile({
            url: `${BASE_URL}/upload`, // 使用统一的 BASE_URL
            filePath: filePath,
            name: 'file',
            header: {
                'Authorization': uni.getStorageSync('token') ? `Bearer ${uni.getStorageSync('token')}` : ''
            },
            success: (uploadFileRes) => {
                if (uploadFileRes.statusCode === 200) {
                    try {
                        const data = JSON.parse(uploadFileRes.data);
                        resolve(data);
                    } catch (e) {
                         // 有时候后端直接返回json对象而不是字符串（取决于uni-app平台处理），做个兼容
                        resolve(uploadFileRes.data);
                    }
                } else {
                    reject(uploadFileRes);
                }
            },
            fail: (err) => {
                reject(err);
            }
        });
    });
};
