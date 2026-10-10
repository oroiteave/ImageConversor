const worker = new Worker("worker.js", { type: "module" });

const dropzone = document.getElementById("dropzone");
const dropzoneText = document.getElementById("dropzone-text");
const fileInput = document.getElementById("file-input");
const qualityInput = document.getElementById("quality");
const qualityValue = document.getElementById("quality-value");
const widthInput = document.getElementById("width");
const results = document.getElementById("results");
const fileList = document.getElementById("file-list");
const summary = document.getElementById("summary");
const downloadAllBtn = document.getElementById("download-all");
const clearBtn = document.getElementById("clear");
const itemTemplate = document.getElementById("file-item");

const IDLE_TEXT = "Arrastra imágenes aquí o haz clic para elegir";

let ready = false;
let nextId = 0;
const items = new Map(); // id -> { name, outName, size, el, result?, url?, error? }

// --- Utilidades -----------------------------------------------------------

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function savingPercent(before, after) {
  return Math.round(100 - (after * 100) / before);
}

function uniqueOutputName(filename) {
  const base = filename.replace(/\.[^.]+$/, "") || "imagen";
  const taken = new Set([...items.values()].map((item) => item.outName));
  let name = `${base}.webp`;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}.webp`;
  return name;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Estado de la interfaz ------------------------------------------------

function updateSummary() {
  const all = [...items.values()];
  const done = all.filter((item) => item.result);
  const pending = all.filter((item) => !item.result && !item.error).length;

  results.hidden = all.length === 0;
  downloadAllBtn.disabled = done.length === 0 || pending > 0;

  if (pending > 0) {
    summary.textContent = `Convirtiendo ${all.length - pending + 1} de ${all.length}…`;
    return;
  }
  if (done.length === 0) {
    summary.textContent = "";
    return;
  }
  const before = done.reduce((sum, item) => sum + item.size, 0);
  const after = done.reduce((sum, item) => sum + item.result.size, 0);
  summary.innerHTML = `${done.length} ${done.length === 1 ? "imagen" : "imágenes"} · ${formatSize(before)} → ${formatSize(after)} <strong>−${savingPercent(before, after)}%</strong>`;
}

function addFile(file) {
  const id = nextId++;
  const el = itemTemplate.content.firstElementChild.cloneNode(true);
  el.classList.add("is-pending");
  el.querySelector(".file-name").textContent = file.name;
  el.querySelector(".file-meta").textContent = `${formatSize(file.size)} · en cola`;
  fileList.append(el);

  items.set(id, { name: file.name, outName: uniqueOutputName(file.name), size: file.size, el });
  updateSummary();

  file.arrayBuffer().then((buffer) => {
    worker.postMessage(
      {
        type: "convert",
        id,
        buffer,
        quality: Number(qualityInput.value),
        width: Number(widthInput.value) || 1280,
      },
      [buffer]
    );
  });
}

function handleFiles(fileListLike) {
  if (!ready) return;
  for (const file of fileListLike) addFile(file);
}

// --- Mensajes del worker --------------------------------------------------

worker.onmessage = ({ data: msg }) => {
  if (msg.type === "ready") {
    ready = true;
    dropzone.classList.remove("is-loading");
    dropzoneText.textContent = IDLE_TEXT;
    return;
  }

  if (msg.type === "fatal") {
    dropzoneText.textContent = "No se pudo cargar el motor de conversión. Recarga la página.";
    console.error(msg.error);
    return;
  }

  // Respuesta (o error) de "Descargar todo": no lleva id
  if (msg.type === "zipped" || (msg.type === "error" && msg.id === undefined)) {
    if (msg.type === "zipped") {
      downloadBlob(new Blob([msg.buffer], { type: "application/zip" }), "imagenes_webp.zip");
    } else {
      console.error(msg.error);
    }
    downloadAllBtn.textContent = "Descargar todo (.zip)";
    updateSummary();
    return;
  }

  const item = items.get(msg.id);
  if (!item) return; // la lista se limpió mientras se convertía

  item.el.classList.remove("is-pending");
  const meta = item.el.querySelector(".file-meta");

  if (msg.type === "error") {
    item.error = msg.error;
    item.el.classList.add("is-error");
    meta.textContent = `Error: ${msg.error}`;
  } else if (msg.type === "converted") {
    item.result = new Blob([msg.buffer], { type: "image/webp" });
    item.url = URL.createObjectURL(item.result);

    item.el.querySelector(".thumb").style.backgroundImage = `url("${item.url}")`;
    meta.innerHTML = `${formatSize(item.size)} → ${formatSize(item.result.size)} <span class="saving">−${savingPercent(item.size, item.result.size)}%</span>`;

    const link = item.el.querySelector(".file-download");
    link.href = item.url;
    link.download = item.outName;
    link.hidden = false;
  }

  updateSummary();
};

worker.onerror = (e) => {
  dropzoneText.textContent = "No se pudo cargar el motor de conversión. Recarga la página.";
  console.error("Error en el worker:", e.message || e);
};

// --- Eventos --------------------------------------------------------------

qualityInput.addEventListener("input", () => {
  qualityValue.textContent = qualityInput.value;
});

fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});

dropzone.addEventListener("click", (e) => {
  if (!ready) e.preventDefault();
});

dropzone.addEventListener("keydown", (e) => {
  if (ready && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    fileInput.click();
  }
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (ready) dropzone.classList.add("is-dragging");
});

dropzone.addEventListener("dragleave", (e) => {
  if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove("is-dragging");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-dragging");
  handleFiles(e.dataTransfer.files);
});

// Evitar que el navegador abra la imagen si se suelta fuera de la caja
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

downloadAllBtn.addEventListener("click", async () => {
  const done = [...items.values()].filter((item) => item.result);
  if (done.length === 0) return;

  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "Preparando…";
  const buffers = await Promise.all(done.map((item) => item.result.arrayBuffer()));
  worker.postMessage({ type: "zip", names: done.map((item) => item.outName), buffers }, buffers);
});

clearBtn.addEventListener("click", () => {
  for (const item of items.values()) {
    if (item.url) URL.revokeObjectURL(item.url);
  }
  items.clear();
  fileList.replaceChildren();
  updateSummary();
});
