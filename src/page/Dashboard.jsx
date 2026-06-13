import React, { useState } from 'react';

const PRIVACY_OPTIONS = [
  { value: 'PUBLIC_TO_EVERYONE', label: 'Công khai', icon: '🌍' },
  { value: 'FOLLOWER_OF_CREATOR', label: 'Người theo dõi', icon: '👥' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Bạn bè', icon: '🤝' },
  { value: 'SELF_ONLY', label: 'Chỉ mình tôi', icon: '🔒' },
];

export default function Dashboard() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [dragging, setDragging] = useState(false);

  // 🌟 LẤY GIÁ TRỊ TỪ FILE .ENV (Hỗ trợ cả Vite lẫn Create React App)
  const [apiKey] = useState(
    import.meta.env?.VITE_ZERNIO_API_KEY || process.env?.REACT_APP_ZERNIO_API_KEY || ''
  );
  const [accountId] = useState(
    import.meta.env?.VITE_TIKTOK_ACCOUNT_ID || process.env?.REACT_APP_TIKTOK_ACCOUNT_ID || ''
  );

  // Các cấu hình Form khác
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState('PUBLIC_TO_EVERYONE');
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [aiDisclosure, setAiDisclosure] = useState(false);
  const [coverMs, setCoverMs] = useState(1000);

  // Trạng thái hệ thống
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      // Tạo URL cục bộ để hiển thị trình phát preview ngay lập tức trên UI
      setVideoUrl(URL.createObjectURL(file));
      setError(null);
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  // 🌟 Cập nhật hàm kiểm tra: Chỉ cần có video và caption là có thể bấm Đăng
  const isFormValid = () => {
    return (
      videoFile !== null &&
      caption.trim().length > 0 &&
      apiKey.length > 0 &&
      accountId.length > 0
    );
  };

  const handlePublish = async () => {
    if (!isFormValid() || uploading) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      // ── BƯỚC 1: Xác thực nguồn dữ liệu từ Cloudinary ──
      setUploadStatus('1/2: Đang chuẩn bị tệp tin media...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Sử dụng trực tiếp đường dẫn video đã lưu trữ thành công trên Cloudinary của bạn
      const publicHttpsUrl = "https://res.cloudinary.com/dv6qgkaj4/video/upload/v1781312044/test1_chqxfq.mp4";

      // ── BƯỚC 2: Gửi API sang Zernio ──
      setUploadStatus('2/2: Đang gửi yêu cầu đăng lên TikTok...');

      const payload = {
        content: caption,
        mediaItems: [{ type: 'video', url: publicHttpsUrl }],
        platforms: [{ platform: 'tiktok', accountId: accountId.trim() }],
        tiktokSettings: {
          privacy_level: privacy,
          allow_comment: allowComment,
          allow_duet: allowDuet,
          allow_stitch: allowStitch,
          video_cover_timestamp_ms: coverMs,
          content_preview_confirmed: true,
          express_consent_given: true,
          ...(aiDisclosure ? { video_made_with_ai: true } : {}),
        },
        publishNow: true,
      };

      const response = await fetch('https://zernio.com/api/v1/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Lỗi từ server: ${response.status}`);
      }

      setResult(data?.post || data);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi không xác định');
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e15] text-slate-100 font-sans p-6 relative overflow-x-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-pink-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-slate-800 pb-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center font-bold shadow-lg shadow-pink-500/20">
            ♬
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">TikTok Auto-Poster</h1>
            <p className="text-xs text-slate-500">Thiết kế UI tinh gọn · Config qua ENV</p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-500 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
          Zernio API v1 Powered
        </div>
      </div>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* BÊN TRÁI: UP VIDEO & PREVIEW */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>📁</span> Tải lên nội dung
            </h2>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('video-file-input').click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-all min-h-[180px]
                ${dragging ? 'border-pink-500 bg-pink-500/10' : videoFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'}`}
            >
              <input
                id="video-file-input"
                type="file"
                accept="video/mp4,video/mov,video/webm"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
              />
              {videoFile ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-2xl text-emerald-400">🎬</div>
                  <div className="max-w-xs truncate">
                    <p className="font-medium text-sm text-slate-200">{videoFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(videoFile.size / 1024 / 1024).toFixed(1)} MB · Click để đổi</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl text-slate-400">📹</div>
                  <div>
                    <p className="font-medium text-sm">Kéo thả video vào đây hoặc nhấp chọn</p>
                    <p className="text-xs text-slate-500 mt-1">MP4, MOV, WebM</p>
                  </div>
                </>
              )}
            </div>

            {videoUrl && (
              <div className="mt-6 space-y-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Trình xem trước (9:16)</label>
                <div className="rounded-xl overflow-hidden bg-black border border-slate-800 aspect-[9/16] max-h-[420px] mx-auto shadow-2xl relative">
                  <video src={videoUrl} controls className="w-full h-full object-contain" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BÊN PHẢI: CẤU HÌNH & NÚT ĐĂNG */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-5">

            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <span>⚙️</span> Cấu hình & Xuất bản bài viết
            </h2>

            {/* CẢNH BÁO NẾU THIẾU FILE .ENV */}
            {(!apiKey || !accountId) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400">
                ⚠️ <strong>Cảnh báo:</strong> Hệ thống chưa phát hiện thông tin xác thực từ file <code>.env</code>. Vui lòng cấu hình file môi trường để kích hoạt tính năng đăng bài.
              </div>
            )}

            {/* Ô nhập Caption mô tả */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs text-slate-400 font-medium">Nội dung mô tả (Caption)</label>
                <span className={`text-[10px] font-mono ${caption.length > 2100 ? 'text-red-400' : 'text-slate-600'}`}>{caption.length}/2200</span>
              </div>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 2200))}
                placeholder="Viết caption cuốn hút... Thêm #hashtag để kéo tương tác"
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm resize-none focus:border-pink-500 focus:outline-none transition-all"
              />
            </div>

            {/* Lựa chọn quyền riêng tư */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-2">Ai có thể xem video này?</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIVACY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPrivacy(opt.value)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all
                      ${privacy === opt.value
                        ? 'border-pink-500/60 bg-pink-500/10 text-pink-400 font-bold shadow-sm'
                        : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span>{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cài đặt tương tác */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-slate-300">Bình luận</p>
                  <p className="text-[10px] text-slate-500">Mở tương tác thảo luận</p>
                </div>
                <input type="checkbox" checked={allowComment} onChange={e => setAllowComment(e.target.checked)} className="w-4 h-4 accent-pink-500 cursor-pointer" />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-slate-300">Tính năng Duet</p>
                  <p className="text-[10px] text-slate-500">Cho người khác quay cùng</p>
                </div>
                <input type="checkbox" checked={allowDuet} onChange={e => setAllowDuet(e.target.checked)} className="w-4 h-4 accent-pink-500 cursor-pointer" />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-slate-300">Tính năng Stitch</p>
                  <p className="text-[10px] text-slate-500">Cho trích dẫn đoạn clip</p>
                </div>
                <input type="checkbox" checked={allowStitch} onChange={e => setAllowStitch(e.target.checked)} className="w-4 h-4 accent-pink-500 cursor-pointer" />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-slate-300">Gắn nhãn Nội dung AI</p>
                  <p className="text-[10px] text-slate-500">Bắt buộc nếu làm bằng AI</p>
                </div>
                <input type="checkbox" checked={aiDisclosure} onChange={e => setAiDisclosure(e.target.checked)} className="w-4 h-4 accent-pink-500 cursor-pointer" />
              </div>
            </div>

            {/* Tùy chỉnh ảnh bìa */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-slate-400 font-medium">Thời gian chọn ảnh bìa</label>
                <span className="font-mono text-pink-400 font-semibold">{coverMs} ms</span>
              </div>
              <input
                type="range" min={0} max={10000} step={500} value={coverMs}
                onChange={e => setCoverMs(Number(e.target.value))}
                className="w-full accent-pink-500 bg-slate-800 h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Trạng thái lỗi hoặc thành công */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
                <span>⚠️</span> <p className="flex-1 leading-normal">{error}</p>
              </div>
            )}

            {result && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 space-y-1.5">
                <p className="font-bold text-sm flex items-center gap-1.5"><span>🎉</span> Đăng tải thành công!</p>
                <p className="text-slate-400">Hệ thống TikTok đang xử lý video. ID: <span className="font-mono text-white bg-slate-900 px-1.5 py-0.5 rounded">{result._id || 'N/A'}</span></p>
              </div>
            )}

            {/* Nút bấm hành động chính */}
            <button
              type="button"
              onClick={handlePublish}
              disabled={!isFormValid() || uploading}
              className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 relative overflow-hidden
                bg-gradient-to-r from-pink-600 via-red-500 to-orange-500 hover:brightness-110 active:scale-[0.99]
                disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none shadow-pink-900/20"
            >
              {uploading ? (
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0115.41-4.14l1.42-1.42A10 10 0 003 12h1z" />
                  </svg>
                  <span className="font-medium">{uploadStatus}</span>
                </div>
              ) : (
                <>
                  <span>🚀</span> Phát hành ngay lên TikTok
                </>
              )}
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}