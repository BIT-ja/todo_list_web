# Todo List Web

Vue 3 + Vite + Fastify + SQLite 的移动端待办应用，支持账号登录、待办管理、评论、地点选择、东八区时间展示和 `/todo/` 子路径部署。

## Project Structure

- `frontend/`: 前端应用，核心代码位于 `frontend/src/`。
  - `api/`: Axios 请求封装和接口类型。
  - `components/`: 通用组件，例如地点选择器和空状态。
  - `views/`: 页面级 Vue SFC。
  - `router/`, `stores/`, `utils/`: 路由、Pinia 状态和工具函数。
- `backend/`: Fastify API，核心代码位于 `backend/src/`。
  - `routes/`: HTTP 路由。
  - `services/`: 业务逻辑。
  - `db/`: SQLite 初始化和连接。
  - `types/`, `utils/`: 类型和通用工具。
- `deploy/`: Nginx、systemd 和数据库备份脚本。
- `docs/`: 项目说明和运维记录。

## Local Development

```bash
pnpm install
pnpm dev:backend
pnpm dev:frontend
```

默认本地地址：

- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:3000/api/health`

常用命令：

```bash
pnpm build:backend
pnpm build:frontend
pnpm build
cd backend && pnpm start
```

## Configuration

前端地图选点依赖高德地图：

```env
VITE_AMAP_KEY=your-amap-key
VITE_AMAP_SECURITY_JS_CODE=your-amap-security-js-code
```

生产环境建议设置：

```env
NODE_ENV=production
PORT=3000
DB_PATH=/opt/todo-app/data/todo.db
JWT_SECRET=replace-with-a-secure-random-secret
VITE_APP_BASE=/todo/
```

不要提交 `.env`、数据库文件、日志或备份文件。

## Deployment

当前服务器部署信息：

- Host: `115.190.242.124`
- App path: `/opt/todo-app`
- Public URL: `http://115.190.242.124/todo/`
- Backend service: `todo-app.service`
- Backend port: `3000`
- SQLite database: `/opt/todo-app/data/todo.db`
- Nginx config: serves frontend under `/todo/` and proxies `/todo/api/` to `127.0.0.1:3000/api/`

服务管理：

```bash
systemctl status todo-app
systemctl restart todo-app
nginx -t
systemctl reload nginx
```

## Remote Update

服务器上提供更新脚本：

```bash
/opt/todo-app/update.sh
```

脚本职责：

- 拉取 `master` 最新代码。
- 安装依赖。
- 构建后端和前端。
- 以前端 `/todo/` 子路径配置构建静态资源。
- 重启 `todo-app.service`。
- 在需要时重载 Nginx。

已配置 systemd 定时器自动更新：

```bash
systemctl status todo-app-update.timer
systemctl list-timers todo-app-update.timer
```

如果 GitHub 拉取失败，可以手动上传代码或在服务器恢复 GitHub 网络后执行更新脚本。

### Organization Migration Safety

组织功能通过原地迁移完成，不会重建、删除或清空 `users`、`todos`、`comments` 表：

- 创建 `organizations` 表和 `for-love` 组织。
- 为旧 `users` 表新增 `organization_id` 列。
- 仅将尚未绑定组织的现有用户回填为 `for-love`。
- 在同一个 SQLite 事务中校验迁移前的用户、待办和评论 ID 全部仍然存在。
- 校验所有用户均绑定有效组织，并执行 `PRAGMA foreign_key_check`；任一检查失败时整个迁移自动回滚。

生产环境更新前先执行在线备份：

```bash
cd /opt/todo-app
sudo DB_PATH=/opt/todo-app/data/todo.db \
  BACKUP_DIR=/opt/todo-app/backup \
  bash deploy/backup.sh
```

备份成功后再运行更新脚本。服务启动完成后可检查数据完整性：

```bash
sqlite3 /opt/todo-app/data/todo.db "PRAGMA integrity_check;"
sqlite3 /opt/todo-app/data/todo.db "PRAGMA foreign_key_check;"
sqlite3 /opt/todo-app/data/todo.db \
  "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM todos) AS todos;"
```

## Verification

部署或更新后检查：

```bash
curl http://127.0.0.1:3000/api/health
curl -I http://115.190.242.124/todo/
systemctl status todo-app --no-pager
```

## Notes

- 时间相关逻辑默认按东八区处理。
- 评论接口返回用户名，前端以气泡消息和用户名首字母头像展示。
- 生产密钥和高德地图配置应保存在环境文件或服务器环境变量中，不应写入仓库。
