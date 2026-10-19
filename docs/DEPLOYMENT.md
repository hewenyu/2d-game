# 静态部署

[返回工程首页](../README.md) · [开发与验证](DEVELOPMENT.md)

以下构建命令在仓库根目录执行，环境要求见[开发指南](DEVELOPMENT.md)。

`vite.config.ts` 设置了 `base: './'`，打包结果全部使用相对路径。所以 `dist/` 可以放在任何域名、任何子路径下运行，不需要额外配置。

## 方式 A：Cloudflare Pages 连接 Git 仓库（推荐）

1. 打开 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，选择这个仓库
2. 构建设置：
   - Framework preset：`None`（或 `Vite`）
   - Build command：`npm run build`
   - Build output directory：`dist`
   - 如果这个项目在别的仓库的子目录里，把 Root directory 设为该子目录
   - 环境变量 `NODE_VERSION` = `20`（可选；仓库里已经有 `.nvmrc`）
3. 保存并部署。之后每次 push 都会自动重新部署

## 方式 B：命令行直接上传

```bash
npm run build
npx wrangler pages deploy dist --project-name huifeng
```

## 方式 C：挂到已有站点的子路径下

把 `dist/` 里的全部文件复制到外部项目的静态目录，例如 `public/games/huifeng/`，然后随外部项目一起部署。访问地址是 `https://你的域名/games/huifeng/`。

注意：链接要带**结尾的斜杠**。否则相对路径会解析到上一级目录。

## 部署检查

部署后检查首页与资源加载、键鼠输入和开局流程；使用子路径时，在目标子路径下重复检查。
首页返回 HTTP 200 不等于完整游玩验收，也不能证明线上版本与当前提交一致。
