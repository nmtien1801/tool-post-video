import React, { useState, useCallback, useEffect } from 'react';

const PRIVACY_OPTIONS_TIKTOK = [
  { value: 'PUBLIC_TO_EVERYONE', label: 'Công khai', icon: '🌍' },
  { value: 'FOLLOWER_OF_CREATOR', label: 'Người theo dõi', icon: '👥' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Bạn bè', icon: '🤝' },
  { value: 'SELF_ONLY', label: 'Chỉ mình tôi', icon: '🔒' },
];

const PRIVACY_OPTIONS_YOUTUBE = [
  { value: 'PUBLIC', label: 'Công khai', icon: '🌍' },
  { value: 'UNLISTED', label: 'Không công khai', icon: '🔗' },
  { value: 'PRIVATE', label: 'Riêng tư', icon: '🔒' },
];

const ENV_SHEET_URL = import.meta.env?.VITE_GOOGLE_SHEET_URL || '';
const ENV_SHEET_TAB = import.meta.env?.VITE_GOOGLE_SHEET_TAB || 'Trang tính1';
const LOCAL_BACKEND_URL = 'http://localhost:3001';

function parseSheetId(input) {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

export default function MultiPostDashboard() {
  const [sheetInput, setSheetInput] = useState(() => ENV_SHEET_URL);
  const [sheetTab, setSheetTab] = useState(() => ENV_SHEET_TAB);
  const [dynamicHeaders, setDynamicHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetId, setSheetId] = useState('');

  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');

  const [selectedPlatforms, setSelectedPlatforms] = useState({ tiktok: false, youtube: false });
  const [apiKeys] = useState({
    tiktok: import.meta.env?.VITE_ZERNIO_API_KEY_TIKTOK || '',
    youtube: import.meta.env?.VITE_ZERNIO_API_KEY_YOUTUBE || '',
  });
  const [accountIds] = useState({
    tiktok: import.meta.env?.VITE_TIKTOK_ACCOUNT_ID || '',
    youtube: import.meta.env?.VITE_YOUTUBE_ACCOUNT_ID || '',
  });

  const [tiktokPrivacy, setTiktokPrivacy] = useState('PUBLIC_TO_EVERYONE');
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [aiDisclosure, setAiDisclosure] = useState(false);
  const [coverMs, setCoverMs] = useState(1000);

  const [youtubePrivacy, setYoutubePrivacy] = useState('PUBLIC');
  const [isShort, setIsShort] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ─── ĐÃ SỬA: ĐỌC DỮ LIỆU QUA IPC BRIDGE (window.electronAPI) ───
  const fetchRows = useCallback(async (sid) => {
    const id = sid || sheetId;
    if (!id) return;
    setSheetLoading(true);
    setSheetError('');
    setRows([]);
    setDynamicHeaders([]);
    setSelectedRow(null);

    try {
      const range = `${sheetTab}!A:J`; 

      // Gọi qua API Bridge lách triệt để Provisional headers của Chrome
      const result = await window.electronAPI.sendToBackend('/api/sheets/read', { sheetId: id, range });
      if (!result.success) throw new Error(result.error || 'Lỗi kết nối tới ma trận luồng dữ liệu Google Sheet.');
      
      const data = result.data;
      const values = data.values || [];
      if (!values.length) throw new Error('Sheet trống.');

      const headerRow = values[0] || [];
      setDynamicHeaders(headerRow);

      const mapped = values.slice(1).map((row, i) => {
        const cells = Array.from({ length: 10 }, (_, colIdx) => row[colIdx] || '');
        return { _row: i + 2, cells: cells };
      }).filter(r => {
        const urlCell = r.cells[2]?.trim();
        return urlCell !== '' && urlCell !== '—' && urlCell !== undefined;
      });

      setRows(mapped);
    } catch (e) {
      setSheetError(e.message);
    } finally {
      setSheetLoading(false);
    }
  }, [sheetTab, sheetId]);

  const handleConnect = async () => {
    setSheetError('');
    setSheetLoading(true);
    const sid = parseSheetId(sheetInput);
    if (!sid) { setSheetError('Nhập URL hoặc ID của Google Sheet.'); setSheetLoading(false); return; }
    setSheetId(sid);
    await fetchRows(sid);
  };

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

  // ─── ĐÃ SỬA: GHI TRẠNG THÁI LÊN SHEET QUA IPC BRIDGE ───
  const updateSheetAfterPublish = async (rowNumber, tiktokUrl, youtubeUrl) => {
    try {
      // 1. Cập nhật Trạng thái tại cột J -> TRUE
      await window.electronAPI.sendToBackend('/api/sheets/update', { sheetId, range: `${sheetTab}!J${rowNumber}`, values: [['TRUE']] });

      // 2. Cập nhật Link YouTube vào Cột H
      if (youtubeUrl) {
        await window.electronAPI.sendToBackend('/api/sheets/update', { sheetId, range: `${sheetTab}!H${rowNumber}`, values: [[youtubeUrl]] });
      }

      // 3. Cập nhật Link TikTok vào Cột I
      if (tiktokUrl) {
        await window.electronAPI.sendToBackend('/api/sheets/update', { sheetId, range: `${sheetTab}!I${rowNumber}`, values: [[tiktokUrl]] });
      }
    } catch (e) {
      console.error("Lỗi cập nhật dữ liệu ô Matrix Sheet:", e);
    }
  };

  const handleSelectRow = (row) => {
    setSelectedRow(row._row);
    setError(null);
    setResult(null);

    const videoUrlFromRow = row.cells[2]?.trim() || ''; 
    if (videoUrlFromRow) {
      const pureFileName = videoUrlFromRow.replace(/^.*[\\/]/, '');
      setVideoUrl(`${LOCAL_BACKEND_URL}/videos/${pureFileName}`);
    } else {
      setVideoUrl('');
    }

    setTitle(row.cells[3] || ''); 
    setCaption(row.cells[4] || ''); 

    setSelectedPlatforms({
      tiktok: row.cells[5]?.trim().toUpperCase() === 'TRUE', 
      youtube: row.cells[6]?.trim().toUpperCase() === 'TRUE' 
    });
  };

  const executeUploadRow = async (targetVideoUrl, targetTitle, targetCaption, platforms) => {
    const platformsPayload = [];
    if (platforms.tiktok && accountIds.tiktok.trim()) {
      platformsPayload.push({ platform: 'tiktok', accountId: accountIds.tiktok.trim() });
    }
    if (platforms.youtube && accountIds.youtube.trim()) {
      platformsPayload.push({
        platform: 'youtube',
        accountId: accountIds.youtube.trim(),
        platformSpecificData: { title: targetTitle.trim() || "Video Title", visibility: youtubePrivacy.toLowerCase() }
      });
    }

    if (platformsPayload.length === 0) throw new Error("Không có nền tảng nào được kích hoạt hoặc thiếu Account ID.");
    const executionApiKey = platforms.tiktok ? apiKeys.tiktok : apiKeys.youtube;

    const payload = {
      content: targetCaption.trim(),
      mediaItems: [{ type: 'video', url: targetVideoUrl }],
      platforms: platformsPayload,
      publishNow: true,
      ...(platforms.tiktok ? {
        tiktokSettings: {
          privacy_level: tiktokPrivacy, allow_comment: allowComment, allow_duet: allowDuet, allow_stitch: allowStitch,
          video_cover_timestamp_ms: coverMs, content_preview_confirmed: true, express_consent_given: true,
          ...(aiDisclosure ? { video_made_with_ai: true } : {}),
        }
      } : {}),
      ...(platforms.youtube ? { youtubeSettings: { is_shorts: isShort } } : {})
    };

    const response = await fetch('https://zernio.com/api/v1/posts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${executionApiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || data?.error || `Lỗi từ server Zernio: ${response.status}`);

    const postId = data?.post?._id || data?.post?.id || data?._id || data?.id;
    let postData = data?.post || data;

    if (postId) {
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const pollRes = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
            headers: { 'Authorization': `Bearer ${executionApiKey.trim()}` }
          });
          const pollData = await pollRes.json();
          const refreshed = pollData?.post || pollData;

          const tkData = refreshed?.platforms?.find(p => p.platform === 'tiktok');
          const ytData = refreshed?.platforms?.find(p => p.platform === 'youtube');

          const isTkDone = !platforms.tiktok || tkData?.status === 'published' || tkData?.username || tkData?.accountId?.username;
          const isYtDone = !platforms.youtube || ytData?.status === 'published' || ytData?.platformPostId;

          if (isTkDone && isYtDone) { postData = refreshed; break; }
          else { postData = refreshed; }
        } catch (_) { }
      }
    }
    return postData;
  };

  const handlePublishAndScan = async () => {
    if (uploading || rows.length === 0) return;
    const pendingRows = rows.filter(r => r.cells[9]?.trim().toUpperCase() === 'FALSE' || r.cells[9]?.trim() === '');
    if (pendingRows.length === 0) { alert("Không tìm thấy hàng nào ở trạng thái FALSE!"); return; }

    setUploading(true); setError(null); setResult(null);

    try {
      for (let i = 0; i < pendingRows.length; i++) {
        const row = pendingRows[i];
        setUploadStatus(`Đang xử lý hàng #${row._row}...`);

        const currentVideoUrl = row.cells[2]?.trim() || ''; 
        const currentTitle = row.cells[3]?.trim() || 'Video Title';
        const currentCaption = row.cells[4]?.trim() || ''; 
        const currentPlatforms = {
          tiktok: row.cells[5]?.trim().toUpperCase() === 'TRUE', 
          youtube: row.cells[6]?.trim().toUpperCase() === 'TRUE' 
        };

        if (!currentVideoUrl) continue;
        if (!currentPlatforms.tiktok && !currentPlatforms.youtube) continue;

        const postData = await executeUploadRow(currentVideoUrl, currentTitle, currentCaption, currentPlatforms);
        setResult(postData);

        const resTiktok = postData?.platforms?.find(p => p.platform === 'tiktok');
        const resYoutube = postData?.platforms?.find(p => p.platform === 'youtube');

        const tkUser = resTiktok?.accountId?.username || resTiktok?.username || '';
        const tkFinalUrl = tkUser ? `https://www.tiktok.com/@${tkUser}` : '';
        const ytId = resYoutube?.platformPostId || '';
        const ytFinalUrl = ytId ? `https://studio.youtube.com/video/${ytId}/edit` : '';

        await updateSheetAfterPublish(row._row, tkFinalUrl, ytFinalUrl);
      }
      setUploadStatus('Đang tải lại danh sách...');
      await fetchRows(sheetId);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi không xác định');
    } finally {
      setUploading(false); setUploadStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e15] text-slate-100 font-sans p-6 relative overflow-x-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-pink-500/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="max-w-[1600px] mx-auto flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-red-400 flex items-center justify-center font-bold shadow-lg shadow-purple-500/20">🚀</div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Creatimic Studio Multi-Poster</h1>
            <p className="text-[11px] text-slate-500">Phát hành đa nền tảng kết hợp Đồng bộ Matrix Google Sheet</p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-400 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">Integrated Matrix Engine</div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI */}
        <div className="xl:col-span-7 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><span>📊</span> Kết nối Google Sheet</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" value={sheetInput} onChange={e => setSheetInput(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-purple-500 focus:outline-none" />
              <input type="text" value={sheetTab} onChange={e => setSheetTab(e.target.value)} placeholder="Trang tính1" className="w-full sm:w-28 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-center focus:border-purple-500 focus:outline-none" />
              <button type="button" onClick={handleConnect} disabled={!sheetInput.trim() || sheetLoading} className="shrink-0 px-5 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-700 to-purple-500 hover:brightness-110 disabled:bg-slate-800 flex items-center gap-2 cursor-pointer">{sheetLoading ? 'Đang xử lý...' : '🔗 Tải Sheet'}</button>
            </div>
            {sheetError && <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400">⚠️ {sheetError}</div>}
          </div>

          {rows.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
              <div className="p-3 bg-slate-950/40 border-b border-slate-800/60 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">📑 DỮ LIỆU HÀNG</span>
                {selectedRow && <span className="text-[10px] bg-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded-md">Đang xem dòng #{selectedRow}</span>}
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-slate-950 z-10 shadow-sm">
                    <tr className="border-b border-slate-800/60 text-slate-400">
                      <th className="px-3 py-2.5 text-left w-12 bg-slate-950">#</th>
                      {dynamicHeaders.map((head, index) => <th key={index} className="px-3 py-2.5 text-left font-semibold bg-slate-950">{head || 'Trống'}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const active = selectedRow === row._row;
                      return (
                        <tr key={row._row} onClick={() => handleSelectRow(row)} className={`border-b border-slate-800/30 cursor-pointer transition-all ${active ? 'bg-purple-500/10' : 'hover:bg-slate-800/30'}`}>
                          <td className={`px-3 py-2 font-mono ${active ? 'text-purple-400 font-bold' : 'text-slate-600'}`}>{row._row}</td>
                          {row.cells.map((cellValue, cellIdx) => <td key={cellIdx} className={`px-3 py-2 max-w-[160px] truncate ${active ? 'text-slate-200' : 'text-slate-400'}`}>{cellValue || <span className="text-slate-700 italic">—</span>}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-5">
            <div>
              <h2 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5"><span>⚙️</span> CẤU HÌNH OPTION NỀN TẢNG CỐ ĐỊNH</h2>
              <p className="text-[10px] text-slate-500 mt-1">Thông tin Video sẽ quét lấy trực tiếp tự động của DỮ LIỆU HÀNG.</p>
            </div>

            {videoUrl && (
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-medium">📺 Xem trước Video hàng đang chọn</label>
                <div className="bg-black border border-slate-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[160px]"><video src={videoUrl} controls className="w-full max-h-[260px] object-contain" /></div>
              </div>
            )}

            {/* TikTok Options */}
            <div className="border-t border-slate-800/60 pt-4 space-y-3">
              <h3 className="text-[11px] font-bold text-pink-400 uppercase tracking-wider">Cấu hình riêng TikTok</h3>
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-medium">Bảo mật</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {PRIVACY_OPTIONS_TIKTOK.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setTiktokPrivacy(opt.value)} className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${tiktokPrivacy === opt.value ? 'border-pink-500/60 bg-pink-500/10 text-pink-400 font-bold' : 'border-slate-800 bg-slate-950/30 text-slate-400'}`}><span>{opt.icon}</span> <span className="truncate">{opt.label}</span></button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { label: 'Bình luận', checked: allowComment, onChange: setAllowComment },
                  { label: 'Cho phép Duet', checked: allowDuet, onChange: setAllowDuet },
                  { label: 'Cho phép Stitch', checked: allowStitch, onChange: setAllowStitch },
                  { label: 'Nội dung AI', checked: aiDisclosure, onChange: setAiDisclosure }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-0.5"><span className="text-slate-400">{item.label}</span><input type="checkbox" checked={item.checked} onChange={e => item.onChange(e.target.checked)} className="w-3 h-3 accent-pink-500 cursor-pointer" /></div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] bg-slate-950/30 p-2 rounded-lg border border-slate-800/40">
                <span className="text-slate-400">Thời gian chọn ảnh bìa: <span className="font-mono text-pink-400 font-bold">{coverMs} ms</span></span>
                <input type="range" min={0} max={10000} step={500} value={coverMs} onChange={e => setCoverMs(Number(e.target.value))} className="w-32 accent-pink-500" />
              </div>
            </div>

            {/* YouTube Options */}
            <div className="border-t border-slate-800/60 pt-4 space-y-3">
              <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Cấu hình riêng YouTube</h3>
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-medium">Bảo mật</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRIVACY_OPTIONS_YOUTUBE.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setYoutubePrivacy(opt.value)} className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${youtubePrivacy === opt.value ? 'border-red-500 bg-red-500/10 text-red-400 font-bold' : 'border-slate-800 bg-slate-950/30 text-slate-400'}`}><span>{opt.icon}</span> {opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 flex items-center justify-between text-[11px]">
                <div><p className="font-medium text-slate-300">Định dạng YouTube Shorts</p><p className="text-[10px] text-slate-500 mt-0.5">Ép luồng cho video dọc dưới 60 giây</p></div>
                <input type="checkbox" checked={isShort} onChange={e => setIsShort(e.target.checked)} className="w-3.5 h-3.5 accent-red-500 cursor-pointer" />
              </div>
            </div>

            {error && <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 flex items-start gap-2"><span>⚠️</span> <p className="flex-1 leading-normal">{error}</p></div>}

            <button type="button" onClick={handlePublishAndScan} disabled={uploading || rows.length === 0} className="w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:brightness-110 active:scale-[0.99] disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none shadow-purple-900/20">
              {uploading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0115.41-4.14l1.42-1.42A10 10 0 003 12h1z" /></svg>
                  <span className="font-medium text-xs normal-case tracking-normal text-white">{uploadStatus}</span>
                </div>
              ) : <><span>⚡</span> ĐĂNG VIDEO (QUÉT FALSE & TỰ ĐỘNG UP)</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}