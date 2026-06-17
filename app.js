const LEGACY_STORAGE_KEYS = ["design-team-live-board-v1", "design-team-board-access-v1"];
const CHANNEL_NAME = "design-team-board-sync";
const minLaneCount = 7;
const maxLaneCount = 99;
const SUPABASE_CLIENT_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const supabaseConfig = window.BOARD_SUPABASE_CONFIG || {};
const brandMarkHtml = `
  <div class="mark" aria-hidden="true">
    <svg class="mark-icon" viewBox="0 0 48 48" focusable="false">
      <rect class="mark-tile" x="12" y="12" width="10" height="10" rx="3" />
      <rect class="mark-tile" x="26" y="12" width="10" height="10" rx="3" />
      <rect class="mark-tile" x="12" y="26" width="10" height="10" rx="3" />
      <rect class="mark-focus" x="26" y="26" width="10" height="10" rx="3" />
    </svg>
  </div>
`;

const owners = [
  { id: "di", name: "迪", tone: "blue" },
  { id: "cai", name: "蔡", tone: "cyan" },
  { id: "yue", name: "月", tone: "apricot" },
];

const statusText = {
  open: "未完成",
  done: "已完成",
  leave: "请假",
};

const nationalHolidayRanges = [
  { name: "元旦", start: "2026-01-01", end: "2026-01-03" },
  { name: "春节", start: "2026-02-15", end: "2026-02-23" },
  { name: "清明节", start: "2026-04-04", end: "2026-04-06" },
  { name: "劳动节", start: "2026-05-01", end: "2026-05-05" },
  { name: "端午节", start: "2026-06-19", end: "2026-06-21" },
  { name: "中秋节", start: "2026-09-25", end: "2026-09-27" },
  { name: "国庆节", start: "2026-10-01", end: "2026-10-07" },
];

const specialWorkdays = [
  { name: "调休补班", date: "2026-01-04" },
  { name: "调休补班", date: "2026-02-14" },
  { name: "调休补班", date: "2026-02-28" },
  { name: "调休补班", date: "2026-05-09" },
  { name: "调休补班", date: "2026-09-20" },
  { name: "调休补班", date: "2026-10-10" },
];

const nationalDaySchedule = createNationalDaySchedule(nationalHolidayRanges, specialWorkdays);

let state = {
  weekStart: startOfWeek(new Date()),
  viewMode: "week",
  tasks: [],
  filters: {
    search: "",
    owner: "all",
    status: "all",
  },
};

let dragTaskId = null;
let resizeState = null;
let contextTarget = null;
let toastTimer = null;
let remoteClient = null;
let remoteChannel = null;
let remoteRefreshTimer = null;
let boardStarted = false;
let accessRole = "guest";
let editorEmail = "";
let authListener = null;

const channel = createBroadcastChannel();

