import React, { useState, useCallback, useRef, useEffect } from 'react';

// Cấu hình cứng URL và Tab mặc định thông qua file .env giống Dashboard
const ENV_SHEET_URL = import.meta.env?.VITE_GOOGLE_SHEET_URL || '';
const ENV_SHEET_TAB = import.meta.env?.VITE_GOOGLE_SHEET_TAB || 'Trang tính1';
const LOCAL_BACKEND_URL = import.meta.env?.VITE_BACKEND_TOOL_URL;
// Giữ nguyên domain tĩnh để sinh chuỗi link khớp chính xác với cấu trúc cột C trên Sheet
const FIXED_VIDEO_DOMAIN = 'https://video.cmicstudio.shop';

function parseSheetId(input) {
    const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : input.trim();
}

function getColumnLetter(index) {
    let letter = '';
    let column = index + 1;
    while (column > 0) {
        const remainder = (column - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        column = Math.floor((column - 1) / 26);
    }
    return letter;
}

async function callBackend(endpoint, body) {
    if (window.electronAPI?.sendToBackend) {
        const result = await window.electronAPI.sendToBackend(endpoint, body);
        if (!result.success) {
            let message = result.error || 'Backend xử lý thất bại.';
            try {
                message = JSON.parse(message)?.error || message;
            } catch {
                message = result.error || message;
            }
            throw new Error(message);
        }
        return result.data;
    }

    const res = await fetch(`${LOCAL_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Backend xử lý thất bại.');
    return data;
}

function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 ** 3) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}

// ─── SUB-COMPONENT: TEXTAREA TỰ CO GIÃN ĐỘ CAO THEO CHỮ ───────────────────
function AutoExpandingInput({ value, onChange, label }) {
    const textareaRef = useRef(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    return (
        <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-medium block truncate">
                {label}
            </label>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    adjustHeight();
                }}
                rows={1}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-purple-500 focus:outline-none transition-all resize-none min-h-[34px] overflow-hidden leading-normal"
            />
        </div>
    );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function VideoUrlPicker() {
    // 🟢 Khởi tạo giá trị mặc định trực tiếp từ file .env
    const [sheetInput, setSheetInput] = useState(() => ENV_SHEET_URL);
    const [sheetTab, setSheetTab] = useState(() => ENV_SHEET_TAB);

    // ── Dynamic Sheet data
    const [dynamicHeaders, setDynamicHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [selectedRow, setSelectedRow] = useState(null);
    const [sheetLoading, setSheetLoading] = useState(false);
    const [sheetError, setSheetError] = useState('');
    const [sheetId, setSheetId] = useState('');

    // ── Dynamic Form State
    const [formData, setFormData] = useState({});
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [dragging, setDragging] = useState(false);

    // ── UI state
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [saveErr, setSaveErr] = useState('');

    const iframeRef = useRef(null);
    const containerRef = useRef(null);

    // Lắng nghe sự kiện click ra ngoài vùng làm việc để reset form trở lại bình thường
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setSelectedRow(null);
                setFormData({});
                if (videoUrl) URL.revokeObjectURL(videoUrl);
                setVideoFile(null);
                setVideoUrl('');
                setSaveMsg('');
                setSaveErr('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [videoUrl]);

    // ─── ĐÃ SỬA: FETCH ROWS QUA SERVICE ACCOUNT BACKEND (KHÔNG TRUYỀN TOKEN) ───
    const fetchRows = useCallback(async (sid) => {
        const id = sid || sheetId;
        if (!id) return;
        setSheetLoading(true);
        setSheetError('');
        setRows([]);
        setDynamicHeaders([]);
        setSelectedRow(null);
        setFormData({});

        try {
            const range = `${sheetTab}!A:Z`;

            // Gọi qua Node Server để Backend tự lấy quyền từ credentials.json đọc data
            const data = await callBackend('/api/sheets/read', { sheetId: id, range });

            const values = data.values || [];
            if (!values.length) throw new Error('Sheet trống.');

            const headerRow = values[0] || [];
            setDynamicHeaders(headerRow);

            const mapped = values.slice(1).map((row, i) => {
                const cells = headerRow.map((_, colIdx) => row[colIdx] || '');
                return {
                    _row: i + 2,
                    cells: cells
                };
            }).filter(r => r.cells.some(c => c.trim() !== '' && c.trim() !== 'FALSE'));

            setRows(mapped);
        } catch (e) {
            setSheetError(e.message);
        } finally {
            setSheetLoading(false);
        }
    }, [sheetTab, sheetId]);

    // ─── ĐÃ SỬA: NÚT KẾT NỐI KHÔNG BẬT POPUP OAUTH, CHẠY THẲNG XUỐNG BE ───
    const handleConnect = async () => {
        setSheetError('');
        setSheetLoading(true);
        const sid = parseSheetId(sheetInput);
        if (!sid) { setSheetError('Nhập URL hoặc ID của Google Sheet.'); setSheetLoading(false); return; }
        setSheetId(sid);

        await fetchRows(sid);
    };

    // Tự động kết nối và tải bảng ma trận ngay khi vừa mở trang quản trị dữ liệu
    useEffect(() => {
        if (sheetInput.trim() && !sheetLoading) {
            const timer = setTimeout(() => {
                const sid = parseSheetId(sheetInput);
                if (sid) {
                    setSheetId(sid);
                    fetchRows(sid);
                }
            }, 400);
            return () => clearTimeout(timer);
        }
    }, []);

    // ─── SELECT ROW ──────────────────────────────────────────────────────────
    const handleSelectRow = (row) => {
        setSelectedRow(row._row);

        const initialFormData = {};
        row.cells.forEach((cell, index) => {
            initialFormData[index] = cell;
        });
        setFormData(initialFormData);

        if (videoUrl) URL.revokeObjectURL(videoUrl);
        setVideoFile(null);

        const videoUrlFromRow = row.cells[2]?.trim() || '';
        if (videoUrlFromRow) {
            const pureFileName = videoUrlFromRow.replace(/^.*[\\/]/, '');
            setVideoUrl(`${LOCAL_BACKEND_URL}/videos/${pureFileName}`);
        } else {
            setVideoUrl('');
        }

        setSaveMsg('');
        setSaveErr('');
    };

    const handleInputChange = (index, value) => {
        setFormData(prev => ({
            ...prev,
            [index]: value
        }));
        setSaveMsg('');
    };

    const handleFileSelect = (file) => {
        if (!file?.type.startsWith('video/')) return;
        if (videoUrl) URL.revokeObjectURL(videoUrl);

        setVideoFile(file);
        setVideoUrl(URL.createObjectURL(file));
        handleInputChange(2, `${FIXED_VIDEO_DOMAIN}/videos/${file.name}`);
    };
    const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]); };

    // ─── ĐÃ SỬA: ĐỒNG BỘ CẬP NHẬT TRƯỜNG DỮ LIỆU QUA BE (BỎ TOKEN) ────────────────
    const handleUpdate = async () => {
        if (!selectedRow || !sheetId) return;
        setSaving(true);
        setSaveMsg('');
        setSaveErr('');

        try {
            const lastColumn = getColumnLetter(Math.max(dynamicHeaders.length - 1, 0));
            const values = [
                dynamicHeaders.map((_, index) => formData[index] ?? '')
            ];

            await callBackend('/api/sheets/batch-update', {
                sheetId,
                data: [{
                    range: `${sheetTab}!A${selectedRow}:${lastColumn}${selectedRow}`,
                    values,
                }]
            });

            setRows(prev => prev.map(r => {
                if (r._row === selectedRow) {
                    const updatedCells = dynamicHeaders.map((_, idx) => formData[idx] ?? '');
                    return { ...r, cells: updatedCells };
                }
                return r;
            }));

            setSaveMsg(`✅ Đã cập nhật hàng #${selectedRow} lên Sheet thành công!`);

            if (iframeRef.current) {
                const src = iframeRef.current.src;
                iframeRef.current.src = '';
                setTimeout(() => { iframeRef.current.src = src; }, 300);
            }
        } catch (e) {
            setSaveErr('❌ Lỗi lưu Sheet: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const isFormFilled = Object.values(formData).some(val => val.trim() !== '') && selectedRow;
    const iframeUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit?embedded=true&rm=minimal` : '';

    return (
        <div ref={containerRef} className="min-h-screen bg-[#0d0e15] text-slate-100 font-sans p-4">
            {/* Header */}
            <div className="max-w-[1600px] mx-auto flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-red-400 flex items-center justify-center font-bold">🚀</div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight">Creatimic Studio</h1>
                        <p className="text-[11px] text-slate-500">Sheet · Video · Đồng bộ Auto-Expanding Matrix</p>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                {/* CỘT TRÁI (7/12) */}
                <div className="xl:col-span-7 space-y-3">
                    {/* Kết nối */}
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-3">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <span>📊</span> Kết nối Google Sheet
                        </h2>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text" value={sheetInput}
                                onChange={e => setSheetInput(e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                            />
                            <input
                                type="text" value={sheetTab} onChange={e => setSheetTab(e.target.value)}
                                placeholder="Trang tính1"
                                className="w-full sm:w-28 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-center focus:border-purple-500 focus:outline-none"
                            />
                            <button
                                type="button" onClick={handleConnect} disabled={!sheetInput.trim() || sheetLoading}
                                className="shrink-0 px-5 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-700 to-purple-500 hover:brightness-110 disabled:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                                {sheetLoading ? 'Đang xử lý...' : '🔗 Tải Sheet'}
                            </button>
                        </div>
                        {sheetError && <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400">⚠️ {sheetError}</div>}
                    </div>

                    {/* Iframe View */}
                    {iframeUrl && (
                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
                            <iframe
                                ref={iframeRef} src={iframeUrl} className="w-full"
                                style={{ height: '320px', border: 'none', background: '#fff' }} title="Google Sheet"
                            />
                        </div>
                    )}

                    {/* BẢNG ĐỒNG BỘ DỮ LIỆU ĐỘNG */}
                    {rows.length > 0 && (
                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="border-b border-slate-800/60 bg-slate-950/60 text-slate-400">
                                            <th className="px-3 py-2 text-left w-12">#</th>
                                            {dynamicHeaders.map((head, index) => (
                                                <th key={index} className="px-3 py-2 text-left font-semibold">
                                                    {head || 'Trống'}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            const active = selectedRow === row._row;
                                            return (
                                                <tr
                                                    key={row._row} onClick={(e) => { e.stopPropagation(); handleSelectRow(row); }}
                                                    className={`border-b border-slate-800/30 cursor-pointer transition-all ${active ? 'bg-purple-500/10' : 'hover:bg-slate-800/30'}`}
                                                >
                                                    <td className={`px-3 py-2 font-mono ${active ? 'text-purple-400 font-bold' : 'text-slate-600'}`}>{row._row}</td>
                                                    {row.cells.map((cellValue, cellIdx) => (
                                                        <td key={cellIdx} className={`px-3 py-2 max-w-[200px] truncate ${active ? 'text-slate-200' : 'text-slate-400'}`}>
                                                            {cellValue || <span className="text-slate-700 italic">—</span>}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* CỘT PHẢI (5/12) */}
                <div className="xl:col-span-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-4">
                        {selectedRow ? (
                            <div className="flex items-center gap-2 p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px]">
                                <span className="text-purple-300">Đang chọn hàng</span>
                                <span className="font-mono font-bold text-purple-400 text-xs">#{selectedRow}</span>
                            </div>
                        ) : (
                            <div className="p-2.5 bg-slate-950/60 border border-slate-800/40 rounded-xl text-[11px] text-slate-500 text-center">
                                ← Chọn một hàng bất kỳ để mở rộng form nhập
                            </div>
                        )}

                        {/* Selector Video */}
                        <div className="space-y-2">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <span>📁</span> Tệp Video
                            </h2>
                            <input id="file-input" type="file" accept="video/mp4,video/mov,video/webm" className="hidden"
                                onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])} />

                            {!videoFile ? (
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                                    onDrop={handleDrop} onClick={() => document.getElementById('file-input').click()}
                                    className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all min-h-[110px]
                                    ${dragging ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-lg text-slate-400">📹</div>
                                    <p className="font-medium text-xs text-slate-300">Thả hoặc chọn video (Auto điền cột C)</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="bg-slate-950/60 border border-slate-800/60 p-2 rounded-xl flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">🎬</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-xs text-slate-200 truncate">{videoFile.name}</p>
                                            <p className="text-[10px] text-slate-500">{formatSize(videoFile.size)}</p>
                                        </div>
                                    </div>
                                    {videoUrl && (
                                        <div className="bg-black border border-slate-800/80 rounded-xl overflow-hidden flex items-center justify-center min-h-[160px]">
                                            <video src={videoUrl} controls className="w-full max-h-[260px] object-contain" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {!videoFile && videoUrl && (
                                <div className="bg-black border border-slate-800/80 rounded-xl overflow-hidden flex items-center justify-center min-h-[160px]">
                                    <video src={videoUrl} controls className="w-full max-h-[260px] object-contain" />
                                </div>
                            )}
                        </div>

                        {/* GRID LAYOUT MAP TRƯỜNG DỮ LIỆU ĐỘNG */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedRow && dynamicHeaders.map((head, index) => (
                                <AutoExpandingInput
                                    key={index}
                                    label={`${head || 'Trống'}`}
                                    value={formData[index] || ''}
                                    onChange={(val) => handleInputChange(index, val)}
                                />
                            ))}
                        </div>

                        {saveMsg && <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-400">{saveMsg}</div>}
                        {saveErr && <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400">{saveErr}</div>}

                        <button
                            type="button" onClick={handleUpdate} disabled={!isFormFilled || saving}
                            className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer
                            ${isFormFilled && !saving ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:brightness-110 active:scale-[0.99]' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                            {saving ? '⏳ Đang ghi dữ liệu...' : '💾 Cập nhật lên Google Sheet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
