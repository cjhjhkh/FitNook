import { request } from '@/utils/request';

// 获取行李箱列表
export const getSuitcaseList = (params: { account: string, finished?: boolean }) => {
    return request({
        url: '/suitcases/list',
        method: 'GET',
        data: params
    });
};

// 获取行李箱详情
export const getSuitcaseDetail = (id: number | string) => {
    return request({
        url: '/suitcases/detail',
        method: 'GET',
        data: { id }
    });
};

// 创建行李箱
export const createSuitcase = (data: any) => {
    return request({
        url: '/suitcases/create',
        method: 'POST',
        data: data
    });
};

// 更新行李箱
export const updateSuitcase = (data: { 
    id: number | string, 
    items?: any[], 
    outfits?: any[], 
    name?: string,
    destination?: string,
    start_date?: string,
    end_date?: string,
    description?: string,
    status?: string
}) => {
    return request({
        url: '/suitcases/update',
        method: 'POST',
        data
    });
};

// 删除行李箱
export const deleteSuitcase = (id: number | string) => {
    return request({
        url: '/suitcases/delete',
        method: 'POST',
        data: { id }
    });
};

// 批量删除行李箱
export const batchDeleteSuitcase = (ids: (string | number)[]) => {
    return request({
        url: '/suitcases/batch-delete',
        method: 'POST',
        data: { ids }
    });
};

// 获取所有行程（用于日历标记等轻量级展示）
export const getSuitcaseRanges = (params: { account: string }) => {
    return request({
        url: '/suitcases/ranges',
        method: 'GET',
        data: params
    });
}

// 批量添加内容到行李箱 (衣物或搭配)
export const addContentToSuitcase = (data: {
    id: number | string,
    cloth_ids?: Array<number | string>,
    outfit_ids?: Array<number | string>
}) => {
    return request({
        url: '/suitcases/add-content',
        method: 'POST',
        data
    });
};

// 兼容别名导出
export const addSuitcaseContent = addContentToSuitcase;