const els = {
  accessGate: document.querySelector("#accessGate"),
  accessForm: document.querySelector("#accessForm"),
  accessEmail: document.querySelector("#accessEmail"),
  accessHint: document.querySelector("#accessHint"),
  accessError: document.querySelector("#accessError"),
  accessLogout: document.querySelector("#accessLogout"),
  liveClock: document.querySelector("#liveClock"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  todayButton: document.querySelector("#todayButton"),
  monthLabel: document.querySelector("#monthLabel"),
  weekView: document.querySelector("#weekView"),
  monthView: document.querySelector("#monthView"),
  metrics: document.querySelector("#metrics"),
  boardHeader: document.querySelector("#boardHeader"),
  boardBody: document.querySelector("#boardBody"),
  boardGrid: document.querySelector("#boardGrid"),
  taskGrid: document.querySelector("#taskGrid"),
  searchInput: document.querySelector("#searchInput"),
  ownerFilter: document.querySelector("#ownerFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  openTaskForm: document.querySelector("#openTaskForm"),
  editorAuth: document.querySelector("#editorAuth"),
  editorStatus: document.querySelector("#editorStatus"),
  editorLogin: document.querySelector("#editorLogin"),
  editorLogout: document.querySelector("#editorLogout"),
  editorGate: document.querySelector("#editorGate"),
  closeEditorGate: document.querySelector("#closeEditorGate"),
  editorForm: document.querySelector("#editorForm"),
  editorEmail: document.querySelector("#editorEmail"),
  editorAuthError: document.querySelector("#editorAuthError"),
  drawer: document.querySelector("#taskDrawer"),
  closeDrawer: document.querySelector("#closeDrawer"),
  cancelForm: document.querySelector("#cancelForm"),
  taskForm: document.querySelector("#taskForm"),
  taskId: document.querySelector("#taskId"),
  drawerTitle: document.querySelector("#drawerTitle"),
  taskTitle: document.querySelector("#taskTitle"),
  taskOwner: document.querySelector("#taskOwner"),
  taskStatus: document.querySelector("#taskStatus"),
  taskStart: document.querySelector("#taskStart"),
  taskEnd: document.querySelector("#taskEnd"),
  taskLane: document.querySelector("#taskLane"),
  taskNote: document.querySelector("#taskNote"),
  deleteTask: document.querySelector("#deleteTask"),
  saveTask: document.querySelector("#saveTask") || document.querySelector('#taskForm button[type="submit"]'),
  exportTasks: document.querySelector("#exportTasks"),
  importTasks: document.querySelector("#importTasks"),
  importFile: document.querySelector("#importFile"),
  contextMenu: document.querySelector("#contextMenu"),
  contextCreateTask: document.querySelector("#contextCreateTask"),
  toast: document.querySelector("#toast"),
};

init();

async function init() {
  clearLegacyStorage();
  bindAccessGate();
  startBoard();
  lockBoard("请输入成员邮箱，登录后查看看板");
  await initRemoteSync();
}

function startBoard() {
  if (boardStarted) return;
  boardStarted = true;
  populateSelects();
  bindEvents();
  render();
  updateClock();
  window.setInterval(updateClock, 1000);
}

function bindAccessGate() {
  ensureAccessGate();
  if (!els.accessForm || !els.accessEmail || !els.accessError) {
    return false;
  }

  els.accessForm.addEventListener("submit", handleAccessSubmit);
  els.accessLogout?.addEventListener("click", signOutEditor);
  return true;
}

async function handleAccessSubmit(event) {
  event.preventDefault();
  const email = els.accessEmail.value.trim().toLowerCase();
  if (!email) {
    els.accessError.textContent = "请输入邮箱";
    els.accessEmail.select();
    return;
  }

  await requestLoginLink(email, els.accessError);
}

function ensureAccessGate() {
  if (els.accessForm && els.accessEmail && els.accessError) return;

  const gate = document.createElement("section");
  gate.className = "access-gate";
  gate.id = "accessGate";
  gate.setAttribute("aria-label", "访问验证");
  gate.innerHTML = `
    <form class="access-card" id="accessForm">
      ${brandMarkHtml}
      <h2>设计任务实时看板</h2>
      <p id="accessHint">请输入成员邮箱，登录后查看看板</p>
      <label class="field">
        <span>邮箱</span>
        <input id="accessEmail" type="email" autocomplete="email" placeholder="name@example.com" required />
      </label>
      <button class="primary-button" type="submit">发送登录链接</button>
      <button class="ghost-button" id="accessLogout" type="button" hidden>换邮箱登录</button>
      <div class="access-error" id="accessError" role="alert"></div>
    </form>
  `;
  document.body.prepend(gate);
  els.accessGate = gate;
  els.accessForm = gate.querySelector("#accessForm");
  els.accessEmail = gate.querySelector("#accessEmail");
  els.accessHint = gate.querySelector("#accessHint");
  els.accessError = gate.querySelector("#accessError");
  els.accessLogout = gate.querySelector("#accessLogout");
}

function lockBoard(message = "请输入成员邮箱，登录后查看看板") {
  document.body.classList.add("is-auth-locked");
  if (window.location.protocol === "file:") {
    message = "当前是本地文件打开，请用 http://localhost:4173 打开后登录";
  }
  if (els.accessHint) els.accessHint.textContent = message;
  window.setTimeout(() => els.accessEmail?.focus(), 40);
}

function unlockBoard() {
  document.body.classList.remove("is-auth-locked");
}

function hasEditAccess() {
  return accessRole === "editor";
}

function hasViewAccess() {
  return accessRole === "viewer" || accessRole === "editor";
}

function requireEditAccess() {
  if (hasEditAccess()) return true;
  showToast("当前为只读模式");
  return false;
}

function applyEditMode() {
  const canEdit = hasEditAccess();
  document.body.classList.toggle("is-read-only", !canEdit);
  els.openTaskForm.hidden = !canEdit;
  els.openTaskForm.disabled = !canEdit;
  els.importTasks.hidden = !canEdit;
  els.importTasks.disabled = !canEdit;
  if (els.editorStatus) {
    els.editorStatus.textContent = canEdit ? `${editorEmail} · 可编辑` : (editorEmail ? `${editorEmail} · 只读` : "只读模式");
  }
  if (els.editorLogin) els.editorLogin.hidden = Boolean(editorEmail);
  if (els.editorLogout) els.editorLogout.hidden = !editorEmail;
  render();
}

function bindEvents() {
  els.prevMonth.addEventListener("click", () => navigatePeriod(-1));
  els.nextMonth.addEventListener("click", () => navigatePeriod(1));
  els.todayButton?.addEventListener("click", goToToday);
  els.weekView.addEventListener("click", () => setViewMode("week"));
  els.monthView.addEventListener("click", () => setViewMode("month"));

  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  els.ownerFilter.addEventListener("change", (event) => {
    state.filters.owner = event.target.value;
    render();
  });

  els.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    render();
  });

  els.openTaskForm.addEventListener("click", () => {
    if (!requireEditAccess()) return;
    openDrawer();
  });
  els.editorLogin?.addEventListener("click", openEditorGate);
  els.editorLogout?.addEventListener("click", signOutEditor);
  els.closeEditorGate?.addEventListener("click", closeEditorGate);
  els.editorGate?.addEventListener("click", (event) => {
    if (event.target === els.editorGate) closeEditorGate();
  });
  els.editorForm?.addEventListener("submit", requestEditorLogin);
  els.closeDrawer.addEventListener("click", closeDrawer);
  els.cancelForm.addEventListener("click", closeDrawer);

  els.drawer.addEventListener("click", (event) => {
    if (event.target === els.drawer) closeDrawer();
  });

  els.taskForm.addEventListener("submit", handleSubmit);
  els.deleteTask.addEventListener("click", deleteCurrentTask);
  els.exportTasks.addEventListener("click", exportTasks);
  els.importTasks.addEventListener("click", () => {
    if (!requireEditAccess()) return;
    els.importFile.click();
  });
  els.importFile.addEventListener("change", importTasks);

  els.boardBody.addEventListener("dragover", (event) => {
    if (!hasEditAccess() || !dragTaskId || state.viewMode !== "week") return;
    event.preventDefault();
    highlightCellFromPointer(event.clientX, event.clientY);
  });

  els.boardBody.addEventListener("dragleave", clearCellHighlight);
  els.boardBody.addEventListener("drop", handleTaskDrop);
  els.boardBody.addEventListener("dblclick", openDrawerFromBoard);
  els.boardBody.addEventListener("contextmenu", openBoardContextMenu);
  els.contextCreateTask.addEventListener("click", createTaskFromContext);

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#contextMenu")) hideContextMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDrawer();
      closeEditorGate();
      hideContextMenu();
    }
  });

  document.addEventListener("pointermove", handleResizeMove);
  document.addEventListener("pointerup", handleResizeEnd);

  if (channel) {
    channel.addEventListener("message", (event) => {
      if (event.data?.type !== "tasks-updated") return;
      state.tasks = Array.isArray(event.data.tasks) ? event.data.tasks.map(normalizeTask).filter(Boolean) : state.tasks;
      render();
      showToast("任务已实时同步");
    });
  }
}

function populateSelects() {
  owners.forEach((owner) => {
    const filterOption = new Option(owner.name, owner.id);
    const formOption = new Option(owner.name, owner.id);
    els.ownerFilter.append(filterOption);
    els.taskOwner.append(formOption);
  });
  els.taskLane.max = String(maxLaneCount);
}

async function initRemoteSync() {
  const isConfigured = Boolean(supabaseConfig.enabled && supabaseConfig.url && supabaseConfig.anonKey);
  if (!isConfigured) {
    lockBoard("登录服务未配置，暂不能查看看板");
    return;
  }

  await connectRemoteSync();
}

