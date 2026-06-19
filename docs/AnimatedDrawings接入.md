# 接入 Meta AnimatedDrawings（可选 · 豪华兑现）

把孩子画的**人物**自动绑骨、做走/跳/舞的动画。这是"兑现层"的豪华档：**不配置也能玩**（自动降级到内置的轻量木偶动画），配置后在孩子明确要求动作时优先用绑骨动画。

> 来源：Meta 开源项目 <https://github.com/facebookresearch/AnimatedDrawings>（论文《A Method for Animating Children's Drawings of the Human Figure》）。许可与权重仅适合**家庭自用、非商业**。

## 本项目这边的契约（已实现）
- 后端 `POST /api/animate-figure`：把 `{ imageDataUrl }` 转发给 `ANIMATED_DRAWINGS_URL`，期望上游返回 `{ videoUrl }`。未配置返回 501。
- 前端 `tryFigureAnimation()`：拿到 `videoUrl` 就全屏播放；任何失败（未配置/网络错/格式不对）都返回 null，**自动降级**到 `runBehavior` 轻量木偶动画。
- 这一段已被端到端测试覆盖（桩服务返回视频→播放；501→降级木偶）。

## 你需要做的（运行真实模型服务）
AnimatedDrawings 的绑骨/分割是 Python 流水线（detectron2 + TorchServe），需单独运行：

1. 拉取并装环境
   ```bash
   git clone https://github.com/facebookresearch/AnimatedDrawings
   cd AnimatedDrawings
   conda create -n animated_drawings python=3.8.13 && conda activate animated_drawings
   pip install -e .
   ```
2. 按官方 README 启动 TorchServe（人物检测/分割/姿态模型）。
3. **包一层 HTTP 适配**（本项目约定的简单接口）：写一个小服务，接收 `{ imageDataUrl }` →
   - base64 解码成图片；
   - 跑 AnimatedDrawings 的 `examples`/`image_to_annotations` + `annotations_to_animation` 流水线，用一个 BVH 动作（如 `dab`/`jumping`/`wave`）渲染出 mp4/gif；
   - 把产物存到可访问的静态目录，返回 `{ "videoUrl": "http://<你的地址>/xxx.mp4" }`。
4. 在 `server/.env` 设 `ANIMATED_DRAWINGS_URL=http://127.0.0.1:8080/animate`（指向第 3 步的服务），重启后端。

## 说明 / 边界
- AnimatedDrawings 偏**人形**；非人形画作建议仍走轻量木偶动画（孩子说"飞/转圈"等也更顺）。
- 它返回的是**渲染好的视频**（孩子画作的绑骨复刻），与画布上的实时笔触是两种呈现；定位为偶尔的"惊喜大招"，不替代主回路。
- 模型服务较重（建议有 GPU）；纯 CPU 也能跑，只是慢。
- 本仓库**未内置**该 Python 服务（重依赖、需你按硬件自配）；我方只实现了代理、适配与降级，并已测试。
