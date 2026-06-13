import React, { useState } from 'react';

const PRIVACY_OPTIONS = [
    { value: 'PUBLIC_TO_EVERYONE', label: 'Công khai', icon: '🌍' },
    { value: 'FOLLOWER_OF_CREATOR', label: 'Người theo dõi', icon: '👥' },
    { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Bạn bè', icon: '🤝' },
    { value: 'SELF_ONLY', label: 'Chỉ mình tôi', icon: '🔒' },
];

const MY_DOMAIN = import.meta.env?.VITE_REACT_URL || '';

export default function Dashboard() {
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [dragging, setDragging] = useState(false);

    const [apiKey] = useState(import.meta.env?.VITE_ZERNIO_API_KEY_TIKTOK || '');
    const [accountId] = useState(import.meta.env?.VITE_TIKTOK_ACCOUNT_ID || '');

    const [caption, setCaption] = useState('');
    const [privacy, setPrivacy] = useState('PUBLIC_TO_EVERYONE');
    const [allowComment, setAllowComment] = useState(true);
    const [allowDuet, setAllowDuet] = useState(true);
    const [allowStitch, setAllowStitch] = useState(true);
    const [aiDisclosure, setAiDisclosure] = useState(false);
    const [coverMs, setCoverMs] = useState(1000);

    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleFileSelect = (file) => {
        if (file && file.type.startsWith('video/')) {
            setVideoFile(file);
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
            setUploadStatus('1/2: Đang đồng bộ đường dẫn từ Local Server...');
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const fileName = videoFile.name;
            const publicHttpsUrl = `${MY_DOMAIN}/videos/${fileName}`;

            setUploadStatus('2/2: Đang gửi yêu cầu sang TikTok... Vui lòng không tắt máy.');

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
                throw new Error(data?.message || data?.error || `Lỗi từ server Zernio: ${response.status}`);
            }

            const postId = data?.post?._id || data?.post?.id || data?._id || data?.id;
            let postData = data?.post || data;

            // 🔄 VÒNG LẶP KIỂM TRA HÀNG CHỜ ĐỒNG BỘ DỮ LIỆU (Tối đa 12 lần x 5 giây)
            if (postId) {
                setUploadStatus('Đang chờ TikTok tiếp nhận video...');
                for (let i = 0; i < 12; i++) {
                    await new Promise(r => setTimeout(r, 5000));
                    try {
                        const pollRes = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
                            headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
                        });
                        const pollData = await pollRes.json();
                        const refreshed = pollData?.post || pollData;

                        // Khi trạng thái chuyển sang published hoặc tìm thấy thông tin định danh kênh
                        if (refreshed?.status === 'published' || refreshed?.platforms?.[0]?.username) {
                            postData = refreshed;
                            break;
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

    // Trích xuất thông tin tài khoản trực tiếp từ kết quả đồng bộ của Zernio
    const targetPlatform = result?.platforms?.[0];
    const tiktokUsername = targetPlatform?.accountId?.username || null;

    // Dựng dynamic link dẫn thẳng vào profile cá nhân của bạn
    const tiktokProfileUrl = tiktokUsername ? `https://www.tiktok.com/@${tiktokUsername}` : null;

    return (
        <div className="min-h-screen bg-[#0d0e15] text-slate-100 font-sans p-6 relative overflow-x-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-pink-500/5 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center font-bold shadow-lg shadow-pink-500/20">
                        ♬
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight">TikTok Auto-Poster</h1>
                        <p className="text-[11px] text-slate-500">Giao diện điều khiển tích hợp</p>
                    </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
                    Domain Connected
                </div>
            </div>

            {/* Main Workspace */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* BÊN TRÁI: KHU VỰC CHỌN VÀ PREVIEW FULL CONTAINER */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-4 flex flex-col min-h-[250px]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <span>📁</span> Media File
                            </h2>
                            {videoFile && (
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('video-file-input').click()}
                                    className="text-[11px] font-medium text-pink-400 bg-pink-500/10 border border-pink-500/20 hover:bg-pink-500/20 px-2.5 py-1 rounded-lg transition-all"
                                >
                                    🔄 Đổi file khác
                                </button>
                            )}
                        </div>

                        <input
                            id="video-file-input"
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
                                onClick={() => document.getElementById('video-file-input').click()}
                                className={`flex-1 border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all min-h-[180px]
                  ${dragging ? 'border-pink-500 bg-pink-500/10' : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'}`}
                            >
                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl text-slate-400">📹</div>
                                <div>
                                    <p className="font-medium text-xs text-slate-300">Kéo thả hoặc chọn file video</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Yêu cầu file nằm trong mục "public_videos"</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 flex-1 flex flex-col">
                                <div className="bg-slate-950/60 border border-slate-800/60 p-2.5 rounded-xl flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center text-sm text-emerald-400 shrink-0">🎬</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-xs text-slate-200 truncate">{videoFile.name}</p>
                                        <p className="text-[10px] text-slate-500">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                                    </div>
                                </div>

                                {videoUrl && (
                                    <div className="flex-1 bg-black border border-slate-800/80 rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[300px]">
                                        <video src={videoUrl} controls className="w-full h-full max-h-[500px] object-contain" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* BÊN PHẢI: CẤU HÌNH CHI TIẾT FORM & CONFIG */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-4">

                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2.5 flex items-center gap-2">
                            <span>⚙️</span> Cấu hình & Xuất bản bài viết
                        </h2>

                        {(!apiKey || !accountId) && (
                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-400">
                                ⚠️ <strong>Cảnh báo:</strong> Chưa cấu hình thông tin xác thực trong file <code>.env</code>.
                            </div>
                        )}

                        {/* Ô nhập Caption */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs text-slate-400 font-medium">Nội dung mô tả (Caption)</label>
                                <span className={`text-[10px] font-mono ${caption.length > 2100 ? 'text-red-400' : 'text-slate-600'}`}>{caption.length}/2200</span>
                            </div>
                            <textarea
                                value={caption}
                                onChange={e => setCaption(e.target.value.slice(0, 2200))}
                                placeholder="Viết caption cuốn hút... Thêm #hashtag để kéo tương tác"
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs resize-none focus:border-pink-500 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Quyền riêng tư */}
                        <div>
                            <label className="block text-xs text-slate-400 font-medium mb-1.5">Ai có thể xem video này?</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {PRIVACY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPrivacy(opt.value)}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl border text-[11px] font-medium transition-all
                      ${privacy === opt.value
                                                ? 'border-pink-500/60 bg-pink-500/10 text-pink-400 font-bold'
                                                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'}`}
                                    >
                                        <span>{opt.icon}</span> {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tương tác nâng cao */}
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                            <div className="flex items-center justify-between py-0.5">
                                <div>
                                    <p className="text-xs font-medium text-slate-300">Bình luận</p>
                                    <p className="text-[10px] text-slate-500">Mở tương tác thảo luận</p>
                                </div>
                                <input type="checkbox" checked={allowComment} onChange={e => setAllowComment(e.target.checked)} className="w-3.5 h-3.5 accent-pink-500 cursor-pointer" />
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <div>
                                    <p className="text-xs font-medium text-slate-300">Tính năng Duet</p>
                                    <p className="text-[10px] text-slate-500">Cho người khác quay cùng</p>
                                </div>
                                <input type="checkbox" checked={allowDuet} onChange={e => setAllowDuet(e.target.checked)} className="w-3.5 h-3.5 accent-pink-500 cursor-pointer" />
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <div>
                                    <p className="text-xs font-medium text-slate-300">Tính năng Stitch</p>
                                    <p className="text-[10px] text-slate-500">Cho trích dẫn đoạn clip</p>
                                </div>
                                <input type="checkbox" checked={allowStitch} onChange={e => setAllowStitch(e.target.checked)} className="w-3.5 h-3.5 accent-pink-500 cursor-pointer" />
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <div>
                                    <p className="text-xs font-medium text-slate-300">Gắn nhãn Nội dung AI</p>
                                    <p className="text-[10px] text-slate-500">Bắt buộc nếu làm bằng AI</p>
                                </div>
                                <input type="checkbox" checked={aiDisclosure} onChange={e => setAiDisclosure(e.target.checked)} className="w-3.5 h-3.5 accent-pink-500 cursor-pointer" />
                            </div>
                        </div>

                        {/* Slider Ảnh bìa */}
                        <div className="space-y-1">
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

                        {/* Panel lỗi */}
                        {error && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 flex items-start gap-2">
                                <span>⚠️</span> <p className="flex-1 leading-normal">{error}</p>
                            </div>
                        )}

                        {/* Thẻ hiển thị kết quả và Link trực tiếp tới Trang Cá Nhân TikTok */}
                        {result && (
                            <div className={`p-3.5 rounded-xl text-[11px] space-y-2 border transition-all duration-300
                ${tiktokProfileUrl
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>

                                <p className="font-bold text-xs flex items-center gap-1.5">
                                    {tiktokProfileUrl ? <span>✅ Đã gửi lệnh xuất bản bài viết thành công!</span> : <span>⏳ Đang xếp hàng xử lý trên TikTok...</span>}
                                </p>

                                <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 text-slate-300">
                                    <p>ID bài viết: <span className="font-mono text-white bg-slate-900 px-1 py-0.5 rounded text-[10px]">{result._id || result.id || 'N/A'}</span></p>

                                    <p className="truncate">
                                        URL Video nội bộ: {' '}
                                        <a
                                            href={`${MY_DOMAIN}/videos/${videoFile?.name}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono text-pink-400 hover:underline inline-block max-w-[75%] truncate align-bottom text-[10px]"
                                        >
                                            {MY_DOMAIN}/videos/{videoFile?.name}
                                        </a>
                                    </p>

                                    {/* ĐƯỜNG DẪN DIRECT THẲNG ĐẾN TRANG PROFILE TIKTOK CỦA BẠN */}
                                    <p className="truncate border-t border-slate-800/60 pt-1 mt-1 flex items-center gap-2 flex-wrap">
                                        <span>Link kênh TikTok:</span>
                                        {tiktokProfileUrl ? (
                                            <a
                                                href={tiktokProfileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-mono text-emerald-400 hover:underline inline-block text-[10px] font-bold"
                                            >
                                                {tiktokProfileUrl} ↗️
                                            </a>
                                        ) : (
                                            <span className="font-mono text-slate-500 text-[10px] italic">
                                                ⏳ Đang chờ hệ thống đồng bộ định danh kênh...
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {!tiktokProfileUrl && (
                                    <p className="text-slate-400 text-[10.5px] leading-relaxed">
                                        <strong>Lưu ý:</strong> Vui lòng giữ ngầm Terminal chạy hầm Cloudflare để TikTok tải xong video từ máy tính của bạn.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Nút trigger chính */}
                        <button
                            type="button"
                            onClick={handlePublish}
                            disabled={!isFormValid() || uploading}
                            className="w-full py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 relative overflow-hidden
                bg-gradient-to-r from-pink-600 via-red-500 to-orange-500 hover:brightness-110 active:scale-[0.99]
                disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none shadow-pink-900/20"
                        >
                            {uploading ? (
                                <div className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0115.41-4.14l1.42-1.42A10 10 0 003 12h1z" />
                                    </svg>
                                    <span className="font-medium text-xs normal-case tracking-normal">{uploadStatus}</span>
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