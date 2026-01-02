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
        url: '/user/profile', // 请根据你后端的实际路径调整
        method: 'POST',
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