# Daily Light 视觉验收稿

本目录用于第一阶段视觉验收，所有页面均使用固定演示数据，不会写入真实记录，也不会触发模型调用。

在线视觉稿（隔离 Preview，分享链接有效期至 2026 年 8 月 26 日）：

<https://xingfuxitong-hkkf37mbr-zouzhijies-projects.vercel.app/preview/daily-light-visual-review?screen=interview-start&_vercel_share=3gGJ9jNsezcpBEntIi3baTPGChxLMFz6>

## 页面顺序

1. 访谈入口
2. 访谈对话
3. 访谈完成
4. 日记
5. 周记
6. 月记

每个页面分别提供 `1440×900` 和 `1024×768` 截图。`overview-1440.png` 与 `overview-1024.png` 是六页总览；`comparison-*.png` 左侧为原型参考，右侧为本轮视觉稿。

## 推荐验收路径

1. 在“访谈入口”分别点击“帮我记”和“陪我聊”，观察入口权重和准备状态。
2. 在“访谈对话”检查顶部进度、统一气泡、赞踩和重新生成菜单。
3. 在“访谈完成”检查查看当日日记与继续记录的承接。
4. 依次查看日记、周记、月记，判断标题层级、正文阅读感、归档和素材回顾是否顺手。
5. 分别以 1440×900 和 1024×768 查看页面，重点留意首屏信息是否过密或过空。

## 当前边界

- 视觉稿可以点击切换页面和体验局部交互。
- 日记内容、归档和对话均为本地演示数据。
- 视觉确认后再接入真实接口，并部署独立功能 Preview。
- Production 保持当前版本。
