import {
  parseAttentionCard,
  parseCheckExerciseTags,
} from './learningMaterialNotes';
import brandLogo from '../../pages/Logo tách nền.png';

/** URL tuyệt đối — cửa sổ in (about:blank) không resolve được đường dẫn tương đối */
const logoSrc =
  typeof window !== 'undefined'
    ? new URL(brandLogo, window.location.href).href
    : brandLogo;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatMultiline = (text?: string, emptyLabel = '—') => {
  if (!text?.trim()) return `<span class="empty">${emptyLabel}</span>`;
  return escapeHtml(text).replace(/\n/g, '<br/>');
};

const formatNumberedList = (text?: string, emptyLabel = '—') => {
  if (!text?.trim()) return `<span class="empty">${emptyLabel}</span>`;
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return `<span class="empty">${emptyLabel}</span>`;
  return lines
    .map(
      (line, i) =>
        `<div class="num-row"><span class="num">${i + 1}.</span><span>${escapeHtml(line.replace(/^\d+\.\s*/, ''))}</span></div>`
    )
    .join('');
};

const dottedLines = (count: number) =>
  Array.from({ length: count }, () => '<div class="dot-line"></div>').join('');

/* ── SVG icons (orange circle style) ── */
const ico = (svg: string) =>
  `<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>`;