async function connectRemoteSync() {
  try {
    showToast("正在连接登录服务");
    const { createClient } = await import(SUPABASE_CLIENT_URL);
    remoteClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    await initEditorAuth();
    showToast("登录服务已连接");
  } catch (error) {
    console.error(error);
    lockBoard("登录服务未就绪，请稍后重试");
    showToast("登录服务未就绪");
  }
}

async function initEditorAuth() {
  if (!remoteClient) return;

  const { data, error } = await remoteClient.auth.getSession();
  if (error) {
    console.error(error);
    return;
  }
  await updateEditorSession(data.session);

  if (!authListener) {
    const { data: listenerData } = remoteClient.auth.onAuthStateChange((_event, session) => {
      updateEditorSession(session).catch((authError) => {
        console.error(authError);
        showToast("编辑登录状态刷新失败");
      });
    });
    authListener = listenerData?.subscription || null;
  }
}

async function updateEditorSession(session) {
  const email = session?.user?.email?.toLowerCase() || "";
  editorEmail = email;
  if (els.accessEmail && email) els.accessEmail.value = email;

  if (!email) {
    accessRole = "guest";
    state.tasks = [];
    lockBoard("请输入成员邮箱，登录后查看看板");
    applyEditMode();
    return;
  }

  const member = await getBoardMember(email);
  if (!member) {
    accessRole = "guest";
    state.tasks = [];
    lockBoard("当前邮箱不在查看名单中");
    if (els.accessLogout) els.accessLogout.hidden = false;
    if (els.accessError) els.accessError.textContent = "已登录，但不在查看名单中";
    applyEditMode();
    return;
  }

  accessRole = member.role === "editor" ? "editor" : "viewer";
  unlockBoard();
  if (els.accessLogout) els.accessLogout.hidden = true;
  if (els.accessError) els.accessError.textContent = "";
  applyEditMode();
  await loadRemoteTasks();
  subscribeRemoteTasks();

  showToast(accessRole === "editor" ? "已进入可编辑模式" : "已进入只读模式");
}

async function getBoardMember(email) {
  if (!remoteClient || !email) return false;

  const { data, error } = await remoteClient
    .from("design_board_members")
    .select("email, role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error(error);
    return false;
  }
  return data || false;
}

function openEditorGate() {
  if (!remoteClient) {
    showToast("共享任务表未连接，暂不能登录编辑");
    return;
  }

  els.editorAuthError.textContent = "";
  els.editorEmail.value = editorEmail || "";
  els.editorGate.classList.add("is-open");
  els.editorGate.setAttribute("aria-hidden", "false");
  window.setTimeout(() => els.editorEmail.focus(), 40);
}

function closeEditorGate() {
  els.editorGate?.classList.remove("is-open");
  els.editorGate?.setAttribute("aria-hidden", "true");
}

async function requestEditorLogin(event) {
  event.preventDefault();
  if (!remoteClient) return;

  const email = els.editorEmail.value.trim().toLowerCase();
  if (!email) return;

  await requestLoginLink(email, els.editorAuthError);
}

async function requestLoginLink(email, errorEl) {
  if (!remoteClient) {
    if (errorEl) errorEl.textContent = "登录服务未连接";
    return;
  }

  const localFileMessage = getLocalFileLoginMessage();
  if (localFileMessage) {
    if (errorEl) errorEl.textContent = localFileMessage;
    showToast("请用本地服务地址打开");
    return;
  }

  if (errorEl) errorEl.textContent = "";
  const { error } = await remoteClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getLoginRedirectUrl(),
    },
  });

  if (error) {
    console.error(error);
    if (errorEl) errorEl.textContent = getLoginErrorMessage(error);
    return;
  }

  closeEditorGate();
  showToast("登录链接已发送，请查看邮箱");
  if (errorEl) errorEl.textContent = "";
  if (errorEl === els.accessError && els.accessHint) {
    els.accessHint.textContent = "登录链接已发送，请查看邮箱";
  }
}

function getLocalFileLoginMessage() {
  if (window.location.protocol !== "file:") return "";
  return "当前是直接打开本地文件，登录请求会被浏览器拦截。请在项目目录启动本地服务后，用 http://localhost:4173 打开。";
}

function getLoginRedirectUrl() {
  const currentUrl = window.location.href.split("#")[0];
  const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  return isLocalPreview ? currentUrl : (supabaseConfig.redirectUrl || currentUrl);
}

function getLoginErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("redirect")) {
    return "登录跳转地址没有加入 Supabase 允许列表，请检查 Authentication 的 URL 配置。";
  }
  if (message.includes("rate") || message.includes("too many")) {
    return "登录邮件发送太频繁了，请稍等几分钟再试。";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "网络或浏览器拦截导致登录失败，请确认网络正常，并用 http://localhost:4173 或线上地址打开。";
  }
  return "登录链接发送失败，请检查邮箱是否正确、Supabase 邮件服务是否可用。";
}

async function signOutEditor() {
  if (!remoteClient) return;
  const { error } = await remoteClient.auth.signOut();
  if (error) {
    console.error(error);
    showToast("退出登录失败");
    return;
  }

  editorEmail = "";
  accessRole = "guest";
  state.tasks = [];
  lockBoard("请输入成员邮箱，登录后查看看板");
  applyEditMode();
  showToast("已退出登录");
}

async function loadRemoteTasks() {
  if (!remoteClient || !hasViewAccess()) return;

  const { data, error } = await remoteClient
    .from("design_tasks")
    .select("*")
    .order("start_date", { ascending: true })
    .order("lane", { ascending: true });

  if (error) throw error;

  if (Array.isArray(data) && data.length) {
    state.tasks = data.map(remoteRowToTask).map(normalizeTask).filter(Boolean);
    render();
    return;
  }

  if (!data?.length) {
    showToast("共享任务表暂无数据");
  }
}

function subscribeRemoteTasks() {
  if (!remoteClient || remoteChannel) return;

  remoteChannel = remoteClient
    .channel("design-tasks-board")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "design_tasks",
      },
      () => {
        window.clearTimeout(remoteRefreshTimer);
        remoteRefreshTimer = window.setTimeout(() => {
          loadRemoteTasks().catch((error) => {
            console.error(error);
            showToast("同步失败，稍后自动重试");
          });
        }, 180);
      },
    )
    .subscribe();
}

