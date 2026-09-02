const MAX_IMAGES = 6;
const MAX_IMAGE_MB = 4;

const form = document.getElementById("motmForm");
const generateBtn = document.getElementById("generateBtn");
const statusPill = document.getElementById("statusPill");
const actionItemsList = document.getElementById("actionItemsList");
const addActionItemBtn = document.getElementById("addActionItem");
const actionItemTemplate = document.getElementById("actionItemTemplate");
const resetBtn = document.getElementById("resetBtn");
const uploadBtn = document.getElementById("uploadBtn");
const imageInput = document.getElementById("imageInput");
const imagePreviewList = document.getElementById("imagePreviewList");
const toastStack = document.getElementById("toastStack");

let attachedImages = []; // { name, dataUrl }

// action items
function addActionItemRow(prefill) {
    const node = actionItemTemplate.content.firstElementChild.cloneNode(true);
    actionItemsList.appendChild(node);

    if (prefill) {
        node.querySelector('[data-field="task"]').value = prefill.task || "";
        node.querySelector('[data-field="person"]').value = prefill.person || "";
        node.querySelector('[data-field="dueDate"]').value = prefill.dueDate || "";
        node.querySelector('[data-field="status"]').value = prefill.status || "Pending";
    }

    node.querySelector("[data-remove]").addEventListener("click", () => {
        node.remove();
        renumberActionItems();
    });

    renumberActionItems();
}

function renumberActionItems() {
    const rows = actionItemsList.querySelectorAll("[data-row]");
    rows.forEach((row, i) => {
        row.querySelector("[data-index]").textContent = i + 1;
    });
}

function collectActionItems() {
    const rows = actionItemsList.querySelectorAll("[data-row]");
    const items = [];
    rows.forEach((row) => {
        const task = row.querySelector('[data-field="task"]').value.trim();
        const person = row.querySelector('[data-field="person"]').value.trim();
        const dueDate = row.querySelector('[data-field="dueDate"]').value;
        const status = row.querySelector('[data-field="status"]').value;
        if (task || person || dueDate) {
        items.push({ task, person, dueDate, status });
        }
    });
    return items;
}

addActionItemBtn.addEventListener("click", () => addActionItemRow());

