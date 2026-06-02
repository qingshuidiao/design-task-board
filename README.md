# 设计任务实时看板

一个轻量的设计组任务看板原型，支持按周和按月查看任务，支持新增、编辑、拖拽移动、拖拽调整日期、搜索筛选、导入导出、本地保存和 Supabase 多人实时同步。

看板成员固定为 3 位设计师：迪、蔡、月。任务颜色跟随负责人自动分配，已完成任务统一切换为绿色完成态，请假任务切换为灰色请假态。

## 使用

直接打开 `index.html`，或在当前目录启动本地服务：

```bash
python3 -m http.server 4173
```

然后访问：

```text
http://localhost:4173
```

## 多人实时同步

现在看板已经接入 Supabase：

```text
https://fkkabjatwjlsfnchcbdr.supabase.co
```

第一次使用前，需要在 Supabase 里建一张任务表：

1. 打开 Supabase 项目页面。
2. 点击左侧或顶部的 `SQL Editor`。
3. 点击 `New query`。
4. 复制 `supabase-schema.sql` 里的全部内容，粘贴进去。
5. 点击 `Run`。

完成后，网页会自动读取 `design_tasks` 这张表。当前安全默认值是：匿名访问只能读取任务；只有登录 Supabase Auth，且邮箱在 `design_board_editors` 允许名单中的成员，才能新增、编辑、删除或拖拽同步任务。

不要把编辑口令或编辑权限校验放在前端页面里。前端只能做界面显示控制，真正的写入权限由 Supabase Auth + RLS 策略保护。

## 编辑成员

1. 在 Supabase 的 `Authentication` 里确认 Email 登录已启用。
2. 在 `Authentication` 的 URL 配置里，将 `Site URL` 设为 `https://qingshuidiao.github.io/design-task-board/`，并把同一个地址加入允许跳转地址。
3. 运行 `supabase-schema.sql`。
4. 把可编辑成员邮箱写入 `design_board_editors`：

```sql
insert into public.design_board_editors (email, display_name)
values
  ('designer@example.com', 'Designer')
on conflict (email) do update
set display_name = excluded.display_name;
```

成员进入看板后点击“编辑登录”，输入允许名单里的邮箱，按邮件链接登录后即可编辑。

## 已支持

- 周视图任务排期，默认周一到周日
- 月视图日历排期，日期格内显示当天任务
- 任务跨天条展示，样式贴近手动画板
- 迪、蔡、月三位设计师独立初始颜色
- 已完成任务切换为绿色完成态，姓名圆点仍保留负责人颜色
- 请假任务切换为灰色请假态
- 任务状态包含未完成、已完成、请假
- 新增、编辑、删除任务
- 在日期格里右键可通过菜单新增任务，开始日期自动带入该日期
- 拖拽任务到新的日期和显示行
- 拖拽任务左右边缘调整开始/结束日期
- 按成员、状态、关键词筛选
- 本地 `localStorage` 持久化
- 同源浏览器标签页间实时同步
- Supabase 云端任务表同步
- JSON 导入/导出，方便备份或迁移数据
