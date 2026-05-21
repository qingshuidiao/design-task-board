const STORAGE_KEY = "design-team-live-board-v1";
const ACCESS_STORAGE_KEY = "design-team-board-access-v1";
const ACCESS_CODE = "design2026";
const ACCESS_CODE_HASH = "020c355824f43c23a61f7fbeb5fde1acdfdf447747b52c670bfd965be7cd9a52";
const CHANNEL_NAME = "design-team-board-sync";
const laneCount = 7;
const SUPABASE_CLIENT_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const supabaseConfig = window.BOARD_SUPABASE_CONFIG || {};

const owners = [
  { id: "di", name: "迪", tone: "blue" },
  { id: "cai", name: "蔡", tone: "cyan" },
  { id: "yue", name: "月", tone: "apricot" },
];

const statusText = {
  open: "未完成",
  done: "已完成",
};

const seedTasks = [
  {
    id: "task-asset-migration",
    title: "设计资产迁移、导入",
    owner: "di",
    start: "2026-05-18",
    end: "2026-05-19",
    lane: 1,
    tone: "blue",
    status: "done",
    note: "设计资产梳理与导入验证",
  },
  {
    id: "task-new-tool",
    title: "新工具",
    owner: "di",
    start: "2026-05-20",
    end: "2026-05-20",
    lane: 1,
    tone: "blue",
    status: "open",
    note: "",
  },
  {
    id: "task-recruit-review",
    title: "招招-预约面试-需求评审",
    owner: "di",
    start: "2026-05-21",
    end: "2026-05-21",
    lane: 1,
    tone: "blue",
    status: "open",
    note: "",
  },
  {
    id: "task-recruit-interview",
    title: "招招-预约面试",
    owner: "di",
    start: "2026-05-22",
    end: "2026-05-22",
    lane: 1,
    tone: "blue",
    status: "open",
    note: "",
  },
  {
    id: "task-basic-review-di",
    title: "人员基本信息-评审",
    owner: "di",
    start: "2026-05-19",
    end: "2026-05-19",
    lane: 2,
    tone: "blue",
    status: "done",
    note: "",
  },
  {
    id: "task-codex-ip",
    title: "codex - IP",
    owner: "di",
    start: "2026-05-20",
    end: "2026-05-22",
    lane: 2,
    tone: "blue",
    status: "open",
    note: "",
  },
  {
    id: "task-people-info",
    title: "人员信息",
    owner: "cai",
    start: "2026-05-18",
    end: "2026-05-18",
    lane: 4,
    tone: "cyan",
    status: "done",
    note: "",
  },
  {
    id: "task-basic-review-cai",
    title: "人员基本信息-评审",
    owner: "cai",
    start: "2026-05-19",
    end: "2026-05-19",
    lane: 4,
    tone: "cyan",
    status: "done",
    note: "",
  },
  {
    id: "task-codex",
    title: "codex",
    owner: "cai",
    start: "2026-05-20",
    end: "2026-05-20",
    lane: 4,
    tone: "cyan",
    status: "open",
    note: "",
  },
  {
    id: "task-component-learning",
    title: "新工具+组件库学习",
    owner: "cai",
    start: "2026-05-21",
    end: "2026-05-22",
    lane: 4,
    tone: "cyan",
    status: "open",
    note: "",
  },
  {
    id: "task-daily-words",
    title: "每日心语-6月",
    owner: "cai",
    start: "2026-05-18",
    end: "2026-05-21",
    lane: 5,
    tone: "cyan",
    status: "open",
    note: "",
  },
  {
    id: "task-ui-review-old",
    title: "UI复验-学习平台3.0",
    owner: "cai",
    start: "2026-05-18",
    end: "2026-05-18",
    lane: 6,
    tone: "cyan",
    status: "open",
    note: "",
  },
  {
    id: "task-ui-review-new",
    title: "UI复验-学习平台3.0",
    owner: "cai",
    start: "2026-05-19",
    end: "2026-05-19",
    lane: 6,
    tone: "cyan",
    status: "open",
    note: "",
  },
];