async function syncTaskToRemote(task) {
  if (!remoteClient || !hasEditAccess()) return;

  const { error } = await remoteClient
    .from("design_tasks")
    .upsert(taskToRemoteRow(task), { onConflict: "id" });

  if (error) {
    console.error(error);
    showToast("任务已本地保存，共享同步失败");
  }
}

async function deleteTaskFromRemote(id) {
  if (!remoteClient || !hasEditAccess()) return;

  const { error } = await remoteClient
    .from("design_tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    showToast("任务已本地删除，共享同步失败");
  }
}

async function upsertRemoteTasks(tasks) {
  if (!remoteClient || !hasEditAccess() || !tasks.length) return;

  const { error } = await remoteClient
    .from("design_tasks")
    .upsert(tasks.map(taskToRemoteRow), { onConflict: "id" });

  if (error) {
    console.error(error);
    showToast("导入已本地保存，共享同步失败");
  }
}

function remoteRowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    owner: row.owner,
    start: row.start_date,
    end: row.end_date,
    lane: row.lane,
    status: row.status,
    note: row.note || "",
  };
}

function taskToRemoteRow(task) {
  const normalized = normalizeTask(task);
  return {
    id: normalized.id,
    title: normalized.title,
    owner: normalized.owner,
    start_date: normalized.start,
    end_date: normalized.end,
    lane: normalized.lane,
    status: normalized.status,
    note: normalized.note,
  };
}

function render() {
  const period = getActivePeriod();
  els.monthLabel.textContent = formatPeriodLabel(period);
  els.weekView.classList.toggle("is-active", state.viewMode === "week");
  els.monthView.classList.toggle("is-active", state.viewMode === "month");
  if (els.todayButton) els.todayButton.disabled = isCurrentPeriod(period);
  els.boardBody.classList.toggle("is-month-view", state.viewMode === "month");

  if (state.viewMode === "week") {
    renderWeek(period);
  } else {
    renderMonth(period);
  }

  renderMetrics(period);
}

function renderWeek(period) {
  els.boardHeader.classList.remove("is-month-header");
  els.taskGrid.className = "task-grid";
  const tasks = getVisibleTasks(period);
  const layout = buildWeekLayout(tasks);
  els.boardBody.style.setProperty("--visible-lane-count", String(layout.laneCount));
  renderWeekHeader(period.days);
  renderWeekGrid(period.days, layout.laneCount);
  renderWeekTasks(period, tasks, layout);
}

