import { contextBridge, ipcRenderer } from "electron";

// Lưu ref listener để có thể removeListener đúng cách
let navigateListener = null;

contextBridge.exposeInMainWorld("electronAPI", {
  // Lấy thông tin Hardware Encoder (GPU) từ hệ thống
  detectHwEncoder: () => ipcRenderer.invoke("detect-hw-encoder"),

  // Chọn file video từ máy tính
  selectVideo: () => ipcRenderer.invoke("select-video"),

  // Lấy thời lượng (duration) của video
  getVideoDuration: (filePath) =>
    ipcRenderer.invoke("get-video-duration", filePath),

  // Cắt nhanh video (Stream Copy - Không encode lại)
  trimMultipleSegments: (data) =>
    ipcRenderer.invoke("trim-multiple-segments", data),

  // Lắng nghe tiến độ cắt video (nhận percent và eta)
  onTrimProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on("trim-progress", listener);
    return () => ipcRenderer.removeListener("trim-progress", listener);
  },

  // Xuất video có Blur background (Có re-encode + GPU)
  exportWithAspectRatio: (data) =>
    ipcRenderer.invoke("export-with-aspect-ratio", data),

  // Lắng nghe tiến độ xuất Blur (nhận percent và eta)
  onExportProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on("export-progress", listener);
    return () => ipcRenderer.removeListener("export-progress", listener);
  },

  // Lắng nghe navigate từ menu bar (Main process gửi xuống)
  onNavigate: (callback) => {
    // Xóa listener cũ nếu có để tránh duplicate
    if (navigateListener) {
      ipcRenderer.removeListener("navigate", navigateListener);
    }
    navigateListener = (_event, path) => callback(path);
    ipcRenderer.on("navigate", navigateListener);
  },

  // Cleanup navigate listener (gọi trong useEffect cleanup)
  removeNavigateListener: () => {
    if (navigateListener) {
      ipcRenderer.removeListener("navigate", navigateListener);
      navigateListener = null;
    }
  },
});
