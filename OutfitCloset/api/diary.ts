import { request } from '@/utils/request';

// 获取某个月份的所有日记概览
export const getMonthDiaries = (params: { account: string, year: number, month: number }) => {
    return request({
        url: '/diary/month',
        method: 'GET',
        data: params
    });
};

// 获取日记列表（分页）
export const getDiaryList = (params: { account: string, page: number, pageSize: number }) => {
    return request({
        url: '/diary/list',
        method: 'GET',
        data: params
    });
};

// 获取日记列表（按月）
export const getCalendarList = (params: any) => {
    return request({
        url: '/diary/monthly',
        method: 'GET',
        data: params
    });
};

// 获取日记详情
export const getDiaryDetail = (id: string) => {
    return request({
        url: `/diary/detail/${id}`, // 修改为路径参数
        method: 'GET'
    });
};

// 创建日记
export const createDiary = (data: any) => {
    return request({
        url: '/diary/create',
        method: 'POST',
        data
    });
};

// 更新日记
export const updateDiary = (params: any) => {
    // 提取 id，剩余参数作为 body
    const { id, ...data } = params;
    return request({
        url: `/diary/update/${id}`, // RESTful 风格
        method: 'POST', // 后端也是 POST
        data: data
    });
};

// 删除日记
export const deleteDiary = (id: string | number) => {
    return request({
        url: `/diary/delete/${id}`,
        method: 'DELETE'
    });
};
