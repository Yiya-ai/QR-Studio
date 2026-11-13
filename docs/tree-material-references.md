# 树景材质与建模参考（2026-11-12）

本轮阅读以下开源实现，以现有原生 WebGL 渲染器重新实现相关思路。未引入项目源码、贴图、模型、音频、依赖或统计入口；这些链接只用于开发记录，页面运行不请求它们。

## 花簇体积与配色

- [Just a simple tree / foliage.js](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/8fd94b8edc7ef1b87c086694382a0808c059971c/foliage.js)：阅读花叶簇法线、AO 与簇色差。原项目使用半球射线求遮蔽；当前版本采用有界邻簇距离遮蔽近似，在生成几何时计算，不进行逐帧射线检测。
- [themes.js](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/8fd94b8edc7ef1b87c086694382a0808c059971c/themes.js)：参考阴面、中间色、亮部的分层方式；保留本项目浅粉与奶白方向，没有直接套用其最终主题参数。
- [MIT 许可证](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/8fd94b8edc7ef1b87c086694382a0808c059971c/LICENSE)，Copyright 2026 Mike Fernandez；该项目音乐/音效另有许可，本项目未使用。

当前数据布局仍为每顶点 12 个浮点数。植物的 normal 方向表示花簇径向与瓣面法线的混合，长度保存 0.77–1 的遮蔽值；着色器分别读取方向和长度。花瓣根部偏玫瑰粉，外缘偏浅色，以顶点色连续插值。整个花簇获得一致亮暗，最终二维码由完整 backing 接管，不受植物材质影响。

## 樱花与落花

- [Sakura Realm / blossoms.js](https://github.com/Leonxlnx/sakura-realm/blob/4dd670e9ccbf7dba6a72462288fd8111021b3006/src/tree/blossoms.js)：参考浅碗花瓣、内部遮蔽保底与花簇层次；保留既有五瓣几何和下垂花簇分布，限制暗部强度以避免花冠变灰。
- [petals.js](https://github.com/Leonxlnx/sakura-realm/blob/4dd670e9ccbf7dba6a72462288fd8111021b3006/src/tree/petals.js)：参考翻滚、空气阻力与共用风场。当前为固定 64 片花瓣的解析 GPU 动画，并非该项目完整物理模拟；下降初段加速后趋近稳定速度，按高度和相位改变周期，落地前减小翻滚，停留后缩小消失。
- [MIT 许可证](https://github.com/Leonxlnx/sakura-realm/blob/4dd670e9ccbf7dba6a72462288fd8111021b3006/LICENSE)，Copyright 2026 Leonxlnx。未引入整站入口或统计代码。

## 枝干

- [EZ-Tree / tree.js](https://github.com/dgreenheck/ez-tree/blob/main/src/lib/tree.js)：阅读随半径变化的 gnarliness、沿父枝采样子枝位置、渐细和树皮纹理坐标。当前保留自有主枝布局，增加与半径相关的平滑弯曲；子枝沿同一实际曲线取样，粗细随父枝剩余厚度递减。
- 树皮坐标改为圆周距离和沿枝弧长，避免用世界高度生成横向条纹；没有下载树皮纹理。
- [MIT 许可证](https://github.com/dgreenheck/ez-tree/blob/main/LICENSE)，Copyright 2024 Daniel Greenheck。

## 约束与验证

无新增依赖。维持 5,520 个花叶元素、64 片动态落花、原有季节/配色/旋转/天气/隐私清理和二维码端点。对花簇法线与遮蔽、瓣内色差、木纹坐标、父子枝连接、几何预算及二维码覆盖进行回归；真实 GPU 效果以浏览器截图和识别自检为准。此版本不宣称为参考站或参考项目的逐像素复刻。