let state = {
  weekStart: startOfWeek(new Date()),
  viewMode: "week",
  tasks: loadTasks(),
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

const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

const els = {
  accessGate: document.querySelector("#accessGate"),
  accessForm: document.querySelector("#accessForm"),
  accessCode: document.querySelector("#accessCode"),
  accessError: document.querySelector("#accessError"),
  liveClock: document.querySelector("#liveClock"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
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
  exportTasks: document.querySelector("#exportTasks"),
  importTasks: document.querySelector("#importTasks"),
  importFile: document.querySelector("#importFile"),
  contextMenu: document.querySelector("#contextMenu"),
  contextCreateTask: document.querySelector("#contextCreateTask"),
  toast: document.querySelector("#toast"),
};

init();

async function init() {
  const hasAccessGate = bindAccessGate();
  if (!hasAccessGate) {
    startBoard();
    return;
  }

  if (!(await hasBoardAccess())) {
    lockBoard();
    return;
  }

  unlockBoard();
  startBoard();
}

function startBoard() {
  if (boardStarted) return;
  boardStarted = true;
  populateSelects();
  bindEvents();
  render();
  updateClock();
  window.setInterval(updateClock, 1000);
  initRemoteSync();
}

function bindAccessGate() {
  if (!els.accessForm || !els.accessCode || !els.accessError) {
    return false;
  }

  els.accessForm.addEventListener("submit", handleAccessSubmit);
  return true;
}

async function handleAccessSubmit(event) {
  event.preventDefault();
  const code = els.accessCode.value.trim();
  if (code === ACCESS_CODE) {
    localStorage.setItem(ACCESS_STORAGE_KEY, ACCESS_CODE_HASH);
    els.accessError.textContent = "";
    unlockBoard();
    startBoard();
    return;
  }

  const hash = await hashText(code);
  if (hash !== ACCESS_CODE_HASH) {
    els.accessError.textContent = "口令不正确";
    els.accessCode.select();
    return;
  }

  localStorage.setItem(ACCESS_STORAGE_KEY, hash);
  els.accessError.textContent = "";
  unlockBoard();
  startBoard();
}

async function hasBoardAccess() {
  return localStorage.getItem(ACCESS_STORAGE_KEY) === ACCESS_CODE_HASH;
}

function lockBoard() {
  document.body.classList.add("is-auth-locked");
  window.setTimeout(() => els.accessCode.focus(), 40);
}

function unlockBoard() {
  document.body.classList.remove("is-auth-locked");
}

async function hashText(value) {
  if (!window.crypto?.subtle) return value === "design2026" ? ACCESS_CODE_HASH : value;
  const bytes = new TextEncoder().encode(value);
  const buffer = await window.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bindEvents() {
  els.prevMonth.addEventListener("click", () => navigatePeriod(-1));
  els.nextMonth.addEventListener("click", () => navigatePeriod(1));
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

  els.openTaskForm.addEventListener("click", () => openDrawer());
  els.closeDrawer.addEventListener("click", closeDrawer);
  els.cancelForm.addEventListener("click", closeDrawer);

  els.drawer.addEventListener("click", (event) => {
    if (event.target === els.drawer) closeDrawer();
  });

  els.taskForm.addEventListener("submit", handleSubmit);
  els.deleteTask.addEventListener("click", deleteCurrentTask);
  els.exportTasks.addEventListener("click", exportTasks);
  els.importTasks.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importTasks);

  els.boardBody.addEventListener("dragover", (event) => {
    if (!dragTaskId || state.viewMode !== "week") return;
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
      hideContextMenu();
    }
  });

  document.addEventListener("pointermove", handleResizeMove);
  document.addEventListener("pointerup", handleResizeEnd);

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const nextTasks = safeParse(event.newValue, state.tasks);
    state.tasks = Array.isArray(nextTasks) ? nextTasks.map(normalizeTask).filter(Boolean) : state.tasks;
    render();
  });

  if (channel) {
    channel.addEventListener("message", (event) => {
      if (event.data?.type !== "tasks-updated") return;
      state.tasks = Array.isArray(event.data.tasks) ? event.data.tasks.map(normalizeTask).filter(Boolean) : state.tasks;
      persist(false);
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
}

function initRemoteSync() {
  const isConfigured = Boolean(supabaseConfig.enabled && supabaseConfig.url && supabaseConfig.anonKey);
  if (!isConfigured) return;

  connectRemoteSync();
}

async function connectRemoteSync() {
  try {
    showToast("正在连接共享任务表");
    const { createClient } = await import(SUPABASE_CLIENT_URL);
    remoteClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    await loadRemoteTasks();
    subscribeRemoteTasks();
    showToast("共享任务表已连接");
  } catch (error) {
    console.error(error);
    showToast("共享任务表未就绪，暂用本地模式");
  }
}

async function loadRemoteTasks() {
  if (!remoteClient) return;

  const { data, error } = await remoteClient
    .from("design_tasks")
    .select("*")
    .order("start_date", { ascending: true })
    .order("lane", { ascending: true });

  if (error) throw error;

  if (Array.isArray(data) && data.length) {
    state.tasks = data.map(remoteRowToTask).map(normalizeTask).filter(Boolean);
    persist(false);
    render();
    return;
  }

  await upsertRemoteTasks(state.tasks.length ? state.tasks : seedTasks);
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
  if (!remoteClient) return;

  const { error } = await remoteClient
    .from("design_tasks")
    .upsert(taskToRemoteRow(task), { onConflict: "id" });

  if (error) {
    console.error(error);
    showToast("任务已本地保存，共享同步失败");
  }
}

async function deleteTaskFromRemote(id) {
  if (!remoteClient) return;

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
  if (!remoteClient || !tasks.length) return;

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
  renderWeekHeader(period.days);
  renderWeekGrid(period.days);
  renderWeekTasks(period);
}

function renderWeekHeader(weekDays) {
  const today = toISODate(new Date());
  const visibleTasks = getVisibleTasks(periodFromDays(weekDays));
  els.boardHeader.innerHTML = weekDays
    .map((date) => {
      const iso = toISODate(date);
      const dayTasks = visibleTasks.filter((task) => dateInRange(iso, task.start, task.end));
      return `
        <div class="day-head ${iso === today ? "is-today" : ""}">
          <div class="weekday"><span>${weekdayText(date)}</span><b>${formatShortDate(date)}</b></div>
          <span class="day-count">${dayTasks.length} 项</span>
        </div>
      `;
    })
    .join("");
}

function renderWeekGrid(weekDays) {
  const today = toISODate(new Date());
  const weekDates = weekDays.map(toISODate);
  const cells = [];
  for (let lane = 1; lane <= laneCount; lane += 1) {
    for (let day = 0; day < 7; day += 1) {
      cells.push(
        `<div class="grid-cell ${weekDates[day] === today ? "is-today-cell" : ""}" data-day="${day}" data-lane="${lane}"></div>`,
      );
    }
  }
  els.boardGrid.innerHTML = cells.join("");
}

function renderWeekTasks(period) {
  const tasks = getVisibleTasks(period);

  if (!tasks.length) {
    els.taskGrid.innerHTML = `<div class="empty-state">本周暂无匹配任务</div>`;
    return;
  }

  els.taskGrid.innerHTML = tasks.map((task) => renderWeekTask(task, period.days)).join("");

  els.taskGrid.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", () => openDrawer(card.dataset.id));
    card.addEventListener("dblclick", (event) => event.stopPropagation());
    card.addEventListener("dragstart", (event) => {
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

  els.taskGrid.querySelectorAll(".resize-handle").forEach((handle) => {
    handle.addEventListener("click", (event) => event.stopPropagation());
    handle.addEventListener("pointerdown", startResize);
  });
}

function renderWeekTask(task, weekDays) {
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
      draggable="true"
      data-id="${task.id}"
      style="grid-column: ${startIndex + 1} / span ${duration}; grid-row: ${task.lane};"
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

  els.taskGrid.innerHTML = period.days
    .map((date) => {
      const iso = toISODate(date);
      const dayTasks = visibleTasks
        .filter((task) => dateInRange(iso, task.start, task.end))
        .sort((a, b) => a.lane - b.lane || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
      const taskMarkup = dayTasks
        .map((task) => renderMonthTask(task))
        .join("");

      return `
        <section
          class="month-cell ${date.getMonth() !== activeMonth ? "is-outside-month" : ""} ${iso === today ? "is-today" : ""}"
          data-date="${iso}"
          data-lane="1"
        >
          <div class="month-date">
            <strong>${date.getDate()}</strong>
            <span>${dayTasks.length ? `${dayTasks.length} 项` : ""}</span>
          </div>
          <div class="month-tasks">${taskMarkup}</div>
        </section>
      `;
    })
    .join("");

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
  return `
    <button class="month-task tone-${tone} is-${task.status}" data-id="${task.id}" type="button" title="${escapeHtml(task.title)}">
      <span>${owner.name}</span>
      <b>${escapeHtml(task.title)}</b>
    </button>
  `;
}

function renderMetrics(period) {
  const visibleTasks = getVisibleTasks(period);
  const today = toISODate(new Date());
  const open = visibleTasks.filter((task) => task.status === "open").length;
  const todayTasks = visibleTasks.filter((task) => dateInRange(today, task.start, task.end)).length;
  const done = visibleTasks.filter((task) => task.status === "done").length;
  const periodLabel = state.viewMode === "week" ? "本周任务" : "本月任务";

  els.metrics.innerHTML = [
    metric(periodLabel, visibleTasks.length),
    metric("未完成", open),
    metric("今日覆盖", todayTasks),
    metric("已完成", done),
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

async function handleSubmit(event) {
  event.preventDefault();

  const start = els.taskStart.value;
  const end = els.taskEnd.value;
  if (end < start) {
    showToast("结束日期不能早于开始日期");
    return;
  }

  const lane = clamp(Number(els.taskLane.value), 1, laneCount);
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
  showToast("任务已保存");
  await syncTaskToRemote(payload);
}

async function deleteCurrentTask() {
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
  const task = id ? state.tasks.find((item) => item.id === id) : null;
  const firstDay = toISODate(getWeekDays(state.weekStart)[0]);
  const defaultTask = {
    id: "",
    title: "",
    owner: owners[0].id,
    start: overrides.start || firstDay,
    end: overrides.end || overrides.start || firstDay,
    lane: overrides.lane || 1,
    tone: owners[0].tone,
    status: "open",
    note: "",
  };
  const data = task || defaultTask;

  els.drawerTitle.textContent = task ? "编辑任务" : "新增任务";
  els.taskId.value = data.id;
  els.taskTitle.value = data.title;
  els.taskOwner.value = data.owner;
  els.taskStatus.value = data.status;
  els.taskStart.value = data.start;
  els.taskEnd.value = data.end;
  els.taskLane.value = data.lane;
  els.taskNote.value = data.note || "";
  els.deleteTask.style.visibility = task ? "visible" : "hidden";

  els.drawer.classList.add("is-open");
  els.drawer.setAttribute("aria-hidden", "false");
  window.setTimeout(() => els.taskTitle.focus(), 40);
}

function closeDrawer() {
  els.drawer.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
}

function openDrawerFromBoard(event) {
  if (event.target.closest(".task-card")) return;
  const target = getBoardDateTarget(event);
  if (!target) return;
  openDrawer(null, {
    start: target.date,
    lane: target.lane,
  });
}

function openBoardContextMenu(event) {
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
  if (!dragTaskId || state.viewMode !== "week") return;
  event.preventDefault();
  const task = state.tasks.find((item) => item.id === dragTaskId);
  const cell = getCellFromPointer(event.clientX, event.clientY);
  if (!task || !cell) return;

  const duration = differenceInDays(parseISODate(task.start), parseISODate(task.end));
  const newStart = getWeekDays(state.weekStart)[cell.day];
  task.start = toISODate(newStart);
  task.end = toISODate(addDays(newStart, duration));
  task.lane = cell.lane;

  dragTaskId = null;
  clearCellHighlight();
  persist();
  render();
  showToast("任务已移动");
  syncTaskToRemote(task);
}

function startResize(event) {
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
  if (!resizeState) return;
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
  if (!resizeState) return;
  const task = state.tasks.find((item) => item.id === resizeState.id);
  resizeState = null;
  persist();
  showToast("任务日期已调整");
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  if (shouldBroadcast && channel) {
    channel.postMessage({ type: "tasks-updated", tasks: state.tasks });
  }
}

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return seedTasks;
  const parsed = safeParse(saved, seedTasks);
  return Array.isArray(parsed) ? parsed.map(normalizeTask).filter(Boolean) : seedTasks;
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
    lane: clamp(Number(task.lane || 1), 1, laneCount),
    tone: getOwner(owner).tone,
    status: normalizeStatus(task.status),
    note: String(task.note || "").slice(0, 160),
  };
}

function normalizeStatus(status) {
  return status === "done" ? "done" : "open";
}

function getCellFromPointer(x, y) {
  const rect = els.boardBody.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const day = clamp(Math.floor(((x - rect.left) / rect.width) * 7), 0, 6);
  const lane = clamp(Math.floor((y - rect.top) / Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-height"))) + 1, 1, laneCount);
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
  els.liveClock.textContent = `${formatFullDate(now)} · ${now.toLocaleTimeString("zh-CN", {
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