const ICONS = {
  user: ico('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  id: ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4M7 12h6M7 16h3"/>'),
  book: ico('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  calendar: ico('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  calendarCheck: ico('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  attendance: ico('<circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>'),
  chart: ico('<path d="M3 3v18h18"/><path d="M7 16V9M12 16V5M17 16v-3"/>'),
  star: ico('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  clipboard: ico('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>'),
  bulb: ico('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>'),
  bookMark: ico('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M12 6v8M9 9l3-3 3 3"/>'),
  pencil: ico('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  family: ico('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
};

const sectionCard = (icon: string, title: string, body: string, extraClass = '') =>
  `<div class="card ${extraClass}">
    <div class="card-head">${icon}<span class="card-title">${title}</span></div>
    <div class="card-body">${body}</div>
  </div>`;

const infoField = (icon: string, label: string, value: string) =>
  `<div class="info-field">
    ${icon}
    <div><div class="info-label">${label}</div><div class="info-value">${value}</div></div>
  </div>`;

const BRAND_NAME = 'Lớp học thầy Công';

const renderSlipHeader = (title: string, subtitle?: string) => `
  <div class="header">
    <img src="${logoSrc}" alt="Chăm edu" class="header-logo" />
    <div class="header-text">
      <div class="brand">${BRAND_NAME}</div>
      <h1>${title}</h1>
      ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
    </div>
  </div>`;

const CHAMEDU_PRINT_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Times New Roman', Times, serif; }
  body {
    font-family: 'Times New Roman', Times, serif;
    color: #5c3d1e;
    background: #f5ebe0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .frame {
    position: relative;
    max-width: 720px;
    margin: 0 auto;
    background: #fffdf8;
    border: 2.5px solid #e8c99a;
    border-radius: 18px;
    padding: 18px 22px 22px;
    overflow: hidden;
  }

  /* honeycomb corners */
  .frame::before, .frame::after {
    content: '';
    position: absolute;
    width: 110px; height: 110px;
    opacity: 0.22;
    background-image: radial-gradient(circle, #e8a030 2.5px, transparent 2.5px);
    background-size: 16px 14px;
    pointer-events: none;
  }
  .frame::before { top: -8px; left: -8px; }
  .frame::after  { bottom: -8px; right: -8px; }

  .leaf-bl, .leaf-br {
    position: absolute; bottom: 6px; width: 56px; height: 56px; opacity: 0.3; pointer-events: none;
  }
  .leaf-bl { left: 6px; border-bottom: 3px solid #7cb342; border-left: 3px solid #7cb342; border-radius: 0 0 0 40px; }
  .leaf-br { right: 6px; border-bottom: 3px solid #7cb342; border-right: 3px solid #7cb342; border-radius: 0 0 40px 0; }

  /* ── header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
    text-align: left;
  }
  .header-logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .header-text { flex: 1; min-width: 0; }
  .header .brand {
    font-size: 13px;
    font-weight: 700;
    color: #c77712;
    letter-spacing: 0.2px;
    margin-bottom: 2px;
  }
  .header h1 {
    font-family: 'Times New Roman', Times, serif;
    font-size: 20px;
    font-weight: 700;
    color: #6b3a12;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    line-height: 1.25;
  }
  .header .sub { font-size: 12px; color: #8a7358; margin-top: 3px; font-weight: 500; }

  /* ── info panel ── */
  .info-panel {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 28px;
    background: #fff6e0;
    border: 1.5px solid #f0d9b0;
    border-radius: 16px;
    padding: 14px 20px;
    margin-bottom: 14px;
    position: relative; z-index: 1;
  }
  .info-col { display: flex; flex-direction: column; gap: 10px; }
  .info-field { display: flex; align-items: center; gap: 10px; }
  .info-field .ico { width: 32px; height: 32px; }
  .info-label { font-size: 11px; color: #a08060; font-weight: 500; line-height: 1.2; }
  .info-value { font-size: 13.5px; font-weight: 700; color: #4a3018; line-height: 1.3; }

  /* ── icon circle ── */
  .ico {
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(145deg, #f5a623, #e8890f);
    color: #fff; flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(232,137,15,.35);
  }
  .ico svg { width: 17px; height: 17px; }
  .ico.green { background: linear-gradient(145deg, #8bc34a, #689f38); box-shadow: 0 2px 6px rgba(104,159,56,.3); }

  /* ── content grid: row1 | row2 | full ── */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
    position: relative; z-index: 1;
  }
  .content-grid .span-full { grid-column: 1 / -1; }

  .card {
    background: #fff;
    border: 1.5px solid #efe0cc;
    border-radius: 14px;
    padding: 12px 14px;
    min-height: 90px;
  }
  .card.green-bg { background: #f0f9ec; border-color: #cde8c4; }
  .card.tall { min-height: 160px; }

  .card-head { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
  .card-title {
    font-size: 11.5px; font-weight: 800;
    color: #d4840a; letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .card.green-bg .card-title { color: #558b2f; }

  .card-body { font-size: 12.5px; line-height: 1.6; color: #4a3018; }
  .empty { color: #b0a090; font-style: italic; font-size: 12px; }

  .num-row { display: flex; gap: 6px; margin-bottom: 6px; }
  .num-row .num { font-weight: 700; color: #8b5a2b; flex-shrink: 0; }

  table.scores { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.scores th, table.scores td { border: 1px solid #e8d5bc; padding: 5px 6px; text-align: center; }
  table.scores th { background: #fff3e0; color: #8d6e4a; font-weight: 700; font-size: 11px; }

  .dot-line { border-bottom: 1.5px dotted #c9b49a; height: 24px; margin-bottom: 5px; }
  .list-item { margin-bottom: 7px; }
  .list-item strong { color: #6b3a12; }

  /* ── footer ── */
  .footer {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    padding-top: 6px; position: relative; z-index: 1;
  }
  .sign-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .sign-row .ico { width: 30px; height: 30px; background: #fff3e0; color: #d4840a; box-shadow: none; border: 1px solid #f0dcc0; }
  .sign-row .ico svg { width: 15px; height: 15px; }
  .sign-text { font-weight: 700; color: #6b3a12; }
  .sign-line-wrap { flex: 1; }
  .sign-line { border-bottom: 1.5px solid #8d6e4a; margin-top: 22px; }
`;

const openPrintWindow = (title: string, bodyHtml: string) => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  printWindow.document.write(`
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>${CHAMEDU_PRINT_STYLES}</style>
      </head>
      <body>
        ${bodyHtml}
        <script>
          window.onload = function () { window.focus(); window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printMonthlyCommentSlip = (data: {
  studentName: string;
  studentCode: string;
  className: string;
  month: number;
  year: number;
  comment: string;
}) => {
  const bodyHtml = `
    <div class="frame">
      ${renderSlipHeader('PHIẾU NHẬN XÉT', `Tháng ${data.month}/${data.year}`)}
      <div class="info-panel">
        <div class="info-col">
          ${infoField(ICONS.user, 'Học sinh', escapeHtml(data.studentName))}
          ${infoField(ICONS.book, 'Lớp', escapeHtml(data.className))}
        </div>
        <div class="info-col">
          ${infoField(ICONS.id, 'Mã', escapeHtml(data.studentCode))}
          ${infoField(ICONS.calendarCheck, 'Ngày in', new Date().toLocaleDateString('vi-VN'))}
        </div>
      </div>
      ${sectionCard(ico('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'), 'NỘI DUNG NHẬN XÉT', formatMultiline(data.comment, 'Chưa có nhận xét'), 'span-full')}
      <div class="footer">
        <div class="sign-row">${ICONS.pencil}<span class="sign-text">Giáo viên</span></div>
        <div class="sign-row">${ICONS.family}<div class="sign-line-wrap"><span class="sign-text">Phụ huynh</span><div class="sign-line"></div></div></div>
      </div>
    </div>
  `;
  openPrintWindow('Phiếu nhận xét', bodyHtml);
};

export const printSessionCommentSlip = (data: {
  studentName: string;
  studentCode: string;
  className: string;
  date: string;
  sessionNumber?: number | null;
  status: string;
  homeworkCompletion?: number;
  testName?: string;
  score?: number;
  bonusPoints?: number;
  note?: string;
  attitudeComment?: string;
  attentionCard?: string;
  checkExerciseTags?: string;
  teacherName?: string;
}) => {
  const dateLabel = data.date
    ? new Date(data.date + 'T12:00:00').toLocaleDateString('vi-VN')
    : new Date().toLocaleDateString('vi-VN');
  const sessionLabel = data.sessionNumber ? `Buổi ${data.sessionNumber}` : '—';
  const hasScores =
    data.homeworkCompletion !== undefined ||
    !!data.testName ||
    data.score !== undefined ||
    data.bonusPoints !== undefined;

  const scoresHtml = hasScores
    ? `<table class="scores">
        <thead><tr><th>% BTVN</th><th>Tên bài KT</th><th>Điểm</th><th>Điểm thưởng</th></tr></thead>
        <tbody><tr>
          <td>${data.homeworkCompletion ?? '—'}</td>
          <td>${escapeHtml(data.testName || '—')}</td>
          <td>${data.score ?? '—'}</td>
          <td>${data.bonusPoints ?? '—'}</td>
        </tr></tbody>
      </table>`
    : '<span class="empty">Chưa nhập điểm số buổi học</span>';

  const attentionData = parseAttentionCard(data.attentionCard);
  const checkTagsData = parseCheckExerciseTags(data.checkExerciseTags);

  const chuYCanThuocHtml = attentionData?.selectedNotes?.length
    ? attentionData.selectedNotes
        .map(
          (note, i) => `
            <div class="list-item">
              <div class="num-row"><span class="num">${i + 1}.</span><span><strong>${escapeHtml(note.title || 'Chú ý')}</strong>${note.content ? ` — ${escapeHtml(note.content)}` : ''}</span></div>
            </div>`
        )
        .join('')
    : dottedLines(7);

  const reviewItems =
    checkTagsData?.materials?.length
      ? checkTagsData.materials
      : checkTagsData?.exerciseTypes || [];

  const dangBaiXemLaiHtml = reviewItems.length
    ? reviewItems
        .map(
          (item, i) =>
            `<div class="num-row"><span class="num">${i + 1}.</span><span>${escapeHtml(item.title)}</span></div>`
        )
        .join('')
    : dottedLines(3);

  const teacherLabel = data.teacherName
    ? `Giáo viên: ${escapeHtml(data.teacherName)}`
    : 'Giáo viên';

  const greenClipboard = ICONS.clipboard.replace('class="ico"', 'class="ico green"');

  const bodyHtml = `
    <div class="frame">
      <div class="leaf-bl"></div>
      <div class="leaf-br"></div>

      ${renderSlipHeader('PHIẾU NHẬN XÉT BUỔI HỌC', 'Gửi phụ huynh')}

      <div class="info-panel">
        <div class="info-col">
          ${infoField(ICONS.user, 'Học sinh', escapeHtml(data.studentName))}
          ${infoField(ICONS.book, 'Lớp', escapeHtml(data.className))}
          ${infoField(ICONS.calendar, 'Buổi học', sessionLabel)}
        </div>
        <div class="info-col">
          ${infoField(ICONS.id, 'Mã', escapeHtml(data.studentCode))}
          ${infoField(ICONS.calendarCheck, 'Ngày học', dateLabel)}
          ${infoField(ICONS.attendance, 'Điểm danh', escapeHtml(data.status || '—'))}
        </div>
      </div>

      <div class="content-grid">
        ${sectionCard(ICONS.chart, 'KẾT QUẢ BUỔI HỌC', scoresHtml)}
        ${sectionCard(ICONS.star, 'NHẬN XÉT Ý THỨC', formatNumberedList(data.attitudeComment, 'Chưa có nhận xét'))}
        ${sectionCard(greenClipboard, 'GHI CHÚ', formatNumberedList(data.note, 'Chưa có ghi chú'), 'green-bg')}
        ${sectionCard(ICONS.bulb, 'CÁC CHÚ Ý CẦN THUỘC', chuYCanThuocHtml, 'tall')}
        ${sectionCard(ICONS.bookMark, 'CÁC DẠNG BÀI CẦN XEM LẠI', dangBaiXemLaiHtml, 'span-full')}
      </div>

      <div class="footer">
        <div class="sign-row">${ICONS.pencil}<span class="sign-text">${teacherLabel}</span></div>
        <div class="sign-row">
          ${ICONS.family}
          <div class="sign-line-wrap">
            <span class="sign-text">Phụ huynh</span>
            <div class="sign-line"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  openPrintWindow('Phiếu nhận xét buổi học', bodyHtml);
};

export const printExerciseNotes = (data: {
  exerciseTypeTitle: string;
  gradeName?: string;
  notes: Array<{ title: string; content: string }>;
}) => {
  const noteBlocks = data.notes
    .map(
      (note, i) =>
        sectionCard(
          ICONS.clipboard.replace('class="ico"', 'class="ico green"'),
          escapeHtml(note.title || `Ghi chú ${i + 1}`),
          formatMultiline(note.content, 'Chưa có nội dung')
        )
    )
    .join('');

  const bodyHtml = `
    <div class="frame">
      ${renderSlipHeader('THẺ GHI CHÚ', `${escapeHtml(data.exerciseTypeTitle)}${data.gradeName ? ` · ${escapeHtml(data.gradeName)}` : ''}`)}
      <div class="content-grid">${noteBlocks}</div>
    </div>
  `;
  openPrintWindow('Thẻ ghi chú', bodyHtml);
};
