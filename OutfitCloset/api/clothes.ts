import { request, BASE_URL } from '@/utils/request';

// 获取衣物列表
export const getClothesList = (params: any) => {
    return request({
        url: '/clothes/list',
        method: 'GET',
        data: params
    });
};

// 获取衣物详情
export const getClothesDetail = (id: number | string) => {
    return request({
        url: `/clothes/detail/${id}`,
        method: 'GET'
    });
};

// 上传衣物 (由于 uni.uploadFile 不走 request 拦截器，需单独处理)
export const uploadClothes = (filePath: string, formData: any = {}) => {
    const token = uni.getStorageSync('token');
    const userInfo = uni.getStorageSync('userInfo');
    
    // 确保 account 存在
    if (userInfo && userInfo.account) {
        formData.account = userInfo.account;
    }

    return new Promise((resolve, reject) => {
        uni.uploadFile({
            url: `${BASE_URL}/clothes/add`, // 使用统一配置的 BASE_URL
            filePath: filePath,
            name: 'image',
            formData: formData,
            header: {
                'Authorization': token ? `Bearer ${token}` : ''
            },
            success: (uploadRes) => {
                try {
                    const data = JSON.parse(uploadRes.data);
                    if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(data);
                    }
                } catch (e) {
                    reject(uploadRes);
                }
            },
            fail: (err) => {
                reject(err);
            }
        });
    });
};

// 更新衣物信息
export const updateClothes = (id: number | string, data: any) => {
    return request({
        url: `/clothes/update/${id}`,
        method: 'PUT',
        data: data
    });
};

// 删除单件衣物
export const deleteClothes = (id: number | string) => {
    return request({
        url: `/clothes/delete/${id}`,
        method: 'DELETE'
    });
};

// 批量删除衣物
export const batchDeleteClothes = (ids: (number | string)[]) => {
    return request({
        url: '/clothes/batch-delete',
        method: 'POST',
        data: { ids }
    });
};

// 批量添加标签
export const batchAddTags = (data: { ids: (number | string)[], category_ids?: any[], scene_ids?: any[], season_ids?: any[] }) => {
    return request({
        url: '/clothes/batch-add-tags',
        method: 'POST',
        data: data
    });
};

// 获取分类列表
export const getCategories = () => {
    return request({
        url: '/clothes/categories',
        method: 'GET'
    });
};

// 获取场景列表
export const getScenes = () => {
    return request({
        url: '/clothes/scenes',
        method: 'GET'
    });
};

// 获取季节列表
export const getSeasons = () => {
    return request({
        url: '/clothes/seasons',
        method: 'GET'
    });
};

// 新建标签
export const addTag = (data: { names: string, type: 'CATEGORY' | 'SCENE' | 'SEASON' }) => {
    return request({
        url: '/clothes/tags/add',
        method: 'POST',
        data: data
    });
};

// 批量删除标签
export const batchDeleteTags = (ids: (number | string)[]) => {
    return request({
        url: '/clothes/tags/batch-delete',
        method: 'POST',
        data: { ids }
    });
};
