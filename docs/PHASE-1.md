# LightRAW 阶段一规格与验收

## 交付边界

阶段一只实现以下能力：

1. Tauri 2、React、TypeScript 桌面项目骨架。
2. 单张照片选择和异步解码。
3. JPEG、PNG、TIFF、HEIF/HEIC 及主流厂商 RAW 解码 Adapter。
4. 解码后生成最大 4096 像素长边的线性半浮点预览。
5. WebGL 2 单通道 GPU 调色管线。
6. 色温、色调、曝光、对比度、高光和阴影调整。
7. 编辑参数与 React UI 解耦，并提供版本化中性配方。

图库、批量导入、导出、HSL、曲线、裁剪、蒙版、图层、历史记录和预设不属于阶段一。

## 公开 seam

- Editor Domain：创建中性配方、按参数范围提交编辑。
- Decode Module：输入路径和预览尺寸，返回元数据及线性 RGBA16F 缓冲区。
- Preview Renderer：输入缓冲区和编辑配方，渲染到 Canvas。

UI 不访问 LibRaw、libheif 或像素实现；滑块拖动只更新 WebGL uniform。

## 已验证

- TypeScript 类型检查通过。
- Editor Domain 和 Preview Renderer 单元测试通过。
- Rust 格式路由和 PNG 解码测试通过。
- 8064×4536 JPEG 在 macOS Debug 构建中生成 4096 长边预览约 7.6 秒；优化前为 39.1 秒。
- 真实 Sony ARW 通过 LibRaw 完整解码和去马赛克测试，未使用内嵌 JPEG 缩略图。
- 临时 HEIC 样片通过 libheif Adapter 解码测试。
- macOS `.app` 可启动、显示 4096×2304 JPEG，并能实时响应曝光滑块。

## 尚未验证或已知限制

- 当前环境没有 Windows 主机，Windows 仅提供构建配置；需要在 Windows 或 CI 上完成实际运行验证。
- 尚未收集 Canon、Nikon、Fujifilm、Panasonic 和 OM System 的真实 RAW 样片矩阵。
- 不做完整 ICC 色彩管理；普通图片按 sRGB 解释，RAW 转为线性 sRGB 预览。
- 阶段一只保存内存中的编辑状态，退出后不会保留。
- 正式安装包的原生动态库归档、签名和公证推迟到阶段五。
