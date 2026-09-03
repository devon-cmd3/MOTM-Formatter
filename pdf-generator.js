const MOTM_COLORS = {
    textPrimary: [29, 29, 31],
    textSecondary: [110, 110, 115],
    border: [60, 60, 60],
    headerFill: [237, 240, 245],
    gBlue: [66, 133, 244],
    gRed: [234, 67, 53],
    gYellow: [251, 188, 5],
    gGreen: [52, 168, 83],
};

const MOTM_LOGO_SRC = "logo2.png";
const MOTM_LOGO_MAX = { width: 130, height: 56 };

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Could not load ${src}`));
        img.src = src;
    });
}

const MOTM_LAYOUT = {
    margin: 42,
    labelCol: 150,
    cellPad: 8,
    lineLead: 13,
    rowMinH: 24,
};

async function generateMotmPdf(payload, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const M = MOTM_LAYOUT.margin;
    const contentWidth = pageWidth - M * 2;
    const contentTop = M;
    const contentBottom = pageHeight - M;

    const state = { y: contentTop };

    // preload the org logo. if it's missing, just carry on without it
    let logoImg = null;
    try {
        logoImg = await loadImageElement(MOTM_LOGO_SRC);
    } catch (err) {
        console.warn("MOTM logo not loaded, generating without it:", err.message);
    }

    // preload natural dimensions for any attached images
    // needed to keep available ratio
    const images = await Promise.all(
        (payload.images || []).map(
        (img) =>
            new Promise((resolve) => {
            const el = new Image();
            el.onload = () => resolve({ ...img, width: el.naturalWidth, height: el.naturalHeight });
            el.onerror = () => resolve({ ...img, width: 0, height: 0 });
            el.src = img.dataUrl;
            })
        )
    );

    function ensureSpace(needed) {
        if (state.y + needed > contentBottom) {
            doc.addPage();
            state.y = contentTop;
        }
    }

    function text(str, x, y, style, size, color) {
        doc.setFont("helvetica", style || "normal");
        doc.setFontSize(size || 10);
        doc.setTextColor(...(color || MOTM_COLORS.textPrimary));
        doc.text(str || "", x, y);
    }

    function wrap(str, maxWidth, style, size) {
        if (!str) return [];
        doc.setFont("helvetica", style || "normal");
        doc.setFontSize(size || 10);
        return doc.splitTextToSize(str, maxWidth);
    }

    function textWidth(str, style, size) {
        doc.setFont("helvetica", style || "normal");
        doc.setFontSize(size || 10);
        return doc.getTextWidth(str);
    }

    function hLine(x1, x2, y, width, color) {
        doc.setDrawColor(...(color || MOTM_COLORS.border));
        doc.setLineWidth(width || 0.75);
        doc.line(x1, y, x2, y);
    }

    function strokeRect(x, top, w, h, width, color) {
        doc.setDrawColor(...(color || MOTM_COLORS.border));
        doc.setLineWidth(width || 0.75);
        doc.rect(x, top, w, h, "S");
    }

    function fillRect(x, top, w, h, color) {
        doc.setFillColor(...color);
        doc.rect(x, top, w, h, "F");
    }

    function orNone(s) {
        return s && s.trim() ? s : "None";
    }

    function drawGoogleWord(x, baselineY, size) {
        const word = "Google";
        const colors = [MOTM_COLORS.gBlue, MOTM_COLORS.gRed, MOTM_COLORS.gYellow, MOTM_COLORS.gBlue, MOTM_COLORS.gGreen, MOTM_COLORS.gRed];
        let cursor = x;
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            text(letter, cursor, baselineY, "bold", size, colors[i % colors.length]);
            cursor += textWidth(letter, "bold", size);
        }
        return cursor;
    }

    function drawLetterhead(full) {
        const x = M;
        const topY = state.y;

        if (logoImg) {
            const dims = scaledDims(logoImg.naturalWidth, logoImg.naturalHeight, MOTM_LOGO_MAX.width, MOTM_LOGO_MAX.height);
            if (dims.w) {
                doc.addImage(logoImg, "PNG", pageWidth - M - dims.w, topY - 4, dims.w, dims.h);
            }
        }

        drawGoogleWord(x, topY + 12, 15);
        const googleWidth = textWidth("Google", "bold", 15);
        text(" Developer Groups", x + googleWidth, topY + 12, "bold", 15, MOTM_COLORS.textPrimary);

        text("On Campus Xavier Ateneo", x, topY + 32, "bold", 15, MOTM_COLORS.textPrimary);

        if (full) {
            text(
                "Xavier University - Ateneo de Cagayan Corrales Ave., Cagayan de Oro City",
                x,
                topY + 48,
                "normal",
                9,
                MOTM_COLORS.textSecondary
            );
            state.y = topY + 62;
        } else {
            state.y = topY + 42;
        }

        hLine(M, pageWidth - M, state.y, 0.75, MOTM_COLORS.border);
        state.y += 14;
    }

    function drawTitle() {
        const title = "MINUTES OF THE MEETING";
        const size = 15;
        const w = textWidth(title, "bold", size);
        const x = M + (contentWidth - w) / 2;
        state.y += 12;
        text(title, x, state.y, "bold", size, MOTM_COLORS.textPrimary);
        hLine(x, x + w, state.y + 3, 1, MOTM_COLORS.textPrimary);
        state.y += 22;
    }

    // meeting detail table
    function drawRow(label, valueLines) {
        const valueColWidth = contentWidth - MOTM_LAYOUT.labelCol;
        const lines = valueLines.length ? valueLines : [""];
        const rowHeight = Math.max(MOTM_LAYOUT.rowMinH, lines.length * MOTM_LAYOUT.lineLead + MOTM_LAYOUT.cellPad * 2);

        ensureSpace(rowHeight);
        const top = state.y;
        const labelX = M;
        const valueX = labelX + MOTM_LAYOUT.labelCol;

        strokeRect(labelX, top, MOTM_LAYOUT.labelCol, rowHeight);
        strokeRect(valueX, top, valueColWidth, rowHeight);

        text(label, labelX + MOTM_LAYOUT.cellPad, top + 15, "bold", 10, MOTM_COLORS.textPrimary);

        let lineY = top + 15;
        for (const line of lines) {
            text(line, valueX + MOTM_LAYOUT.cellPad, lineY, "normal", 10, MOTM_COLORS.textPrimary);
            lineY += MOTM_LAYOUT.lineLead;
        }

        state.y = top + rowHeight;
    }

    function drawDateTimeRow() {
        const valueColWidth = contentWidth - MOTM_LAYOUT.labelCol;
        const rowHeight = MOTM_LAYOUT.rowMinH;
        ensureSpace(rowHeight);

        const top = state.y;
        const labelX = M;
        const valueX = labelX + MOTM_LAYOUT.labelCol;
        const dateColWidth = valueColWidth * 0.62;
        const timeColWidth = valueColWidth * 0.38;

        strokeRect(labelX, top, MOTM_LAYOUT.labelCol, rowHeight);
        strokeRect(valueX, top, dateColWidth, rowHeight);
        strokeRect(valueX + dateColWidth, top, timeColWidth, rowHeight);

        text("Date", labelX + MOTM_LAYOUT.cellPad, top + 15, "bold", 10, MOTM_COLORS.textPrimary);
        text(payload.meetingDate, valueX + MOTM_LAYOUT.cellPad, top + 15, "normal", 10, MOTM_COLORS.textPrimary);
        text(
        "Time: " + payload.meetingTime,
        valueX + dateColWidth + MOTM_LAYOUT.cellPad,
        top + 15,
        "normal",
        10,
        MOTM_COLORS.textPrimary
        );

        state.y = top + rowHeight;
    }

    function drawMeetingDetailsTable() {
        const valueColWidth = contentWidth - MOTM_LAYOUT.labelCol;

        drawRow("Meeting Title / Subject", wrap(payload.meetingTitle, valueColWidth - MOTM_LAYOUT.cellPad * 2));
        drawDateTimeRow();
        drawRow("Mode / Location", wrap(payload.modeLocation, valueColWidth - MOTM_LAYOUT.cellPad * 2));
        drawRow("Attendees", wrap(orNone(payload.attendees), valueColWidth - MOTM_LAYOUT.cellPad * 2));
        drawRow("Absentees", wrap(orNone(payload.absentees), valueColWidth - MOTM_LAYOUT.cellPad * 2));
        drawRow("Roles", [`Facilitator : ${payload.facilitator}`, `Note Taker : ${payload.noteTaker}`]);
        drawRow("Time Allotted", wrap(payload.timeAllotted, valueColWidth - MOTM_LAYOUT.cellPad * 2));

        state.y += 16;
    }

    function drawSectionHeaderBar(label) {
        const h = 22;
        ensureSpace(h);
        const top = state.y;
        strokeRect(M, top, contentWidth, h);
        text(label, M + MOTM_LAYOUT.cellPad, top + 15, "bold", 11, MOTM_COLORS.textPrimary);
        state.y = top + h;
    }

    function drawDiscussion() {
        drawSectionHeaderBar("Discussion");

        const lines = wrap(orNone(payload.discussion), contentWidth - MOTM_LAYOUT.cellPad * 2);
        const boxHeight = Math.max(70, lines.length * MOTM_LAYOUT.lineLead + MOTM_LAYOUT.cellPad * 2);
        const pageUsableHeight = contentBottom - contentTop;

        if (boxHeight <= pageUsableHeight) {
            ensureSpace(boxHeight);
            const top = state.y;
            strokeRect(M, top, contentWidth, boxHeight);

            let lineY = top + 14;
            for (const line of lines) {
                text(line, M + MOTM_LAYOUT.cellPad, lineY, "normal", 10, MOTM_COLORS.textPrimary);
                lineY += MOTM_LAYOUT.lineLead;
            }
            state.y = top + boxHeight;
        } else { // very long discussion: flow across pages without a fixed-height border
            state.y += 4;
            for (const line of lines) {
                ensureSpace(MOTM_LAYOUT.lineLead);
                state.y += MOTM_LAYOUT.lineLead * 0.8;
                text(line, M + MOTM_LAYOUT.cellPad, state.y, "normal", 10, MOTM_COLORS.textPrimary);
                state.y += MOTM_LAYOUT.lineLead * 0.2;
            }
        }

        state.y += 16;
    }

    // action items
    function drawActionHeaderRow(widths, headers) {
        const h = MOTM_LAYOUT.rowMinH;
        ensureSpace(h);
        const top = state.y;
        let x = M;

        fillRect(M, top, contentWidth, h, MOTM_COLORS.headerFill);
        for (let i = 0; i < widths.length; i++) {
            strokeRect(x, top, widths[i], h);
            text(headers[i], x + MOTM_LAYOUT.cellPad, top + 15, "bold", 9.5, MOTM_COLORS.textPrimary);
            x += widths[i];
        }
        state.y = top + h;
    }

    function drawActionRow(widths, cols) {
        const maxLines = Math.max(...cols.map((c) => c.length || 1));
        const rowHeight = Math.max(MOTM_LAYOUT.rowMinH, maxLines * MOTM_LAYOUT.lineLead + MOTM_LAYOUT.cellPad * 2);

        ensureSpace(rowHeight);
        const top = state.y;
        let x = M;

        for (let i = 0; i < widths.length; i++) {
            strokeRect(x, top, widths[i], rowHeight);
            let lineY = top + 15;
            for (const line of cols[i]) {
                text(line, x + MOTM_LAYOUT.cellPad, lineY, "normal", 9.5, MOTM_COLORS.textPrimary);
                lineY += MOTM_LAYOUT.lineLead;
            }
            x += widths[i];
        }
        state.y = top + rowHeight;
    }

    function drawActionItems() {
        drawSectionHeaderBar("Action Items");

        const widths = [contentWidth * 0.36, contentWidth * 0.24, contentWidth * 0.16, contentWidth * 0.24];
        const headers = ["Task", "Person Responsible", "Due Date", "Status"];

        drawActionHeaderRow(widths, headers);

        const items = payload.actionItems || [];
        if (!items.length) {
            drawActionRow(widths, [["No action items recorded."], [""], [""], [""]]);
            state.y += 16;
            return;
        }

        for (const item of items) {
            const taskLines = wrap(item.task, widths[0] - MOTM_LAYOUT.cellPad * 2);
            const personLines = wrap(item.person, widths[1] - MOTM_LAYOUT.cellPad * 2);
            const dateLines = wrap(item.dueDate, widths[2] - MOTM_LAYOUT.cellPad * 2);
            const statusLines = wrap(item.status, widths[3] - MOTM_LAYOUT.cellPad * 2);
            const cols = [taskLines, personLines, dateLines, statusLines];

            const maxLines = Math.max(...cols.map((c) => c.length || 1));
            const rowHeight = Math.max(MOTM_LAYOUT.rowMinH, maxLines * MOTM_LAYOUT.lineLead + MOTM_LAYOUT.cellPad * 2);

            if (state.y + rowHeight > contentBottom) {
                doc.addPage();
                state.y = contentTop;
                drawSectionHeaderBar("Action Items (continued)");
                drawActionHeaderRow(widths, headers);
            }

            drawActionRow(widths, cols);
        }

        state.y += 16;
    }

    // documentation
    function getImageFormat(dataUrl) {
        return dataUrl.indexOf("image/png") !== -1 ? "PNG" : "JPEG";
    }

    function scaledDims(natWidth, natHeight, maxWidth, maxHeight) {
        if (!natWidth || !natHeight) return { w: 0, h: 0 };
        const ratio = natWidth / natHeight;
        let w = maxWidth;
        let h = w / ratio;
        if (h > maxHeight) {
            h = maxHeight;
            w = h * ratio;
        }
        return { w, h };
    }

    function drawDocumentationPage() {
        doc.addPage();
        state.y = contentTop;
        drawLetterhead(true);

        drawSectionHeaderBar("Documentation (pictures/screenshots/photo opportunity)");
        state.y += 10;

        if (payload.documentationNotes) {
        const lines = wrap(payload.documentationNotes, contentWidth);
            for (const line of lines) {
                ensureSpace(MOTM_LAYOUT.lineLead);
                state.y += MOTM_LAYOUT.lineLead * 0.8;
                text(line, M, state.y, "normal", 10, MOTM_COLORS.textPrimary);
                state.y += MOTM_LAYOUT.lineLead * 0.2;
            }
            state.y += 10;
        }

        if (!images.length) {
            text("No images attached.", M, state.y + 12, "italic", 10, MOTM_COLORS.textSecondary);
            state.y += 20;
            return;
        }

        const gap = 14;
        const cellWidth = (contentWidth - gap) / 2;
        const maxImgHeight = 200;

        for (let i = 0; i < images.length; i += 2) {
            const left = images[i];
            const right = i + 1 < images.length ? images[i + 1] : null;

            const leftDims = scaledDims(left.width, left.height, cellWidth, maxImgHeight);
            const rightDims = right ? scaledDims(right.width, right.height, cellWidth, maxImgHeight) : { w: 0, h: 0 };

            const rowHeight = Math.max(leftDims.h, rightDims.h) + 8;
            ensureSpace(rowHeight);
            const top = state.y;

            if (leftDims.w) {
                doc.addImage(left.dataUrl, getImageFormat(left.dataUrl), M, top, leftDims.w, leftDims.h);
            }
            if (right && rightDims.w) {
                doc.addImage(right.dataUrl, getImageFormat(right.dataUrl), M + cellWidth + gap, top, rightDims.w, rightDims.h);
            }

            state.y = top + rowHeight;
        }
    }

    // assemble
    drawLetterhead(true);
    drawTitle();
    drawMeetingDetailsTable();
    drawDiscussion();
    drawActionItems();
    drawRow("Meeting Adjourned At", wrap(payload.adjournedAt, contentWidth - MOTM_LAYOUT.labelCol - MOTM_LAYOUT.cellPad * 2));
    drawDocumentationPage();
    doc.save(filename);
}