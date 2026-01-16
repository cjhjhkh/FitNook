// 在实际开发中，我们不能在每个页面都去写一遍 http://localhost:3000，也不能每次手动去拿 token。我们需要一个拦截器（Interceptor），它像一个安检口：
// 请求拦截：发请求前，自动把本地的 token 塞进 Header。
// 响应拦截：拿到数据后，如果后端说 401（登录过期），直接踢回登录页，省得每个页面都要写判断逻辑。

// utils/request.ts

export const BASE_URL = 'http://localhost:3000/api'; // 统一管理后端地址

export const request = (options: UniApp.RequestOptions) => {
    // 1. 从缓存中获取 Token
    const token = uni.getStorageSync('token');

    return new Promise((resolve, reject) => {
        uni.request({
            ...options,
            url: BASE_URL + options.url, // 拼接路径
            header: {
                ...options.header,
                'Authorization': token ? `Bearer ${token}` : '' // 自动携带 Token
            },
            success: (res: any) => {
                // 2. 状态码判断（根据你后端的约定修改）
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(res.data);
                } else if (res.statusCode === 401) {
                    // Token 过期或无效
                    uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
                    uni.removeStorageSync('token'); // 清除脏数据
                    setTimeout(() => {
                        uni.reLaunch({ url: '/pages/login/login' });
                    }, 1500);
                    reject(res.data);
                } else {
                    uni.showToast({
                        title: res.data.message || '请求失败',
                        icon: 'none'
                    });
                    reject(res.data);
                }
            },
            fail: (err) => {
                uni.showToast({ title: '网络异常，请检查后端服务', icon: 'none' });
                reject(err);
            }
        });
    });
};