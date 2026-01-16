// api/user.ts
import { request } from '@/utils/request';

/**
 * 注册接口
 * @param data { username, password, confirmPassword }
 */
export const registerApi = (data : any) => {
    return request({
        url: '/user/register',
        method: 'POST',
        data
    });
};

/**
 * 登录接口
 * @param data { username, password }
 */
export const loginApi = (data : any) => {
    return request({
        url: '/user/login',
        method: 'POST',
        data
    });
};

/**
 * 更新个人资料及身材偏好 (用于引导卡片提交)
 * @param data { nickname, avatar, height, weight, shape, styles... }
 */
export const updateProfileApi = (data : any) => {
    return request({
        url: '/user/profile', 
        method: 'PUT',
        data
    });
};

/**
 * 获取当前用户信息
 */
export const getUserInfoApi = () => {
    return request({
        url: '/user/info',
        method: 'GET'
    });
};

/**
 * 获取用户详细资料 (包含身材数据)
 * @param account 
 */
export const getUserProfileApi = (account: string) => {
    return request({
        url: '/user/profile',
        method: 'GET',
        data: { account }
    });
};

/**
 * 获取用户统计数据 (衣物数、搭配数)
 * @param account 
 */
export const getUserStatsApi = (account: string) => {
    return request({
        url: '/user/stats',
        method: 'GET',
        data: { account }
    });
};