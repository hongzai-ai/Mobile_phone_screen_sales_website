# 手机屏幕销售网站

一个包含前端、后端、数据库的轻量级示例项目，适合在本地或小型服务器快速部署。

## 技术栈
- 后端：Node.js + Express + SQLite
- 前端：原生 HTML/CSS/JS（通过 Express 提供静态资源）
- 部署：支持直接 `node` 运行或使用 PM2/Docker

## 快速开始
1) 安装依赖
```bash
cd backend
npm install
```

2) 启动后端（会同时服务前端静态文件）
```bash
npm run start
# 默认 http://localhost:3001
```

3) 打开前端
- 直接访问 `http://localhost:3001`

## 环境变量
在 `backend/.env`（可选）里配置：
```
PORT=3001
ADMIN_TOKEN=your-admin-token
```

## API 摘要
- `GET /api/products` 获取产品列表
- `POST /api/products` 创建产品（需 `Authorization: Bearer <ADMIN_TOKEN>`）
- `PUT /api/products/:id` 更新产品（管理员）
- `DELETE /api/products/:id` 删除产品（管理员）
- `POST /api/orders` 提交订单
- `GET /api/orders` 查看订单（管理员）

## 数据库
- SQLite 文件位于 `backend/data.sqlite`（启动自动创建）
- 首次启动自动写入 4 条示例产品数据

## 部署提示
- 服务器需安装 Node.js 18+。
- 生产环境建议使用 `pm2 start src/server.js --name screen-shop` 保持守护。
- 如需 Docker，可自行编写 Dockerfile，核心命令：
  ```
  WORKDIR /app
  COPY backend/package*.json ./
  RUN npm install --production
  COPY backend .
  EXPOSE 3001
  CMD ["node", "src/server.js"]
  ```

## 管理员操作示例
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-admin-token" \
  -d '{"name":"测试屏幕","price":199,"stock":5}'
```

## 前端特性
- 产品网格、库存展示、购物车本地存储
- 下单表单与接口联通，成功后刷新库存
- 简单 toast 提示

