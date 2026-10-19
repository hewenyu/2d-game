# 开发指南

[返回工程首页](../README.md) · [游玩与画质设置](PLAYING.md) · [部署](DEPLOYMENT.md)

以下命令均在仓库根目录执行。

## 环境与启动

需要 Node.js 20 或更高（`.nvmrc` 与 CI 使用 20）。

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 打包到 dist/
npm run preview    # 本地预览 dist/
```

开发时的调试参数（只在 URL 带 `?debug` 时生效，不影响正式玩家）：

- `?debug&level=2`：从第 3 层（第一个 Boss）开始，层数从 0 计
- `?debug&god`：无敌
- `?debug&gallery`：角色图鉴，放大展示每个角色模型的各个状态（←/→ 翻页）
- 从 `level > 0` 开始的“练习局”不计入最佳记录；仅开启 `?debug`、从第 1 层开始仍正常计入

## 运行时约束

后台页面不推进游戏或绘制；回到前台重置时钟与输入，不补算离开的时间。
单帧最多 12 个物理子步，每步不超过 1/120 秒；严重卡顿时丢弃超出 0.1 秒的积压时间，避免无限追帧。
出口装饰粒子只在模拟更新中生成，粒子总量最多 512，暂停/阅读/休憩期间不再因反复绘制而增长。

## 验证与基准

```bash
npm test                   # 源码/测试类型检查 + 单元测试
npm run build              # 生产构建
npx playwright install chromium
npm run preview -- --port 5399 --strictPort
```

保持预览服务运行，在另一个终端执行：

```bash
npm run test:browser -- http://localhost:5399/
npm run perf -- --url http://localhost:5399/ --dprs 1,2 --depths 0,2,3,5
npm run perf -- --url http://localhost:5399/ --q low --dprs 2 --depths 0
```

CI 分别执行类型检查、单元测试、构建和基于生产预览的 Chromium 回归。
单元测试覆盖时间预算、画布尺寸/画质策略、存档和固定种子的地图生成；浏览器回归覆盖暂停粒子、画布上限、输入清理与练习局记录等行为。
地图布局的种子可复现不等于整局战斗可重放：敌人行为和部分特效仍使用非种子随机数。

调整手感或内容后仍需手动检查开局、战斗可读性、死亡重试、灯龛和通关流程；
自动化通过不等于完成试玩。部署到子路径时，还要检查入口、资源加载和输入映射。

性能脚本分别记录隔离的更新/绘制耗时和实际 rAF 帧间隔；隔离绘制带强制像素读回，不能直接当成玩家实际 FPS。
对比改造前后时，必须使用同一个脚本、浏览器、种子、关卡、窗口尺寸、DPR 与启动参数，且明确画质档位。
默认无头浏览器的结果只代表该测试环境，不能代替低端真机、Safari 或 Firefox 的实测。
已记录的对比数据、环境与复现步骤见 [性能报告](PERF.md)。

## 项目结构

```
src/
├─ main.ts               入口：画布缩放（适配高分屏）、半固定步长主循环与页面生命周期
├─ config.ts             画面尺寸、物理手感参数、玩家基础数值、调试开关
├─ core/                 与玩法无关的基础设施
│  ├─ input.ts           键鼠输入、按键缓冲
│  ├─ loop.ts            子步长与单帧追帧预算
│  ├─ quality.ts         画布像素上限、画质档位与自动降档
│  ├─ audio.ts           WebAudio 合成的音效与环境声
│  ├─ camera.ts          镜头跟随、缩放、震屏
│  ├─ rng.ts             可复现的随机数（关卡种子）
│  └─ math.ts            碰撞与插值工具
├─ data/                 章节与叙事配置：现有机制内的内容扩展入口
│  ├─ chapters.ts        章节 / 关卡进程配置
│  ├─ lore.ts            序章、题词、层名、碑文、Boss 台词、尾声
│  └─ tips.ts            死因与对应提示
├─ world/                地图与关卡生成
│  ├─ rooms.ts           房间模板（30×17 字符画）
│  ├─ levelgen.ts        房间网格拼接、出口、Boss 竞技场、可达性校验
│  ├─ biomes.ts          章节配色
│  ├─ tilemap.ts         瓦片地图
│  └─ physics.ts         AABB 与瓦片碰撞、单向平台
├─ entities/             玩家、刃、敌人、Boss、场景物件
├─ render/               背景视差层、地形、粒子、绘制工具
│  ├─ rig.ts             角色骨骼工具：仿射变换、两骨 IK、胶囊肢体、Verlet 绳索 / 布料
│  └─ models/            角色模型（与实体逻辑分离，只吃一个 View 状态）
│     ├─ wanderer.ts     无名剑客
│     ├─ monk.ts         失声僧
│     ├─ guardian.ts     钟卫
│     ├─ moth.ts         符蛾
│     └─ abbot.ts        守钟人 · 玄寂 / 残响
└─ game/                 状态机、关卡运行时、HUD、各种界面、升级
```

### 往后加关卡

如果复用现有机制，在 `src/data/chapters.ts` 里追加配置即可扩展流程；
仍需补充叙事内容并验证新增关卡，不等于只改配置就完成验收：

```ts
// 在某章的 levels 里加一层
{ kind: 'normal', cols: 5, rows: 4, enemies: 16, pool: { pilgrim: 2, moth: 2, guard: 3 }, loot: 4, hpScale: 1.6 },

// 或者追加一整章（biome 用 world/biomes.ts 里已有的，或者新加一套配色）
{ name: '第三章名字', biome: 'abyss', levels: [ ... ] },
```

- `cols × rows`：房间网格大小，决定这层有多大
- `enemies` / `pool`：敌人数量和各种类的比例
- `kind: 'boss'`：这层底部会生成 Boss 竞技场
- 在 `src/data/lore.ts` 的 `LEVEL_NAMES` / `STELES` 里按层数补上层名和碑文（不补也能玩，只是没有碑）

### 加房间模板

在 `src/world/rooms.ts` 的 `ROOMS` 里加一个 30 列 × 17 行的字符画：

| 字符 | 含义 |
| --- | --- |
| `#` | 岩石 |
| `.` | 空气 |
| `=` | 单向平台 |
| `^` | 尖刺 |
| `?` | 50% 概率为岩石 |
| `e` / `g` / `f` | 地面敌人 / 偏向钟卫 / 飞行敌人的出生点 |
| `$` | 遗骸（余烬宝箱） |
| `S` | 灯龛候选位置 |
| `L` | 吊灯 |

障碍的设计原则：挡在通路上的东西都要给玩家选择。悬在地上、底下留一格空隙的石块，可以跳过去，也可以蹲着钻过去；生成器会自动给它挂上铁链。实心的台阶只用来造落差，不要横在唯一的通路上当墙。

出口会由生成器自动挖开：左右在第 11–14 行，上下在第 12–17 列。所以这些位置附近不要放关键结构。生成后会按跳跃能力近似校验可达性；未通过则换种子重试，最多 60 次，仍失败会抛出错误。该检查不是所有地图都可通关的证明。

### 加新敌人

1. 在 `src/render/models/` 下写它的模型（参考 `monk.ts`），在 `src/game/gallery.ts` 里加几格用来检查
2. 在 `src/entities/enemies/` 下新建一个类，继承 `Enemy`，写 `update`（状态机），`draw` 里把状态交给模型
3. 在 `src/data/chapters.ts` 的 `EnemyKind` 里加上它的名字
4. 在 `src/game/level.ts` 的 `spawnEnemies` 里加上对应的 `new`
5. 在 `src/data/tips.ts` 里加上它的死因提示
