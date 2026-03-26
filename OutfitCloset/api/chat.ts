import { request } from '@/utils/request';

/**
 * 1. 创建/获取会话
 */
export const createSession = (userId: number) => {
    return request({
        url: '/chat/session',
        method: 'POST',
        data: { userId }
    });
};

/**
 * 2. 发送消息
 */
export const sendMessage = (data: { 
    sessionId: number, 
    userId: number, 
    content: string, 
    msgType?: 'text' | 'image' | 'voice',
    linkedEntities?: number[] // 关联单品ID
}) => {
    return request({
        url: '/chat/send',
        method: 'POST',
        data: { ...data, stream: true }, // 默认开启流式
        responseType: 'text', // 设置为 text 防止 UniApp 自动转换 JSON
        enableChunked: true  // 开启分块传输 (小程序端关键配置)
    } as any);
};

/**
 * 3. 获取历史消息
 */
export const getHistory = (sessionId: number) => {
    return request({
        url: '/chat/history',
        method: 'GET',
        data: { sessionId }
    });
};
