# 微信小程序版本说明

## 当前实现

小程序代码位于 `miniprogram/`，采用原生微信小程序实现，不影响现有 `frontend/` Web 版本。

已配置 AppID：

```text
wxc71649546fe484cf
```

当前小程序 API 地址集中在：

```text
miniprogram/utils/config.js
```

默认值：

```text
https://115.190.242.124/todo/api
```

该地址可作为服务端开发/调试目标。体验版或正式版如果出现“网络请求失败”“接口域名未配置”之类提示，优先检查微信公众平台 request 合法域名配置。微信后台通常要求已备案 HTTPS 域名，公网 IP 地址可能无法通过后台配置或审核。

## 后端新增配置

微信一键登录需要后端配置：

```env
WECHAT_APP_ID=wxc71649546fe484cf
WECHAT_APP_SECRET=从微信公众平台获取的 AppSecret
```

你已提供当前 AppID 对应的 AppSecret。该值只能放后端环境变量，不能写入小程序代码、前端代码或 Git 仓库。

## 后端新增接口

```text
POST /api/auth/wechat-login
POST /api/auth/wechat-register
POST /api/auth/wechat-bind
```

登录流程：

1. 小程序调用 `wx.login()` 获取 `code`。
2. 小程序把 `code` 传给后端。
3. 后端用 `WECHAT_APP_ID`、`WECHAT_APP_SECRET` 和 `code` 调微信 `code2Session`。
4. 后端拿到 `openid` 后查找或绑定本地用户。
5. 后端签发现有 JWT，后续接口继续复用原认证体系。

## 数据库变更

非破坏性新增：

```sql
ALTER TABLE users ADD COLUMN wechat_openid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat_openid ON users(wechat_openid);
```

不会删除现有用户、待办、评论或分类。

## 小程序功能范围

- 微信一键登录
- 首次使用填写邀请码加入组织
- 绑定已有账号
- 账号密码登录兜底
- 组织内待办列表：未完成、已完成、全部
- 右滑达到阈值完成/恢复，并显示过程提示
- 左滑展示置顶、加急、删除
- 长按同组拖动排序
- 新建/编辑待办
- 多地点，最多 5 个
- 微信原生 `wx.chooseLocation` 选点
- 微信原生 `wx.openLocation` 导航第一个地点
- 待办详情、评论、URL 复制
- 个人主页
- `facai` 管理员分类后台

## 本地打开方式

1. 安装微信开发者工具。
2. 导入项目目录：`D:\personal\todo_list_web\miniprogram`。
3. AppID 使用 `wxc71649546fe484cf`。
4. 开发阶段如果仍使用 IP 地址接口，需要在微信开发者工具中临时关闭“校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。
5. 真机预览和正式版必须配置合法域名，并使用受信任 HTTPS 证书。若微信后台不接受公网 IP，请改用个人备案域名。

## 页面说明

```text
pages/auth/login       登录
pages/auth/join        微信首次加入组织
pages/auth/bind        绑定已有账号
pages/todos/index      待办列表
pages/todos/form       新建/编辑待办
pages/todos/detail     待办详情和评论
pages/profile/index    个人主页
pages/admin/categories 分类管理后台
```
