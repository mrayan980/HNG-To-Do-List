const STORAGE_KEY = "taskpad-tasks";

const addForm = document.getElementById("add-form");
const newTitle = document.getElementById("new-title");
const newPriority = document.getElementById("new-priority");
const newDue = document.getElementById("new-due");
const searchInput = document.getElementById("search");
const filterButtons = document.querySelectorAll("[data-filter]");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty");
const summary = document.getElementById("summary");
const progressBar = document.getElementById("progress-bar");
const todayDate = document.getElementById("today-date");

const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("edit-form");
const editTitle = document.getElementById("edit-title");
const editPriority = document.getElementById("edit-priority");
const editDue = document.getElementById("edit-due");

let tasks = loadTasks();
let filter = "all";
let query = "";
let editingId = null;
const openNotes = new Set();

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage unavailable: the app still works for this session.
  }
}

function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(value) {
  return new Date(value + "T00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(task) {
  return !task.done && task.due && task.due < todayString();
}

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeButton(label, className, onClick) {
  const btn = makeEl("button", className, label);
  btn.type = "button";
  btn.addEventListener("click", onClick);
  return btn;
}

function matchesView(task) {
  if (filter === "active" && task.done) return false;
  if (filter === "done" && !task.done) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return task.title.toLowerCase().includes(q) || task.notes.toLowerCase().includes(q);
}

function buildTask(task) {
  const li = makeEl("li", `task priority-${task.priority}`);
  if (task.done) li.classList.add("done");
  if (isOverdue(task)) li.classList.add("overdue");

  const row = makeEl("div", "task-row");

  const check = makeEl("input");
  check.type = "checkbox";
  check.checked = task.done;
  check.setAttribute("aria-label", `Mark "${task.title}" as done`);
  check.addEventListener("change", () => {
    task.done = check.checked;
    saveTasks();
    render();
  });

  const body = makeEl("div", "task-body");
  const meta = makeEl("div", "task-meta");
  meta.append(makeEl("span", `chip chip-${task.priority}`, `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`));
  if (task.due) {
    const prefix = isOverdue(task) ? "Overdue since " : "Due ";
    meta.append(makeEl("span", "chip due", prefix + formatDate(task.due)));
  }
  body.append(makeEl("div", "task-title", task.title), meta);

  const actions = makeEl("div", "task-actions");
  const notesBtn = makeButton("Notes", task.notes ? "has-note" : "", () => {
    if (openNotes.has(task.id)) openNotes.delete(task.id);
    else openNotes.add(task.id);
    render();
  });
  notesBtn.setAttribute("aria-expanded", String(openNotes.has(task.id)));
  actions.append(
    notesBtn,
    makeButton("Edit", "", () => openEditor(task)),
    makeButton("Delete", "delete", () => {
      if (confirm(`Delete "${task.title}"?`)) {
        tasks = tasks.filter((t) => t.id !== task.id);
        openNotes.delete(task.id);
        saveTasks();
        render();
      }
    })
  );

  row.append(check, body, actions);
  li.append(row);

  if (openNotes.has(task.id)) {
    const area = makeEl("textarea", "notes");
    area.value = task.notes;
    area.placeholder = "Add a note for this task";
    area.setAttribute("aria-label", `Notes for "${task.title}"`);
    area.addEventListener("input", () => {
      task.notes = area.value;
      notesBtn.classList.toggle("has-note", task.notes.length > 0);
      saveTasks();
    });
    li.append(area);
  }

  return li;
}

function render() {
  const visible = tasks.filter(matchesView).sort((a, b) => Number(a.done) - Number(b.done));

  taskList.replaceChildren(...visible.map(buildTask));

  const remaining = tasks.filter((t) => !t.done).length;
  summary.textContent = tasks.length
    ? `${remaining} to do, ${tasks.length - remaining} done`
    : "Nothing here yet.";
  progressBar.style.width = tasks.length ? `${Math.round(((tasks.length - remaining) / tasks.length) * 100)}%` : "0%";

  if (visible.length === 0) {
    emptyMessage.hidden = false;
    emptyMessage.textContent = tasks.length
      ? "No tasks match this view. Try a different filter or search."
      : "Add your first task above to get started.";
  } else {
    emptyMessage.hidden = true;
  }
}

function openEditor(task) {
  editingId = task.id;
  editTitle.value = task.title;
  editPriority.value = task.priority;
  editDue.value = task.due;
  editDialog.showModal();
  editTitle.focus();
}

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = newTitle.value.trim();
  if (!title) return;
  tasks.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title,
    priority: newPriority.value,
    due: newDue.value,
    notes: "",
    done: false,
  });
  saveTasks();
  addForm.reset();
  newPriority.value = "medium";
  render();
  newTitle.focus();
});

editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const task = tasks.find((t) => t.id === editingId);
  const title = editTitle.value.trim();
  if (task && title) {
    task.title = title;
    task.priority = editPriority.value;
    task.due = editDue.value;
    saveTasks();
    render();
  }
  editDialog.close();
});

document.getElementById("edit-cancel").addEventListener("click", () => editDialog.close());

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  render();
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    filterButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  });
});

todayDate.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
render();
