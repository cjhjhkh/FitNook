import { request } from '@/utils/request';

// 获取行李箱列表
export const getSuitcaseList = (params: { account: string }) => {
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

// 更新行李箱 (仅传ID和需要修改的字段)
export const updateSuitcase = (params: any) => {
	return request({
		url: '/suitcases/update',
		method: 'POST',
		data: params
	});
};

// 删除行李箱
export const deleteSuitcase = (id: string | number) => {
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

// 获取所有行程日期范围 (用于日历)
export const getSuitcaseRanges = (account: string) => {
	return request({
		url: '/suitcases/ranges',
		method: 'GET',
		data: { account }
	});
};

// 批量添加内容到行李箱 (衣物或搭配)
export const addSuitcaseContent = (params: {
    id: string | number;
    cloth_ids?: number[];
    outfit_ids?: number[];
}) => {
    return request({
        url: '/suitcases/add-content',
        method: 'POST',
        data: params
    });
};
