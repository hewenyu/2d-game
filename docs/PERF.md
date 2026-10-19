# 渲染与主循环性能报告

范围：把渲染成本压下来，同时不改变逻辑视口（960×540）、输入映射、碰撞几何、
攻击判定与手感参数。本文只记录**可复现的测量**，并明确区分「隔离绘制耗时」与
「真实 rAF 帧间隔」。

## 测量方法

candidate 与 baseline 用**同一个脚本**：当前检出的 `tools/perf/harness.mjs`。
baseline 使用 `c641431` 的独立干净目录（该旧版本没有此脚本），先在该目录安装依赖并启动服务；
所有 `node tools/perf/harness.mjs` 命令均从当前仓库目录运行，不要从 baseline 目录运行。

```bash
# baseline（c641431 的干净树，vite 跑在 5391）
npx vite --host 127.0.0.1 --port 5391 --strictPort        # 在 baseline 树里执行
node tools/perf/harness.mjs --url http://127.0.0.1:5391/ --dprs 1,2 --depths 0,2,3,5

# candidate
npx vite --host 127.0.0.1 --port 5399 --strictPort        # 在仓库里执行
node tools/perf/harness.mjs --url http://127.0.0.1:5399/ --q high --dprs 1,2 --depths 0,2,3,5
node tools/perf/harness.mjs --url http://127.0.0.1:5399/ --q med --dprs 1,2 --depths 0,2,3,5
node tools/perf/harness.mjs --url http://127.0.0.1:5399/ --q low --dprs 2 --depths 0,3
```

固定条件：视口 1920×1080、seed 99、关卡 0/2/3/5、隔离测试每段 60 帧、
rAF 阶段采样 64 个帧间隔，取中位数 / p95。
low 档只抽样了关卡 0/3。原始输出保存在 [perf/2026-10-19/](perf/2026-10-19/)：
`baseline.json`、`high.json`、`medium.json`、`low.json`。
最终脚本 SHA-256：`20fa84429f75d8e0224aabe3d7a818fa1f600478db94ec5f7b8d99a6ba49a04b`。

两段口径必须分开看：

- **isolated**：脚本直接调用 `update` / `draw` / `bg.drawBack` / `terrain` / `bg.drawFront`，
  每次绘制前都按 canvas 实际 backing store 重设
  `setTransform(w/960, 0, 0, h/540, 0, 0)`，每段结束用 `getImageData(0,0,1,1)` 强制光栅。
  这是「提交 + 光栅」的成本代理，不等于玩家看到的帧率。
- **raf**：原生 rAF 循环，不强制读回，记录真实帧间隔、每帧 update 总和、单次 draw 与每帧子步数。

环境：`bundled headless chromium 156.0.8078.4`，macOS arm64，隔离绘制使用**强制像素读回**。
脚本未采集 GPU 后端信息，因此不能仅凭 headless 就确认纯软件光栅。这里的数字只代表该测试环境，
不能替代低端真机、真实 GPU、Safari 或 Firefox 的实测。

> 历史说明：早期报告里的 8–10 ms / DPR2 来自一个 harness bug——分段计时前把 transform
> 重置成 1x，第 2 帧起的分段都在 1x 下绘制；那一版数字已废弃。

## 结果（中位数 / p95，毫秒）

### DPR2、1920×1080 CSS 视口（原始 backing 为 3840×2160）

| 版本 | backing | isolated draw | back | front | terrain | raf 帧间隔 | 观测帧率 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline c641431 | 3840×2160 | 124.6–132.9 / 129.2–156.4 | 75.9–83.6 | 6.8–7.1 | 2.4–3.5 | 116.7 / 133.4 | ~9 |
| candidate 默认（med） | 1920×1080 | 31.1–33.0 / 32.8–34.6 | 18.5–20.4 | 1.7–1.8 | 1.0–1.3 | 33.3 / 33.4–50.0 | ~30 |
| candidate `?q=low` | 1280×720 | 9.5–9.6 / 10.3–12.2 | 5.4–5.6 | 0.8 | 0.9 | 16.7 / 16.8 | ~60 |

### DPR1、1920×1080 窗口（普通显示器）

| 版本 | backing | isolated draw | back | front | terrain |
| --- | --- | --- | --- | --- | --- |
| baseline c641431 | 1920×1080 | 31.9–33.8 / 33.3–38.4 | 18.7–20.7 | 1.8–1.9 | 1.0–1.4 |
| candidate 默认（med） | 1920×1080 | 31.7–33.2 / 32.9–49.8 | 18.9–20.7 | 1.7–1.9 | 1.0–1.4 |
| candidate `?q=high` | 1920×1080 | 34.4–36.5 / 38.9–50.2 | 20.2–21.9 | 1.8–2.0 | 1.1–1.5 |

DPR1 下默认档不改变 backing 尺寸，观察值与 baseline 接近；单次短样本没有做统计显著性验证。

## 结论

1. **背景视差层是最大单项开销。** 修正 harness 后，`drawBack` 占 DPR2 整帧的 60–65%
   （baseline 75.9–83.6 ms / 124.6–132.9 ms），不是此前推测的 40%。
2. **成本随 backing 像素近似线性。** DPR2 的 3840×2160 backing 是 DPR1 的 4 倍像素，
   draw 也从 ~33 ms 涨到 ~128 ms。
3. **限制设备像素是收益最大的一步。** 默认档把 DPR2 的 backing 从 3840×2160 收到
   1920×1080，isolated draw 从 ~128 ms 降到 ~32 ms（约 4×），raf 帧间隔从 ~117 ms 降到 ~33 ms。
4. **`?q=low` 再降一档**（720p backing、少一层视差、关闭光束/尘埃/全屏后处理）：
   isolated draw 9.5 ms，raf 帧间隔 16.7 ms（该环境下 60 fps）。
5. **`?q=high` 与 baseline 属于同一耗时量级**，本轮未观察到明显渲染退化，
   但这不是严格的无回归证明；主要收益来自分辨率上限与低档开关。

## 已知局限

- 默认测试使用 bundled headless + 隔离绘制强制读回，未确认实际光栅后端。
  本轮**没有**独立做真实 GPU 验证，`?q=auto` 的降档阈值也没有在真实 GPU 上标定过。
- raf 帧间隔包含该无头浏览器的调度节奏（med/high 常见 30 Hz 台阶），
  不能直接当成设备性能上限。
- 低档减少的是**每帧绘制调用**，不会释放已经在内存里的背景离屏画布
  （每关约 24–34 MB），本文不宣称内存收益。
- 只测了 `startRun` 之后的稳态帧；关卡载入瞬间（3–18 ms）未做分布统计。
- 地图布局的种子可复现不等于整局可重放：敌人行为与部分特效仍使用非种子随机数。
