declare const uni: any;

import { Component } from 'vue';

declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    'van-button': Component;
    'van-uploader': Component;
    // 在此继续添加你用到的 Vant 组件
  }
}

declare module 'vue' {
  export function ref<T = any>(value?: T): any;
  export function computed<T = any>(getter: any): any;
  export function onMounted(fn: () => void): void;
}

export {};