// upload documentations
uploadBtn.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
        if (attachedImages.length >= MAX_IMAGES) {
        showToast(`You can attach up to ${MAX_IMAGES} images.`, "error");
        break;
        }
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        showToast(`"${file.name}" is larger than ${MAX_IMAGE_MB}MB and was skipped.`, "error");
        continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        attachedImages.push({ name: file.name, dataUrl });
    }
    imageInput.value = "";
    renderImagePreviews();
});

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    imagePreviewList.innerHTML = "";
    attachedImages.forEach((img, i) => {
        const chip = document.createElement("div");
        chip.className = "image-chip";
        chip.innerHTML = `<img src="${img.dataUrl}" alt="${escapeHtml(img.name)}" /><button type="button" aria-label="Remove image">&times;</button>`;
        chip.querySelector("button").addEventListener("click", () => {
        attachedImages.splice(i, 1);
        renderImagePreviews();
        });
        imagePreviewList.appendChild(chip);
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// validation
function clearInvalid() {
    form.querySelectorAll(".field-invalid").forEach((el) => el.classList.remove("field-invalid"));
}

function markInvalid(el) {
    el.classList.add("field-invalid");
}

function validateForm(payload) {
    const errors = [];
    clearInvalid();

    const requiredFields = [
        ["meetingTitle", "Meeting title / subject"],
        ["meetingDate", "Date"],
        ["meetingTime", "Time"],
        ["modeLocation", "Mode / location"],
        ["attendees", "Attendees"],
        ["facilitator", "Facilitator"],
        ["noteTaker", "Note taker"],
        ["timeAllotted", "Time allotted"],
        ["discussion", "Discussion"],
        ["adjournedAt", "Meeting adjourned at"],
    ];

    requiredFields.forEach(([id, label]) => {
        const el = document.getElementById(id);
        if (!el.value || !el.value.trim()) {
        errors.push(`${label} is required.`);
        markInvalid(el);
        }
    });

    // action
    const rows = actionItemsList.querySelectorAll("[data-row]");
    rows.forEach((row, i) => {
        const task = row.querySelector('[data-field="task"]');
        const person = row.querySelector('[data-field="person"]');
        const dueDate = row.querySelector('[data-field="dueDate"]');
        const anyFilled = task.value.trim() || person.value.trim() || dueDate.value;
        if (anyFilled) {
        if (!task.value.trim()) { errors.push(`Action item ${i + 1}: task is required.`); markInvalid(task); }
        if (!person.value.trim()) { errors.push(`Action item ${i + 1}: person responsible is required.`); markInvalid(person); }
        if (!dueDate.value) { errors.push(`Action item ${i + 1}: due date is required.`); markInvalid(dueDate); }
        }
    });

    return errors;
}

function showToast(message, type = "info", detailList) {
    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
    let html = `<div>${escapeHtml(message)}</div>`;
    if (detailList && detailList.length) {
        html += `<ul>${detailList.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`;
    }
    toast.innerHTML = html;
    toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 7000);
}

function setStatus(text, type) {
    statusPill.hidden = !text;
    statusPill.textContent = text || "";
    statusPill.className = "status-pill" + (type ? ` ${type}` : "");
}

// submit

function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    generateBtn.querySelector(".btn-label").textContent = isLoading ? "Generating…" : "Generate PDF";
    const spinner = generateBtn.querySelector(".btn-spinner");
    if (spinner) spinner.hidden = !isLoading;
}

function buildPayload() {
    return {
        meetingTitle: document.getElementById("meetingTitle").value.trim(),
        meetingDate: document.getElementById("meetingDate").value,
        meetingTime: document.getElementById("meetingTime").value,
        modeLocation: document.getElementById("modeLocation").value.trim(),
        attendees: document.getElementById("attendees").value.trim(),
        absentees: document.getElementById("absentees").value.trim(),
        facilitator: document.getElementById("facilitator").value.trim(),
        noteTaker: document.getElementById("noteTaker").value.trim(),
        timeAllotted: document.getElementById("timeAllotted").value.trim(),
        discussion: document.getElementById("discussion").value.trim(),
        actionItems: collectActionItems(),
        adjournedAt: document.getElementById("adjournedAt").value,
        documentationNotes: document.getElementById("documentationNotes").value.trim(),
        images: attachedImages.map((img) => ({ name: img.name, dataUrl: img.dataUrl })),
    };
}

function filenameFor(payload) {
    const safeTitle = (payload.meetingTitle || "MOTM").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    const datePart = payload.meetingDate || "";
    return `MOTM_${safeTitle}${datePart ? "_" + datePart : ""}.pdf`;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = buildPayload();
    const errors = validateForm(payload);

    if (errors.length) {
        showToast("Please fix the following before generating the PDF:", "error", errors.slice(0, 6));
        return;
    }

    setLoading(true);
    setStatus("Generating…");

    try {
        await generateMotmPdf(payload, filenameFor(payload));
        setStatus("PDF ready", "success");
        showToast("Your MOTM PDF has been generated and downloaded.", "success");
    } catch (err) {
        console.error(err);
        setStatus("Failed", "error");
        showToast("Couldn't generate the PDF.", "error", [String(err.message || err)]);
    } finally {
        setLoading(false);
    }
});

resetBtn.addEventListener("click", () => {
    if (!confirm("Clear the whole form? This can't be undone.")) return;
    form.reset();
    actionItemsList.innerHTML = "";
    attachedImages = [];
    renderImagePreviews();
    clearInvalid();
    setStatus("");
    addActionItemRow();
});

// init
addActionItemRow();