const STORAGE_KEY = "hanshin-tigers-log.entries.v1";

const results = {
  win: {
    label: "勝ち",
    icon: "🐯",
  },
  loss: {
    label: "負け",
    icon: "😣",
  },
  draw: {
    label: "引き分け",
    icon: "🤝",
  },
  "no-game": {
    label: "試合なし",
    icon: "⚾",
  },
  cancelled: {
    label: "中止",
    icon: "🌧️",
  },
};

const form = document.querySelector("#diary-form");
const dateInput = document.querySelector("#entry-date");
const noteInput = document.querySelector("#entry-note");
const clearButton = document.querySelector("#clear-button");
const entryList = document.querySelector("#entry-list");
const emptyState = document.querySelector("#empty-state");
const saveState = document.querySelector("#save-state");
const charCount = document.querySelector("#char-count");
const editingLabel = document.querySelector("#editing-label");
const entryCount = document.querySelector("#entry-count");
const summaryRow = document.querySelector("#summary-row");
const searchInput = document.querySelector("#search-input");
const resultFilter = document.querySelector("#result-filter");

let entries = loadEntries();

function loadEntries() {
  const rawEntries = localStorage.getItem(STORAGE_KEY);

  if (!rawEntries) {
    return [];
  }

  try {
    const parsedEntries = JSON.parse(rawEntries);
    return Array.isArray(parsedEntries) ? parsedEntries : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function getTodayIso() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function parseIsoDate(dateText) {
  return new Date(`${dateText}T00:00:00`);
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortEntries() {
  entries.sort((a, b) => b.date.localeCompare(a.date));
}

function getSelectedResult() {
  return form.elements.result.value;
}

function setSelectedResult(result) {
  const resultInput = form.querySelector(`input[name="result"][value="${result}"]`);

  if (resultInput) {
    resultInput.checked = true;
  }
}

function clearSelectedResult() {
  form.querySelectorAll('input[name="result"]').forEach((input) => {
    input.checked = false;
  });
}

function formatDate(dateText) {
  const date = parseIsoDate(dateText);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredEntries() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedResult = resultFilter.value;

  return entries.filter((entry) => {
    const result = results[entry.result];
    const matchesResult = selectedResult === "all" || entry.result === selectedResult;
    const searchableText = `${entry.date} ${entry.note} ${result?.label ?? ""}`.toLowerCase();
    const matchesQuery = !query || searchableText.includes(query);

    return matchesResult && matchesQuery;
  });
}

function renderEntries() {
  const filteredEntries = getFilteredEntries();

  entryList.innerHTML = filteredEntries
    .map((entry) => {
      const result = results[entry.result] ?? { label: "不明", icon: "⚾" };

      return `
        <li class="entry-card">
          <div class="entry-topline">
            <span class="entry-date">${formatDate(entry.date)}</span>
            <span class="result-badge">${result.icon} ${result.label}</span>
          </div>
          <p class="entry-note">${escapeHtml(entry.note)}</p>
          <div class="entry-actions">
            <button type="button" data-action="edit" data-date="${entry.date}">編集</button>
            <button class="danger-button" type="button" data-action="delete" data-date="${entry.date}">削除</button>
          </div>
        </li>
      `;
    })
    .join("");

  if (entries.length > 0 && filteredEntries.length === 0) {
    emptyState.innerHTML = `
      <strong>条件に合う記録がありません</strong>
      <span>検索ワードや結果フィルターを変えてみてください。</span>
    `;
  } else {
    emptyState.innerHTML = `
      <strong>まだ記録がありません</strong>
      <span>今日の試合結果とメモを保存すると、ここに表示されます。</span>
    `;
  }

  emptyState.hidden = filteredEntries.length > 0;
  entryList.hidden = filteredEntries.length === 0;
}

function renderSummary() {
  entryCount.textContent = entries.length;

  summaryRow.innerHTML = Object.entries(results)
    .map(([resultKey, result]) => {
      const count = entries.filter((entry) => entry.result === resultKey).length;
      return `<span class="summary-chip">${result.icon} ${result.label} ${count}</span>`;
    })
    .join("");
}

function render() {
  sortEntries();
  renderSummary();
  renderEntries();
}

function resetForm() {
  form.reset();
  dateInput.value = getTodayIso();
  clearSelectedResult();
  noteInput.value = "";
  editingLabel.textContent = "今日の記録を書いています";
  updateCharCount();
  updateSaveState("未保存");
}

function updateCharCount() {
  charCount.textContent = noteInput.value.length;
}

function updateSaveState(text) {
  saveState.textContent = text;
}

function loadEntryIntoForm(entry) {
  dateInput.value = entry.date;
  setSelectedResult(entry.result);
  noteInput.value = entry.note;
  editingLabel.textContent = `${formatDate(entry.date)}の記録を編集中`;
  updateCharCount();
  updateSaveState("編集中");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const result = getSelectedResult();
  const note = noteInput.value.trim();

  if (!date || !result || !note) {
    updateSaveState("入力を確認");
    return;
  }

  const existingIndex = entries.findIndex((entry) => entry.date === date);
  const now = new Date().toISOString();
  const nextEntry = {
    id: existingIndex >= 0 ? entries[existingIndex].id : createId(),
    date,
    result,
    note,
    createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    entries[existingIndex] = nextEntry;
  } else {
    entries.push(nextEntry);
  }

  saveEntries();
  render();
  loadEntryIntoForm(nextEntry);
  updateSaveState("保存済み");
});

dateInput.addEventListener("change", () => {
  if (!dateInput.value) {
    return;
  }

  const existingEntry = entries.find((entry) => entry.date === dateInput.value);

  if (existingEntry) {
    loadEntryIntoForm(existingEntry);
    return;
  }

  clearSelectedResult();
  noteInput.value = "";
  editingLabel.textContent = `${formatDate(dateInput.value)}の記録を書いています`;
  updateCharCount();
  updateSaveState("未保存");
});

noteInput.addEventListener("input", () => {
  updateCharCount();
  updateSaveState("編集中");
});

form.querySelector("#result-grid").addEventListener("change", () => {
  updateSaveState("編集中");
});

clearButton.addEventListener("click", () => {
  resetForm();
});

entryList.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const entryDate = button.dataset.date;
  const entry = entries.find((item) => item.date === entryDate);

  if (!entry) {
    return;
  }

  if (button.dataset.action === "edit") {
    loadEntryIntoForm(entry);
    document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (button.dataset.action === "delete") {
    const shouldDelete = confirm(`${formatDate(entry.date)}の記録を削除しますか？`);

    if (!shouldDelete) {
      return;
    }

    entries = entries.filter((item) => item.date !== entry.date);
    saveEntries();
    render();
    resetForm();
  }
});

searchInput.addEventListener("input", renderEntries);
resultFilter.addEventListener("change", renderEntries);

dateInput.value = getTodayIso();
updateCharCount();
render();
