import { request } from '@/utils/request';

// 获取指定月份的日记概览
export const getMonthDiaries = (params: { year: number; month: number }) => {
    return request({
        url: '/diary/month',
        method: 'GET',
        data: params
    });
};

// 获取日记列表
export const getDiaryList = (params: { page: number; pageSize: number }) => {
    return request({
        url: '/diary/list',
        method: 'GET',
        data: params
    });
};

// 获取日记详情
export const getDiaryDetail = (id: number | string) => {
    return request({
        url: `/diary/detail/${id}`,
        method: 'GET'
    });
};

// 创建日记
export const createDiary = (data: { 
    user_id: number; 
    date: string; 
    content: string; 
    images?: string[]; 
    linked_items?: number[] 
}) => {
    return request({
        url: '/diary/create',
        method: 'POST',
        data
    });
};

// 更新日记 (包含文本和图片)
export const updateDiary = (id: string, data: {
    date: string;
    content: string;
    images?: string[];
}) => {
    return request({
        url: `/diary/update/${id}`,
        method: 'PUT',
        data
    });
};

// 删除日记
export const deleteDiary = (id: string) => {
    return request({
        url: `/diary/delete/${id}`,
        method: 'DELETE'
    });
};