function renderWeekHeader(weekDays) {
  const today = toISODate(new Date());
  const visibleTasks = getVisibleTasks(periodFromDays(weekDays));
  els.boardHeader.innerHTML = weekDays
    .map((date) => {
      const iso = toISODate(date);
      const schedule = getNationalDaySchedule(iso);
      const dayTasks = visibleTasks.filter((task) => dateInRange(iso, task.start, task.end));
      const classes = [
        "day-head",
        iso === today ? "is-today" : "",
        schedule ? `is-${schedule.type}` : "",
      ].filter(Boolean).join(" ");
      return `
        <div class="${classes}" title="${escapeHtml(getScheduleTitle(schedule))}">
          <div class="weekday-block">
            <div class="weekday"><span>${weekdayText(date)}</span><b>${formatShortDate(date)}</b></div>
            ${schedule ? `<div class="day-note">${escapeHtml(schedule.name)}</div>` : ""}
          </div>
          <div class="day-meta">
            ${schedule ? `<span class="day-badge is-${schedule.type}">${scheduleLabel(schedule)}</span>` : ""}
            <span class="day-count">${dayTasks.length} 项</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderWeekGrid(weekDays, laneTotal = minLaneCount) {
  const today = toISODate(new Date());
  const weekDates = weekDays.map(toISODate);
  const cells = [];
  for (let lane = 1; lane <= laneTotal; lane += 1) {
    for (let day = 0; day < 7; day += 1) {
      const schedule = getNationalDaySchedule(weekDates[day]);
      const classes = [
        "grid-cell",
        weekDates[day] === today ? "is-today-cell" : "",
        schedule ? `is-${schedule.type}-cell` : "",
      ].filter(Boolean).join(" ");
      cells.push(
        `<div class="${classes}" data-day="${day}" data-lane="${lane}"></div>`,
      );
    }
  }
  els.boardGrid.innerHTML = cells.join("");
}

function renderWeekTasks(period, tasks, layout) {
  if (!tasks.length) {
    els.taskGrid.innerHTML = `<div class="empty-state">本周暂无匹配任务</div>`;
    return;
  }

  els.taskGrid.innerHTML = tasks
    .map((task) => renderWeekTask(task, period.days, layout.lanesByTaskId.get(task.id) || task.lane))
    .join("");

  els.taskGrid.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", () => openDrawer(card.dataset.id));
    card.addEventListener("dblclick", (event) => event.stopPropagation());
    card.addEventListener("dragstart", (event) => {
      if (!hasEditAccess()) {
        event.preventDefault();
        return;
      }

      dragTaskId = card.dataset.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.id);
      window.setTimeout(() => card.classList.add("is-dragging"), 0);
    });
    card.addEventListener("dragend", () => {
      dragTaskId = null;
      card.classList.remove("is-dragging");
      clearCellHighlight();
    });
  });

  if (hasEditAccess()) {
    els.taskGrid.querySelectorAll(".resize-handle").forEach((handle) => {
      handle.addEventListener("click", (event) => event.stopPropagation());
      handle.addEventListener("pointerdown", startResize);
    });
  }
}

function renderWeekTask(task, weekDays, lane) {
  const visibleStart = maxDate(parseISODate(task.start), weekDays[0]);
  const visibleEnd = minDate(parseISODate(task.end), weekDays[6]);
  const startIndex = differenceInDays(weekDays[0], visibleStart);
  const endIndex = differenceInDays(weekDays[0], visibleEnd);
  const duration = endIndex - startIndex + 1;
  const owner = getOwner(task.owner);

  const tone = getOwner(task.owner).tone;

  return `
    <article
      class="task-card tone-${tone} is-${task.status}"
      draggable="${hasEditAccess() ? "true" : "false"}"
      data-id="${task.id}"
      style="grid-column: ${startIndex + 1} / span ${duration}; grid-row: ${lane};"
      title="${escapeHtml(task.title)}"
    >
      <span class="resize-handle left" data-side="left" data-id="${task.id}"></span>
      <div class="task-content">
        <span class="avatar">${owner.name}</span>
        <div class="task-main">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">${statusText[task.status]} · ${formatRange(task.start, task.end)}</div>
        </div>
      </div>
      <span class="resize-handle right" data-side="right" data-id="${task.id}"></span>
    </article>
  `;
}

function renderMonth(period) {
  els.boardHeader.classList.add("is-month-header");
  els.taskGrid.className = "task-grid month-grid";
  els.boardGrid.innerHTML = "";
  renderMonthHeader();
  renderMonthCells(period);
}

function renderMonthHeader() {
  els.boardHeader.innerHTML = ["一", "二", "三", "四", "五", "六", "日"]
    .map((day) => `
      <div class="day-head month-weekday">
        <div class="weekday"><span>${day}</span></div>
      </div>
    `)
    .join("");
}

function renderMonthCells(period) {
  const today = toISODate(new Date());
  const activeMonth = state.weekStart.getMonth();
  const visibleTasks = getVisibleTasks(period);
  const layout = buildMonthLayout(period, visibleTasks);
  els.taskGrid.style.setProperty("--month-row-height", `${88 + layout.rowCount * 34}px`);

  const cells = period.days
    .map((date, index) => {
      const iso = toISODate(date);
      const schedule = getNationalDaySchedule(iso);
      const dayTasks = visibleTasks
        .filter((task) => dateInRange(iso, task.start, task.end))
        .sort((a, b) => a.lane - b.lane || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
      const classes = [
        "month-cell",
        date.getMonth() !== activeMonth ? "is-outside-month" : "",
        iso === today ? "is-today" : "",
        schedule ? `is-${schedule.type}` : "",
      ].filter(Boolean).join(" ");
      const gridColumn = (index % 7) + 1;
      const gridRow = Math.floor(index / 7) + 1;

      return `
        <section
          class="${classes}"
          data-date="${iso}"
          data-lane="1"
          style="grid-column: ${gridColumn}; grid-row: ${gridRow};"
          title="${escapeHtml(getScheduleTitle(schedule))}"
        >
          <div class="month-date">
            <div class="month-day-title">
              <strong>${date.getDate()}</strong>
              ${schedule ? `<span class="month-day-label is-${schedule.type}">${scheduleLabel(schedule)}</span>` : ""}
            </div>
            <span>${dayTasks.length ? `${dayTasks.length} 项` : ""}</span>
          </div>
          ${schedule ? `<div class="month-holiday">${escapeHtml(schedule.name)}</div>` : ""}
        </section>
      `;
    })
    .join("");
  const taskBars = layout.segments.map((segment) => renderMonthTask(segment)).join("");

  els.taskGrid.innerHTML = `${cells}${taskBars}`;

  els.taskGrid.querySelectorAll(".month-task").forEach((task) => {
    task.addEventListener("click", (event) => {
      event.stopPropagation();
      openDrawer(task.dataset.id);
    });
  });
}

function renderMonthTask(task) {
  const owner = getOwner(task.owner);
  const tone = owner.tone;
  const classes = [
    "month-task",
    `tone-${tone}`,
    `is-${task.status}`,
    task.isStart ? "is-segment-start" : "is-segment-continued",
    task.isEnd ? "is-segment-end" : "is-segment-continues",
  ].filter(Boolean).join(" ");
  return `
    <button
      class="${classes}"
      data-id="${task.id}"
      type="button"
      style="grid-column: ${task.startColumn} / span ${task.span}; grid-row: ${task.weekRow}; --month-stack-offset: ${52 + task.stack * 34}px;"
      title="${escapeHtml(`${task.title} · ${formatRange(task.start, task.end)}`)}"
    >
      <span>${owner.name}</span>
      <b>${escapeHtml(task.title)}</b>
    </button>
  `;
}

function renderMetrics(period) {
  const visibleTasks = getVisibleTasks(period);
  const today = toISODate(new Date());
  const schedule = getNationalDaySchedule(today);
  const nextHoliday = schedule?.type === "holiday" ? schedule : getNextHoliday(today);
  const open = visibleTasks.filter((task) => task.status === "open").length;
  const todayTasks = visibleTasks.filter((task) => dateInRange(today, task.start, task.end)).length;
  const done = visibleTasks.filter((task) => task.status === "done").length;
  const leave = visibleTasks.filter((task) => task.status === "leave").length;
  const periodLabel = state.viewMode === "week" ? "本周任务" : "本月任务";
  const holidayReminder = getHolidayReminder(schedule, nextHoliday);

  els.metrics.innerHTML = [
    metric(periodLabel, visibleTasks.length),
    metric("未完成", open),
    metric("今日覆盖", todayTasks),
    metric("假期提醒", holidayReminder),
    metric("已完成", done),
    metric("请假", leave),
  ].join("");
}

function metric(label, value) {
  return `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
}

function getVisibleTasks(period) {
  const periodStart = toISODate(period.start);
  const periodEnd = toISODate(period.end);
  return state.tasks
    .filter((task) => rangesOverlap(task.start, task.end, periodStart, periodEnd))
    .filter((task) => (state.filters.owner === "all" ? true : task.owner === state.filters.owner))
    .filter((task) => (state.filters.status === "all" ? true : task.status === state.filters.status))
    .filter((task) => {
      if (!state.filters.search) return true;
      const owner = getOwner(task.owner).name;
      const target = `${task.title} ${owner} ${statusText[task.status]} ${task.note}`.toLowerCase();
      return target.includes(state.filters.search);
    })
    .sort((a, b) => a.lane - b.lane || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

function buildWeekLayout(tasks) {
  const placedTasks = [];
  const lanesByTaskId = new Map();

  tasks.forEach((task) => {
    const preferredLane = clamp(Number(task.lane || 1), 1, maxLaneCount);
    const lane = findOpenLane(task.start, task.end, preferredLane, task.id, placedTasks);
    placedTasks.push({
      id: task.id,
      start: task.start,
      end: task.end,
      lane,
    });
    lanesByTaskId.set(task.id, lane);
  });

  const highestLayoutLane = placedTasks.reduce((max, task) => Math.max(max, task.lane), minLaneCount);
  const highestSavedLane = tasks.reduce((max, task) => Math.max(max, Number(task.lane || 1)), minLaneCount);

  return {
    lanesByTaskId,
    laneCount: clamp(Math.max(highestLayoutLane, highestSavedLane), minLaneCount, maxLaneCount),
  };
}

function buildMonthLayout(period, tasks) {
  const weekRows = Math.ceil(period.days.length / 7);
  const stacksByWeek = Array.from({ length: weekRows }, () => []);
  const segments = [];
  const gridStart = period.days[0];
  const gridEnd = period.days[period.days.length - 1];

  tasks.forEach((task) => {
    const taskStart = parseISODate(task.start);
    const taskEnd = parseISODate(task.end);

    for (let weekIndex = 0; weekIndex < weekRows; weekIndex += 1) {
      const weekStart = addDays(gridStart, weekIndex * 7);
      const weekEnd = addDays(weekStart, 6);
      const segmentStart = maxDate(taskStart, weekStart);
      const segmentEnd = minDate(taskEnd, weekEnd);
      if (segmentStart > segmentEnd) continue;

      const startOffset = differenceInDays(weekStart, segmentStart);
      const endOffset = differenceInDays(weekStart, segmentEnd);
      const stack = findOpenMonthStack(stacksByWeek[weekIndex], startOffset, endOffset);
      stacksByWeek[weekIndex].push({ startOffset, endOffset, stack });
      segments.push({
        ...task,
        weekRow: weekIndex + 1,
        startColumn: startOffset + 1,
        span: endOffset - startOffset + 1,
        stack,
        isStart: toISODate(segmentStart) === task.start,
        isEnd: toISODate(segmentEnd) === task.end,
      });
    }
  });

  const maxStack = stacksByWeek.reduce((max, week) => {
    const weekMax = week.reduce((stackMax, item) => Math.max(stackMax, item.stack), -1);
    return Math.max(max, weekMax);
  }, -1);

  return {
    segments,
    rowCount: Math.max(maxStack + 1, 2),
  };
}

function findOpenMonthStack(segments, startOffset, endOffset) {
  for (let stack = 0; stack < maxLaneCount; stack += 1) {
    const occupied = segments.some((segment) => {
      if (segment.stack !== stack) return false;
      return startOffset <= segment.endOffset && endOffset >= segment.startOffset;
    });
    if (!occupied) return stack;
  }
  return maxLaneCount - 1;
}

function findOpenLane(start, end, preferredLane = 1, excludeId = null, tasks = state.tasks) {
  const firstLane = clamp(Number(preferredLane || 1), 1, maxLaneCount);
  const lanes = [];

  for (let lane = firstLane; lane <= maxLaneCount; lane += 1) {
    lanes.push(lane);
  }

  for (let lane = 1; lane < firstLane; lane += 1) {
    lanes.push(lane);
  }

  return lanes.find((lane) => !isLaneOccupied(lane, start, end, excludeId, tasks)) || firstLane;
}

function isLaneOccupied(lane, start, end, excludeId = null, tasks = state.tasks) {
  return tasks.some((task) => {
    if (task.id === excludeId) return false;
    return Number(task.lane) === lane && rangesOverlap(task.start, task.end, start, end);
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!requireEditAccess()) return;

  const start = els.taskStart.value;
  const end = els.taskEnd.value;
  if (end < start) {
    showToast("结束日期不能早于开始日期");
    return;
  }

  const requestedLane = clamp(Number(els.taskLane.value), 1, maxLaneCount);
  const lane = findOpenLane(start, end, requestedLane, els.taskId.value || null);
  const payload = {
    id: els.taskId.value || createId(),
    title: els.taskTitle.value.trim(),
    owner: els.taskOwner.value,
    start,
    end,
    lane,
    tone: getOwner(els.taskOwner.value).tone,
    status: els.taskStatus.value,
    note: els.taskNote.value.trim(),
  };

  const index = state.tasks.findIndex((task) => task.id === payload.id);
  if (index >= 0) {
    state.tasks.splice(index, 1, payload);
  } else {
    state.tasks.push(payload);
  }

  persist();
  render();
  closeDrawer();
  showToast(lane === requestedLane ? "任务已保存" : `第 ${requestedLane} 行已有任务，已放到第 ${lane} 行`);
  await syncTaskToRemote(payload);
}

async function deleteCurrentTask() {
  if (!requireEditAccess()) return;

  const id = els.taskId.value;
  if (!id) {
    closeDrawer();
    return;
  }

  state.tasks = state.tasks.filter((task) => task.id !== id);
  persist();
  render();
  closeDrawer();
  showToast("任务已删除");
  await deleteTaskFromRemote(id);
}

function openDrawer(id = null, overrides = {}) {
  if (!id && !requireEditAccess()) return;

  const task = id ? state.tasks.find((item) => item.id === id) : null;
  const firstDay = toISODate(getWeekDays(state.weekStart)[0]);
  const defaultStart = overrides.start || firstDay;
  const defaultEnd = overrides.end || overrides.start || firstDay;
  const defaultLane = findOpenLane(defaultStart, defaultEnd, overrides.lane || 1);
  const defaultTask = {
    id: "",
    title: "",
    owner: owners[0].id,
    start: defaultStart,
    end: defaultEnd,
    lane: defaultLane,
    tone: owners[0].tone,
    status: "open",
    note: "",
  };
  const data = task || defaultTask;

  const canEdit = hasEditAccess();
  els.drawerTitle.textContent = canEdit ? (task ? "编辑任务" : "新增任务") : "查看任务";
  els.taskId.value = data.id;
  els.taskTitle.value = data.title;
  els.taskOwner.value = data.owner;
  els.taskStatus.value = data.status;
  els.taskStart.value = data.start;
  els.taskEnd.value = data.end;
  els.taskLane.max = String(maxLaneCount);
  els.taskLane.value = data.lane;
  els.taskNote.value = data.note || "";
  els.deleteTask.style.visibility = canEdit && task ? "visible" : "hidden";
  els.saveTask.hidden = !canEdit;
  [els.taskTitle, els.taskOwner, els.taskStatus, els.taskStart, els.taskEnd, els.taskLane, els.taskNote].forEach((field) => {
    field.disabled = !canEdit;
  });

  els.drawer.classList.add("is-open");
  els.drawer.setAttribute("aria-hidden", "false");
  window.setTimeout(() => (canEdit ? els.taskTitle : els.closeDrawer).focus(), 40);
}

function closeDrawer() {
  els.drawer.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
}

function openDrawerFromBoard(event) {
  if (!hasEditAccess()) return;
  if (event.target.closest(".task-card")) return;
  const target = getBoardDateTarget(event);
  if (!target) return;
  openDrawer(null, {
    start: target.date,
    lane: target.lane,
  });
}

function openBoardContextMenu(event) {
  if (!hasEditAccess()) return;

  const target = getBoardDateTarget(event);
  if (!target) return;

  event.preventDefault();
  contextTarget = target;
  els.contextMenu.style.left = `${event.clientX}px`;
  els.contextMenu.style.top = `${event.clientY}px`;
  els.contextMenu.classList.add("is-open");
  els.contextMenu.setAttribute("aria-hidden", "false");
}

function createTaskFromContext() {
  if (!requireEditAccess()) return;
  if (!contextTarget) return;
  openDrawer(null, {
    start: contextTarget.date,
    lane: contextTarget.lane,
  });
  hideContextMenu();
}

function hideContextMenu() {
  contextTarget = null;
  els.contextMenu.classList.remove("is-open");
  els.contextMenu.setAttribute("aria-hidden", "true");
}

function getBoardDateTarget(event) {
  if (state.viewMode === "month") {
    const monthCell = event.target.closest(".month-cell");
    if (!monthCell) return null;
    return {
      date: monthCell.dataset.date,
      lane: Number(monthCell.dataset.lane || 1),
    };
  }

  const cell = getCellFromPointer(event.clientX, event.clientY);
  if (!cell) return null;
  const day = getWeekDays(state.weekStart)[cell.day];
  return {
    date: toISODate(day),
    lane: cell.lane,
  };
}

function handleTaskDrop(event) {
  if (!hasEditAccess() || !dragTaskId || state.viewMode !== "week") return;
  event.preventDefault();
  const task = state.tasks.find((item) => item.id === dragTaskId);
  const cell = getCellFromPointer(event.clientX, event.clientY);
  if (!task || !cell) return;

  const duration = differenceInDays(parseISODate(task.start), parseISODate(task.end));
  const newStart = getWeekDays(state.weekStart)[cell.day];
  const newStartIso = toISODate(newStart);
  const newEndIso = toISODate(addDays(newStart, duration));
  const requestedLane = cell.lane;
  const openLane = findOpenLane(newStartIso, newEndIso, requestedLane, task.id);
  task.start = newStartIso;
  task.end = newEndIso;
  task.lane = openLane;

  dragTaskId = null;
  clearCellHighlight();
  persist();
  render();
  showToast(openLane === requestedLane ? "任务已移动" : `目标行已有任务，已放到第 ${openLane} 行`);
  syncTaskToRemote(task);
}

function startResize(event) {
  if (!hasEditAccess()) return;

  event.stopPropagation();
  event.preventDefault();
  const id = event.currentTarget.dataset.id;
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  resizeState = {
    id,
    side: event.currentTarget.dataset.side,
    originalStart: task.start,
    originalEnd: task.end,
  };

  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function handleResizeMove(event) {
  if (!hasEditAccess() || !resizeState) return;
  const task = state.tasks.find((item) => item.id === resizeState.id);
  const cell = getCellFromPointer(event.clientX, event.clientY);
  if (!task || !cell) return;

  const date = toISODate(getWeekDays(state.weekStart)[cell.day]);
  if (resizeState.side === "left" && date <= task.end) {
    task.start = date;
  }
  if (resizeState.side === "right" && date >= task.start) {
    task.end = date;
  }
  render();
}

function handleResizeEnd() {
  if (!hasEditAccess() || !resizeState) return;
  const task = state.tasks.find((item) => item.id === resizeState.id);
  let movedLane = null;
  if (task) {
    const requestedLane = task.lane;
    const openLane = findOpenLane(task.start, task.end, requestedLane, task.id);
    if (openLane !== requestedLane) {
      task.lane = openLane;
      movedLane = openLane;
    }
  }
  resizeState = null;
  persist();
  render();
  showToast(movedLane ? `日期已调整，并放到第 ${movedLane} 行` : "任务日期已调整");
  if (task) syncTaskToRemote(task);
}

function exportTasks() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), tasks: state.tasks }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `设计任务看板-${toISODate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("任务数据已导出");
}

function importTasks(event) {
  if (!requireEditAccess()) {
    event.target.value = "";
    return;
  }

  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    const parsed = safeParse(String(reader.result), null);
    const nextTasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
    if (!Array.isArray(nextTasks)) {
      showToast("导入文件格式不正确");
      return;
    }
    state.tasks = nextTasks.map(normalizeTask).filter(Boolean);
    persist();
    render();
    showToast("任务数据已导入");
    await upsertRemoteTasks(state.tasks);
  });
  reader.readAsText(file);
  event.target.value = "";
}

function getActivePeriod() {
  if (state.viewMode === "week") {
    return periodFromDays(getWeekDays(state.weekStart));
  }

  const monthStart = new Date(state.weekStart.getFullYear(), state.weekStart.getMonth(), 1);
  const monthEnd = new Date(state.weekStart.getFullYear(), state.weekStart.getMonth() + 1, 0);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);
  const dayTotal = differenceInDays(gridStart, gridEnd) + 1;
  const days = Array.from({ length: dayTotal }, (_, index) => addDays(gridStart, index));

  return {
    start: monthStart,
    end: monthEnd,
    days,
    gridStart,
    gridEnd,
  };
}

function periodFromDays(days) {
  return {
    start: days[0],
    end: days[days.length - 1],
    days,
  };
}

function formatPeriodLabel(period) {
  if (state.viewMode === "month") return formatMonth(state.weekStart);
  const sameMonth = period.start.getFullYear() === period.end.getFullYear() && period.start.getMonth() === period.end.getMonth();
  const monthLabel = sameMonth ? formatMonth(period.start) : `${formatMonth(period.start)}-${String(period.end.getMonth() + 1).padStart(2, "0")}月`;
  return `${monthLabel} · ${formatShortDate(period.start)}-${formatShortDate(period.end)}`;
}

function navigatePeriod(direction) {
  const nextDate = state.viewMode === "week" ? addDays(state.weekStart, direction * 7) : addMonths(state.weekStart, direction);
  setPeriod(nextDate);
}

function isCurrentPeriod(period) {
  const today = new Date();
  if (state.viewMode === "week") {
    return dateInRange(toISODate(today), toISODate(period.start), toISODate(period.end));
  }
  return state.weekStart.getFullYear() === today.getFullYear() && state.weekStart.getMonth() === today.getMonth();
}

function goToToday() {
  setPeriod(new Date());
  showToast("已回到今天");
}

function setPeriod(date) {
  state.weekStart = state.viewMode === "week" ? startOfWeek(date) : new Date(date.getFullYear(), date.getMonth(), 1);
  render();
}

function setViewMode(mode) {
  if (state.viewMode === mode) return;
  const previousMode = state.viewMode;
  const today = new Date();
  let anchorDate = state.weekStart;
  if (
    previousMode === "month" &&
    mode === "week" &&
    state.weekStart.getFullYear() === today.getFullYear() &&
    state.weekStart.getMonth() === today.getMonth()
  ) {
    anchorDate = today;
  }
  state.viewMode = mode;
  setPeriod(anchorDate);
}

function persist(shouldBroadcast = true) {
  if (shouldBroadcast && channel) {
    try {
      channel.postMessage({ type: "tasks-updated", tasks: state.tasks });
    } catch (error) {
      console.warn(error);
    }
  }
}

function clearLegacyStorage() {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage?.removeItem(key));
  } catch (error) {
    console.warn(error);
  }
}

function createBroadcastChannel() {
  try {
    return "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  } catch {
    return null;
  }
}

function normalizeTask(task) {
  if (!task || !task.title || !task.start || !task.end) return null;
  const owner = owners.some((item) => item.id === task.owner) ? task.owner : owners[0].id;
  return {
    id: task.id || createId(),
    title: String(task.title).slice(0, 40),
    owner,
    start: task.start,
    end: task.end,
    lane: clamp(Number(task.lane || 1), 1, maxLaneCount),
    tone: getOwner(owner).tone,
    status: normalizeStatus(task.status),
    note: String(task.note || "").slice(0, 160),
  };
}

function normalizeStatus(status) {
  return Object.prototype.hasOwnProperty.call(statusText, status) ? status : "open";
}

function getCellFromPointer(x, y) {
  const rect = els.boardBody.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const day = clamp(Math.floor(((x - rect.left) / rect.width) * 7), 0, 6);
  const laneTotal = Number(els.boardBody.style.getPropertyValue("--visible-lane-count")) || minLaneCount;
  const rowHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-height"));
  const lane = clamp(Math.floor((y - rect.top) / rowHeight) + 1, 1, laneTotal);
  return { day, lane };
}

function highlightCellFromPointer(x, y) {
  clearCellHighlight();
  const cell = getCellFromPointer(x, y);
  if (!cell) return;
  const target = els.boardGrid.querySelector(`[data-day="${cell.day}"][data-lane="${cell.lane}"]`);
  target?.classList.add("is-hovered");
}

function clearCellHighlight() {
  els.boardGrid.querySelectorAll(".is-hovered").forEach((cell) => cell.classList.remove("is-hovered"));
}

function updateClock() {
  const now = new Date();
  const schedule = getNationalDaySchedule(toISODate(now));
  const scheduleText = schedule ? ` · ${schedule.name}${schedule.type === "holiday" ? "休假" : "补班"}` : "";
  els.liveClock.textContent = `${formatFullDate(now)}${scheduleText} · ${now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })}`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}

function getOwner(id) {
  return owners.find((owner) => owner.id === id) || owners[0];
}

function createNationalDaySchedule(holidayRanges, workdays) {
  const schedule = {};

  holidayRanges.forEach((holiday) => {
    let date = parseISODate(holiday.start);
    const end = parseISODate(holiday.end);
    while (date <= end) {
      schedule[toISODate(date)] = {
        type: "holiday",
        name: holiday.name,
      };
      date = addDays(date, 1);
    }
  });

  workdays.forEach((workday) => {
    schedule[workday.date] = {
      type: "workday",
      name: workday.name,
    };
  });

  return schedule;
}

function getNationalDaySchedule(dateOrIso) {
  const iso = typeof dateOrIso === "string" ? dateOrIso : toISODate(dateOrIso);
  const schedule = nationalDaySchedule[iso];
  return schedule ? { ...schedule, iso } : null;
}

function scheduleLabel(schedule) {
  if (!schedule) return "";
  return schedule.type === "holiday" ? "休" : "班";
}

function getScheduleTitle(schedule) {
  if (!schedule) return "";
  return schedule.type === "holiday" ? `${schedule.name} · 休假` : `${schedule.name} · 周末上班`;
}

function getNextHoliday(todayIso) {
  const nextIso = Object.keys(nationalDaySchedule)
    .filter((iso) => iso >= todayIso && nationalDaySchedule[iso].type === "holiday")
    .sort()[0];
  return nextIso ? { ...nationalDaySchedule[nextIso], iso: nextIso } : null;
}

function getHolidayReminder(todaySchedule, nextHoliday) {
  if (todaySchedule?.type === "holiday") return `${todaySchedule.name}休`;
  if (todaySchedule?.type === "workday") return "今日补班";
  if (nextHoliday) return `${formatShortISODate(nextHoliday.iso)} ${nextHoliday.name}`;
  return "暂无";
}

function createId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfWeek(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = base.getDay() || 7;
  base.setDate(base.getDate() - day + 1);
  return base;
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function differenceInDays(start, end) {
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((endTime - startTime) / 86400000);
}

function maxDate(a, b) {
  return a > b ? a : b;
}

function minDate(a, b) {
  return a < b ? a : b;
}

function dateInRange(date, start, end) {
  return date >= start && date <= end;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}

function weekdayText(date) {
  return ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatShortISODate(iso) {
  return iso.slice(5).replace("-", "/");
}

function formatMonth(date) {
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月`;
}

function formatFullDate(date) {
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
}

function formatRange(start, end) {
  if (start === end) return start.slice(5).replace("-", "/");
  return `${start.slice(5).replace("-", "/")}-${end.slice(5).replace("-", "/")}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
