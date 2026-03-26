const axios = require('axios');

// 配置信息
const API_KEY = 'sk-2187078d5818478fb54af319c0c72ee5';
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'; // 兼容 OpenAI 协议的 URL

/**
 * 调用阿里云 Qwen 模型
 * @param {Array} messages - 聊天上下文 [{role: 'system', content: '...'}, {role: 'user', content: '...'}]
 * @param {string} model - 模型名称，默认 qwen-turbo
 */
async function callQwen(messages, model = 'qwen-turbo') {
    try {
        const response = await axios.post(
            `${BASE_URL}/chat/completions`,
            {
                model: model,
                messages: messages,
                temperature: 0.7, // 创意度
                stream: false     // 暂时不使用流式输出，简化处理
            },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        } else {
            console.error('AI Response Format Error:', response.data);
            return '抱歉，我现在有点累，请稍后再试。';
        }
    } catch (error) {
        console.error('Call Qwen API Error:', error.response ? error.response.data : error.message);
        return '网络连接异常，请检查后端服务。';
    }
}

/**
 * 流式调用阿里云 Qwen 模型
 * @param {Array} messages 
 * @param {string} model 
 * @returns {Promise<IncomingMessage>} 返回流对象
 */
async function callQwenStream(messages, model = 'qwen-turbo') {
    try {
        const response = await axios.post(
            `${BASE_URL}/chat/completions`,
            {
                model: model,
                messages: messages,
                temperature: 0.7,
                stream: true // 开启流式
            },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'X-DashScope-SSE': 'enable' // 显式开启 SSE
                },
                responseType: 'stream' // Axios 返回流
            }
        );
        return response.data;
    } catch (error) {
        console.error('Call Qwen Stream API Error:', error);
        throw error;
    }
}

/**
 * 调用 AI 并强制返回 JSON 对象
 * @param {Array} messages 
 * @param {string} model 
 * @returns {Promise<Object>} 解析后的 JSON 对象
 */
async function callQwenJson(messages, model = 'qwen-turbo') {
    // 在最后一条 System 消息或新建 System 消息中强制加上 JSON 指令
    const jsonInstruction = `
    IMPORTANT: You must output ONLY a valid JSON object. 
    Do not include any explanation, markdown formatting (like \`\`\`json), or text outside the JSON.
    The response should be parseable by JSON.parse().
    `;

    // 浅拷贝并注入指令
    const newMessages = [...messages];
    if (newMessages.length > 0 && newMessages[0].role === 'system') {
        newMessages[0].content += jsonInstruction;
    } else {
        newMessages.unshift({ role: 'system', content: jsonInstruction });
    }

    try {
        const content = await callQwen(newMessages, model);
        
        let jsonStr = content;
        // 1. 尝试移除 Markdown 标记
        jsonStr = jsonStr.replace(/```json\n?|```/g, '').trim();
        
        // 2. 如果还有非 JSON 字符，尝试正则提取最外层的 {} 或 []
        const jsonMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('JSON Parse Error:', e);
        // 返回一个保底的错误结构，避免前端崩溃
        return { error: true, reason: "AI 返回格式异常", raw: e.message };
    }
}

module.exports = {
    callQwen,
    callQwenStream,
    callQwenJson
};
