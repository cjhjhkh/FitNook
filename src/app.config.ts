export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/closet/index',
    'pages/calendar/index'
  ],
  tabBar: {
    list: [
      {
        pagePath: 'pages/closet/index',
        text: '衣橱'
      },
      {
        pagePath: 'pages/calendar/index',
        text: '日历'
      },
      {
        pagePath: 'pages/index/index',
        text: '主页'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'WeChat',
    navigationBarTextStyle: 'black'
  }
});
