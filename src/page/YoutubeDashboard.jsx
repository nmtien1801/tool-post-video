import React, { useState } from 'react';

const YOUTUBE_PRIVACY_OPTIONS = [
    { value: 'PUBLIC', label: 'Công khai', icon: '🌍' },
    { value: 'UNLISTED', label: 'Không công khai', icon: '🔗' },
    { value: 'PRIVATE', label: 'Riêng tư', icon: '🔒' },
];

const MY_DOMAIN = import.meta.env?.VITE_REACT_URL || '';

export default function YoutubeDashboard() {
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [dragging, setDragging] = useState(false);

    const [apiKey] = useState(import.meta.env?.VITE_ZERNIO_API_KEY_YOUTUBE || '');
    const [accountId] = useState(import.meta.env?.VITE_YOUTUBE_ACCOUNT_ID || '');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [privacy, setPrivacy] = useState('PUBLIC');
    const [isShort, setIsShort] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showDebug, setShowDebug] = useState(false);

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
            title.trim().length > 0 &&
            apiKey.length > 0 &&
            accountId.length > 0
        );
    };

    const handlePublish = async () => {
        if (!isFormValid() || uploading) return;
        setUploading(true);
        setError(null);
        setResult(null);
        setShowDebug(false);

        try {
            setUploadStatus('1/2: Đang đồng bộ video từ Local Server...');
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const fileName = videoFile.name;
            const publicHttpsUrl = `${MY_DOMAIN}/videos/${fileName}`;

            setUploadStatus('2/2: Đang gửi yêu cầu sang YouTube... Vui lòng không tắt máy.');

            const payload = {
                title: title.trim(),
                content: description.trim(),
                mediaItems: [{ type: 'video', url: publicHttpsUrl }],
                platforms: [{
                    platform: 'youtube',
                    accountId: accountId.trim(),
                }],
                youtubeSettings: {
                    privacy_status: privacy,
                    is_shorts: isShort,
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

            if (postId) {
                setUploadStatus('Đang chờ YouTube cấp link video...');
                for (let i = 0; i < 12; i++) {
                    await new Promise(r => setTimeout(r, 5000));
                    try {
                        const pollRes = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
                            headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
                        });
                        const pollData = await pollRes.json();
                        const refreshed = pollData?.post || pollData;

                        if (refreshed?.platforms?.[0]?.platformPostId) {
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

    // 🎯 TRÍCH XUẤT TRỰC TIẾP VÀ NỐI CHUỖI THÀNH LINK STUDIO EDIT THEO YÊU CẦU CỦA BẠN
    const targetPlatform = result?.platforms?.[0];
    const ytVideoId = targetPlatform?.platformPostId || null;

    // Nối chuỗi tạo link chỉnh sửa YouTube Studio trực tiếp
    const ytStudioEditUrl = ytVideoId ? `https://studio.youtube.com/video/${ytVideoId}/edit` : null;

    return (
        <div className="min-h-screen bg-[#0d0e15] text-slate-100 font-sans p-6 relative overflow-x-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-red-500/5 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 blur-[150px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-orange-500 to-red-400 flex items-center justify-center font-bold shadow-lg shadow-red-500/20">
                        📺
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight">YouTube Auto-Poster</h1>
                        <p className="text-[11px] text-slate-500">Giao diện điều khiển & Tải lên YouTube Hub</p>
                    </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
                    Domain Connected
                </div>
            </div>

            {/* Main Workspace */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* BÊN TRÁI */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-4 flex flex-col min-h-[250px]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <span>📁</span> YouTube Video File
                            </h2>
                            {videoFile && (
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('youtube-file-input').click()}
                                    className="text-[11px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 px-2.5 py-1 rounded-lg transition-all"
                                >
                                    🔄 Đổi file khác
                                </button>
                            )}
                        </div>

                        <input
                            id="youtube-file-input"
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
                                onClick={() => document.getElementById('youtube-file-input').click()}
                                className={`flex-1 border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all min-h-[180px]
                                  ${dragging ? 'border-red-500 bg-red-500/10' : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'}`}
                            >
                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl text-slate-400">📹</div>
                                <div>
                                    <p className="font-medium text-xs text-slate-300">Kéo thả hoặc chọn file video bài đăng</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">File tải lên cần được lưu trong mục "public_videos"</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 flex-1 flex flex-col">
                                <div className="bg-slate-950/60 border border-slate-800/60 p-2.5 rounded-xl flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center text-sm text-red-400 shrink-0">🎬</div>
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

                {/* BÊN PHẢI */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-4">

                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2.5 flex items-center gap-2">
                            <span>⚙️</span> Chi tiết thông số YouTube Video
                        </h2>

                        {/* Input Tiêu đề */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs text-slate-400 font-medium">Tiêu đề Video (Title) <span className="text-red-500">*</span></label>
                                <span className="text-[10px] font-mono text-slate-600">{title.length}/100</span>
                            </div>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value.slice(0, 100))}
                                placeholder="Nhập tiêu đề video thu hút người xem..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-red-500 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Input Mô tả */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs text-slate-400 font-medium">Mô tả Video (Description)</label>
                                <span className="text-[10px] font-mono text-slate-600">{description.length}/5000</span>
                            </div>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value.slice(0, 5000))}
                                placeholder="Nhập nội dung mô tả chi tiết cho video..."
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs resize-none focus:border-red-500 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Bộ chọn Chế độ hiển thị */}
                        <div>
                            <label className="block text-xs text-slate-400 font-medium mb-1.5">Trạng thái hiển thị video?</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {YOUTUBE_PRIVACY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPrivacy(opt.value)}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl border text-[11px] font-medium transition-all
                                          ${privacy === opt.value
                                                ? 'border-red-500 bg-red-500/10 text-red-400 font-bold'
                                                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'}`}
                                    >
                                        <span>{opt.icon}</span> {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Shorts check */}
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div>
                                    <p className="text-xs font-medium text-slate-300">Định dạng YouTube Shorts</p>
                                    <p className="text-[10px] text-slate-500">Bật nếu video của bạn là khung dọc (9:16) và dưới 60 giây</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isShort}
                                    onChange={e => setIsShort(e.target.checked)}
                                    className="w-4 h-4 accent-red-500 cursor-pointer"
                                />
                            </label>
                        </div>

                        {/* Thẻ hiển thị kết quả */}
                        {result && (
                            <div className={`p-3.5 rounded-xl text-[11px] space-y-2 border transition-colors duration-300
                                ${ytStudioEditUrl
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>

                                <p className="font-bold text-xs flex items-center gap-1.5">
                                    {ytStudioEditUrl ? <span>✅ Đã lấy được liên kết quản trị YouTube!</span> : <span>⏳ Đang chờ YouTube xử lý dữ liệu...</span>}
                                </p>

                                <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 text-slate-300">
                                    <p>ID bài viết Zernio: <span className="font-mono text-white bg-slate-900 px-1 py-0.5 rounded text-[10px]">{result._id || result.id || 'N/A'}</span></p>

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

                                    {/* TRẢ VỀ LINK EDIT THEO ĐÚNG ĐỊNH DẠNG BẠN CẦN */}
                                    <p className="truncate border-t border-slate-800/60 pt-1 mt-1 flex items-center gap-2 flex-wrap">
                                        <span>Link chỉnh sửa YT Studio:</span>
                                        {ytStudioEditUrl ? (
                                            <a
                                                href={ytStudioEditUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-mono text-emerald-400 hover:underline inline-block max-w-[65%] truncate align-bottom text-[10px] font-bold"
                                            >
                                                {ytStudioEditUrl}
                                            </a>
                                        ) : (
                                            <span className="font-mono text-slate-500 text-[10px] italic">
                                                ⏳ Đang chờ hệ thống đồng bộ link Studio...
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {/* Debug Panel */}
                                <div className="border-t border-slate-800/40 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDebug(v => !v)}
                                        className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
                                    >
                                        {showDebug ? '▲ Ẩn' : '▼ Xem'} raw response (debug)
                                    </button>
                                    {showDebug && (
                                        <pre className="mt-1.5 text-[9px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-2 overflow-auto max-h-40 leading-relaxed font-mono">
                                            {JSON.stringify(result, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Nút bấm hành động */}
                        <button
                            type="button"
                            onClick={handlePublish}
                            disabled={!isFormValid() || uploading}
                            className="w-full py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 relative overflow-hidden
                                bg-gradient-to-r from-red-700 via-red-600 to-orange-600 hover:brightness-110 active:scale-[0.99]
                                disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none shadow-red-900/20"
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
                                    <span>🔺</span> Phát hành ngay lên YouTube Studio
                                </>
                            )}
                        </button>

                    </div>
                </div>

            </div>
        </div>
    );
}