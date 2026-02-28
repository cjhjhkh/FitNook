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
        data
    });
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
