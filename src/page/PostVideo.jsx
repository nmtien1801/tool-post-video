import React, { useState } from 'react';

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

// 📏 Cấu hình giới hạn dung lượng lưu trữ (Bytes)
const MAX_SIZES = {
  tiktok: 4 * 1024 * 1024 * 1024,   // 4 GB
  youtube: 256 * 1024 * 1024 * 1024, // 256 GB
};

const MY_DOMAIN = import.meta.env?.VITE_REACT_URL || '';

export default function MultiPostDashboard() {
  // 📁 STATE: MEDIA (Cột Trái)
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [dragging, setDragging] = useState(false);

  // 📝 STATE: THÔNG TIN NỘI DUNG (Cột Trái)
  const [title, setTitle] = useState('');     // Dùng cho YouTube
  const [caption, setCaption] = useState(''); // Dùng chung (Description/Caption)

  // 🌐 STATE: CHỌN NỀN TẢNG (Cột Phải)
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    tiktok: true,
    youtube: false,
  });

  // 🔑 TOKENS & ACCOUNTS
  const [apiKeys] = useState({
    tiktok: import.meta.env?.VITE_ZERNIO_API_KEY_TIKTOK || '',
    youtube: import.meta.env?.VITE_ZERNIO_API_KEY_YOUTUBE || '',
  });
  const [accountIds] = useState({
    tiktok: import.meta.env?.VITE_TIKTOK_ACCOUNT_ID || '',
    youtube: import.meta.env?.VITE_YOUTUBE_ACCOUNT_ID || '',
  });

  // ⚙️ STATE: CẤU HÌNH TIKTOK
  const [tiktokPrivacy, setTiktokPrivacy] = useState('PUBLIC_TO_EVERYONE');
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [aiDisclosure, setAiDisclosure] = useState(false);
  const [coverMs, setCoverMs] = useState(1000);

  // ⚙️ STATE: CẤU HÌNH YOUTUBE
  const [youtubePrivacy, setYoutubePrivacy] = useState('PUBLIC');
  const [isShort, setIsShort] = useState(false);

  // 🔄 STATE: HỆ THỐNG TRẠNG THÁI
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // --- XỬ LÝ FILE ---
  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setError(null);
      setResult(null);

      // Tự động bỏ chọn các nền tảng bị quá giới hạn kích thước file mới tải lên
      setSelectedPlatforms(prev => ({
        tiktok: file.size <= MAX_SIZES.tiktok ? prev.tiktok : false,
        youtube: file.size <= MAX_SIZES.youtube ? prev.youtube : false,
      }));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const togglePlatform = (platform) => {
    // Chỉ cho phép bật chọn nếu dung lượng file thỏa mãn kích thước tối đa
    if (videoFile && videoFile.size > MAX_SIZES[platform]) return;
    setSelectedPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  // --- VALIDATION ---
  const isFormValid = () => {
    if (!videoFile || caption.trim().length === 0) return false;
    if (!selectedPlatforms.tiktok && !selectedPlatforms.youtube) return false;

    // Kiểm tra chặn cứng nếu kích thước tệp vượt ngưỡng của nền tảng được chọn
    if (selectedPlatforms.tiktok && videoFile.size > MAX_SIZES.tiktok) return false;
    if (selectedPlatforms.youtube && videoFile.size > MAX_SIZES.youtube) return false;

    if (selectedPlatforms.tiktok) {
      if (!apiKeys.tiktok || !accountIds.tiktok) return false;
    }
    if (selectedPlatforms.youtube) {
      if (!apiKeys.youtube || !accountIds.youtube || title.trim().length === 0) return false;
    }
    return true;
  };

  // --- PUBLISH THỰC THI ---
  const handlePublish = async () => {
    if (!isFormValid() || uploading) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      setUploadStatus('1/2: Đang đồng bộ video từ Local Server...');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const fileName = videoFile.name;
      const publicHttpsUrl = `${MY_DOMAIN}/videos/${fileName}`;

      setUploadStatus('2/2: Đang phân phối dữ liệu đa nền tảng...');

      const platformsPayload = [];
      if (selectedPlatforms.tiktok) {
        platformsPayload.push({
          platform: 'tiktok',
          accountId: accountIds.tiktok.trim()
        });
      }
      if (selectedPlatforms.youtube) {
        platformsPayload.push({
          platform: 'youtube',
          accountId: accountIds.youtube.trim(),
          platformSpecificData: {
            title: title.trim(),
            visibility: youtubePrivacy.toLowerCase(),
          }
        });
      }

      const executionApiKey = selectedPlatforms.tiktok ? apiKeys.tiktok : apiKeys.youtube;

      const payload = {
        content: caption.trim(),
        mediaItems: [{ type: 'video', url: publicHttpsUrl }],
        platforms: platformsPayload,
        publishNow: true,
        ...(selectedPlatforms.tiktok ? {
          tiktokSettings: {
            privacy_level: tiktokPrivacy,
            allow_comment: allowComment,
            allow_duet: allowDuet,
            allow_stitch: allowStitch,
            video_cover_timestamp_ms: coverMs,
            content_preview_confirmed: true,
            express_consent_given: true,
            ...(aiDisclosure ? { video_made_with_ai: true } : {}),
          }
        } : {}),
        ...(selectedPlatforms.youtube ? {
          youtubeSettings: {
            is_shorts: isShort,
          }
        } : {})
      };

      const response = await fetch('https://zernio.com/api/v1/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${executionApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Lỗi từ server Zernio: ${response.status}`);
      }

      const postId = data?.post?._id || data?.post?.id || data?._id || data?.id;
      let postData = data?.post || data;

      if (postId) {
        setUploadStatus('Đang chờ các hệ thống tiếp nhận video...');
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

            const isTkDone = !selectedPlatforms.tiktok || tkData?.status === 'published' || tkData?.username || tkData?.accountId?.username;
            const isYtDone = !selectedPlatforms.youtube || ytData?.status === 'published' || ytData?.platformPostId;

            if (isTkDone && isYtDone) {
              postData = refreshed;
              break;
            } else {
              postData = refreshed;
            }
          } catch (_) { }
        }
      }

      setResult(postData);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi không xác định');
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const tiktokData = result?.platforms?.find(p => p.platform === 'tiktok');
  const youtubeData = result?.platforms?.find(p => p.platform === 'youtube');

  const tkUsername = tiktokData?.accountId?.username || tiktokData?.username || tiktokData?.tiktokUsername || null;
  const tiktokProfileUrl = tkUsername ? `https://www.tiktok.com/@${tkUsername}` : null;

  const ytVideoId = youtubeData?.platformPostId || null;
  const youtubeStudioUrl = ytVideoId ? `https://studio.youtube.com/video/${ytVideoId}/edit` : null;

  // Biến kiểm tra vượt dung lượng để hiển thị UI thông minh
  const isTiktokOversized = videoFile && videoFile.size > MAX_SIZES.tiktok;
  const isYoutubeOversized = videoFile && videoFile.size > MAX_SIZES.youtube;

  return (
    <div className="min-h-screen bg-[#0d0e15] text-slate-100 font-sans p-6 relative overflow-x-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-pink-500/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-red-400 flex items-center justify-center font-bold shadow-lg shadow-purple-500/20">
            🚀
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Creatimic Studio Multi-Poster</h1>
            <p className="text-[11px] text-slate-500">Phát hành Video đa nền tảng đồng thời</p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-400 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
          Cross-Platform Core
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* CỘT TRÁI (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-5 flex flex-col">

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span>📁</span> Tệp tin Video gốc
                </h2>
                {videoFile && (
                  <button
                    type="button"
                    onClick={() => document.getElementById('multi-file-input').click()}
                    className="text-[11px] font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 px-2.5 py-1 rounded-lg transition-all"
                  >
                    🔄 Đổi file khác
                  </button>
                )}
              </div>

              <input
                id="multi-file-input"
                type="file"
                accept="video/mp4,video/mov,video/webm"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
              />

              {!videoFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('multi-file-input').click()}
                  className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all min-h-[180px]
                    ${dragging ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl text-slate-400">📹</div>
                  <div>
                    <p className="font-medium text-xs text-slate-300">Kéo thả hoặc chọn file video</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Yêu cầu file lưu sẵn trong mục "public_videos"</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-950/60 border border-slate-800/60 p-2.5 rounded-xl flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center text-sm text-purple-400 shrink-0">🎬</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs text-slate-200 truncate">{videoFile.name}</p>
                      <p className="text-[10px] text-slate-500">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </div>
                  {videoUrl && (
                    <div className="bg-black border border-slate-800/80 rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[240px]">
                      <video src={videoUrl} controls className="w-full max-h-[400px] object-contain" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800/60 pt-4 space-y-4">
              {selectedPlatforms.youtube && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs text-slate-400 font-medium">Tiêu đề Video (YouTube Title) <span className="text-red-500">*</span></label>
                    <span className="text-[10px] font-mono text-slate-600">{title.length}/100</span>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value.slice(0, 100))}
                    placeholder="Nhập tiêu đề bắt buộc cho YouTube..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-red-500 focus:outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs text-slate-400 font-medium">Nội dung mô tả chính (Caption / Description)</label>
                  <span className="text-[10px] font-mono text-slate-600">{caption.length}/2200</span>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value.slice(0, 2200))}
                  placeholder="Viết mô tả hoặc caption nội dung chung cho các kênh..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs resize-none focus:border-purple-500 focus:outline-none transition-all"
                />
              </div>
            </div>

          </div>
        </div>

        {/* CỘT PHẢI (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-5">

            {/* CẢNH BÁO LỖI ENV */}
            {((selectedPlatforms.tiktok && (!apiKeys.tiktok || !accountIds.tiktok)) ||
              (selectedPlatforms.youtube && (!apiKeys.youtube || !accountIds.youtube))) && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-400">
                  ⚠️ <strong>Cảnh báo:</strong> Thông tin Account ID hoặc Token trong file <code>.env</code> bị thiếu cho nền tảng đã chọn.
                </div>
              )}

            {/* CHỌN KÊNH PHÂN PHỐI */}
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                <span>🔗</span> Chọn nền tảng phát hành
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {/* BUTTON TIKTOK */}
                <button
                  type="button"
                  disabled={isTiktokOversized}
                  onClick={() => togglePlatform('tiktok')}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all relative
                    ${isTiktokOversized ? 'border-slate-800/40 bg-slate-950/20 text-slate-600 cursor-not-allowed' :
                      selectedPlatforms.tiktok ? 'border-pink-500 bg-pink-500/10 text-pink-400' : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <span>🎵</span> TikTok
                    {isTiktokOversized && <span className="text-[9px] text-red-500 font-normal bg-red-500/10 px-1.5 py-0.5 rounded ml-1">Quá 4GB</span>}
                  </div>
                  {!isTiktokOversized && <input type="checkbox" checked={selectedPlatforms.tiktok} readOnly className="rounded accent-pink-500 mt-1 sm:mt-0" />}
                </button>

                {/* BUTTON YOUTUBE */}
                <button
                  type="button"
                  disabled={isYoutubeOversized}
                  onClick={() => togglePlatform('youtube')}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all relative
                    ${isYoutubeOversized ? 'border-slate-800/40 bg-slate-950/20 text-slate-600 cursor-not-allowed' :
                      selectedPlatforms.youtube ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <span>📺</span> YouTube
                    {isYoutubeOversized && <span className="text-[9px] text-red-500 font-normal bg-red-500/10 px-1.5 py-0.5 rounded ml-1">Quá 256GB</span>}
                  </div>
                  {!isYoutubeOversized && <input type="checkbox" checked={selectedPlatforms.youtube} readOnly className="rounded accent-red-500 mt-1 sm:mt-0" />}
                </button>
              </div>
            </div>

            {/* TIKTOK SETTINGS */}
            {selectedPlatforms.tiktok && !isTiktokOversized && (
              <div className="border-t border-slate-800/60 pt-4 space-y-3">
                <h3 className="text-[11px] font-bold text-pink-400 uppercase tracking-wider">Cấu hình riêng TikTok</h3>
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-medium">Bảo mật</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {PRIVACY_OPTIONS_TIKTOK.map(opt => (
                      <button
                        key={opt.value} type="button" onClick={() => setTiktokPrivacy(opt.value)}
                        className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-all
                          ${tiktokPrivacy === opt.value ? 'border-pink-500/60 bg-pink-500/10 text-pink-400 font-bold' : 'border-slate-800 bg-slate-950/30 text-slate-400'}`}
                      >
                        <span>{opt.icon}</span> <span className="truncate">{opt.label}</span>
                      </button>
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
                    <div key={idx} className="flex items-center justify-between text-[11px] py-0.5">
                      <span className="text-slate-400">{item.label}</span>
                      <input type="checkbox" checked={item.checked} onChange={e => item.onChange(e.target.checked)} className="w-3 h-3 accent-pink-500" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] bg-slate-950/30 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-400">Thời gian chọn ảnh bìa: <span className="font-mono text-pink-400 font-bold">{coverMs} ms</span></span>
                  <input type="range" min={0} max={10000} step={500} value={coverMs} onChange={e => setCoverMs(Number(e.target.value))} className="w-32 accent-pink-500" />
                </div>
              </div>
            )}

            {/* YOUTUBE SETTINGS */}
            {selectedPlatforms.youtube && !isYoutubeOversized && (
              <div className="border-t border-slate-800/60 pt-4 space-y-3">
                <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Cấu hình riêng YouTube</h3>
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-medium">Bảo mật</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRIVACY_OPTIONS_YOUTUBE.map(opt => (
                      <button
                        key={opt.value} type="button" onClick={() => setYoutubePrivacy(opt.value)}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-all
                          ${youtubePrivacy === opt.value ? 'border-red-500 bg-red-500/10 text-red-400 font-bold' : 'border-slate-800 bg-slate-950/30 text-slate-400'}`}
                      >
                        <span>{opt.icon}</span> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 flex items-center justify-between text-[11px]">
                  <div>
                    <p className="font-medium text-slate-300">Định dạng YouTube Shorts</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Ép luồng cho video dọc dưới 60 giây</p>
                  </div>
                  <input type="checkbox" checked={isShort} onChange={e => setIsShort(e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
                </div>
              </div>
            )}

            {/* BẢNG KẾT QUẢ ĐA KÊNH */}
            {result && (
              <div className="p-3.5 bg-purple-500/5 border border-purple-500/20 rounded-xl text-[11px] space-y-2">
                <p className="font-bold text-xs flex items-center gap-1.5 text-purple-400">
                  <span>🚀</span> Kết quả phân phối đa nền tảng
                </p>
                <div className="space-y-1 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/60 text-slate-300 font-mono text-[10px]">
                  <p>ID Giao dịch Zernio: <span className="text-white select-all">{result._id || result.id || 'N/A'}</span></p>

                  <p className="truncate">
                    Link video nội bộ:{' '}
                    <a
                      href={`${MY_DOMAIN}/videos/${videoFile?.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-red-400 hover:underline inline-block max-w-[70%] truncate align-bottom text-[10px]"
                    >
                      {MY_DOMAIN}/videos/{videoFile?.name}
                    </a>
                  </p>

                  {selectedPlatforms.tiktok && (
                    <p className="border-t border-slate-800/60 pt-1.5 mt-1.5 flex items-center flex-wrap gap-1">
                      <span>🎵 Kênh TikTok: </span>
                      {tiktokProfileUrl ? (
                        <a href={tiktokProfileUrl} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline font-bold">
                          {tiktokProfileUrl} ↗️
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">⏳ Đang đợi TikTok tiếp nhận...</span>
                      )}
                    </p>
                  )}

                  {selectedPlatforms.youtube && (
                    <p className="border-t border-slate-800/60 pt-1.5 mt-1.5 flex items-center flex-wrap gap-1">
                      <span>📺 YT Studio Edit: </span>
                      {youtubeStudioUrl ? (
                        <a href={youtubeStudioUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline font-bold">
                          {youtubeStudioUrl} ↗️
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">⏳ Đang đợi xử lý mã ID Video...</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 flex items-start gap-2">
                <span>⚠️</span> <p className="flex-1 leading-normal">{error}</p>
              </div>
            )}

            {/* BUTTON SUBMIT */}
            <button
              type="button" onClick={handlePublish} disabled={!isFormValid() || uploading}
              className="w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 relative overflow-hidden
                bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:brightness-110 active:scale-[0.99]
                disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none shadow-purple-900/20"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0115.41-4.14l1.42-1.42A10 10 0 003 12h1z" />
                  </svg>
                  <span className="font-medium text-xs normal-case tracking-normal text-white">{uploadStatus}</span>
                </div>
              ) : (
                <>
                  <span>⚡</span> Phát hành ngay đa nền tảng
                </>
              )}
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}