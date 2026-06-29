import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
  protocol,
  net,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { execFile, spawn } from "child_process";
import http from "http"; // Sử dụng module http để polling kiểm tra cổng 3001 trực tiếp

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;

// ─── LÁCH BẢO MẬT MẠNG NỘI BỘ (SỬA LỖI FAILED TO FETCH) ───
app.commandLine.appendSwitch(
  "disable-features",
  "BlockInsecurePrivateNetworkRequests",
);
app.commandLine.appendSwitch("disable-web-security");

// ─────────────────────────────────────────────
// HELPER & PROCESS REFS
// ─────────────────────────────────────────────
const fixPathForAsar = (p) => p.replace("app.asar", "app.asar.unpacked");

let backendProcess = null;
let tunnelProcess = null;
let mainWindow;

// ─── GIẢI QUYẾT TIMEOUT: KIỂM TRA CỔNG 3001 TRƯỚC KHI MỞ GIAO DIỆN ───
function waitForBackend(url, retries = 40, interval = 300) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      const req = http.get(url, { timeout: 200 }, (res) => {
        resolve();
      });

      req.on("error", () => {
        if (n <= 0) {
          reject(new Error("Backend Server không phản hồi kịp thời."));
        } else {
          setTimeout(() => check(n - 1), interval);
        }
      });

      req.on("timeout", () => {
        req.destroy();
      });

      req.end();
    };
    check(retries);
  });
}

// ─────────────────────────────────────────────
// FFMPEG PATHS
// ─────────────────────────────────────────────
let ffmpegPath = ffmpegStatic;
let ffprobePath = ffprobeStatic.path;

if (!isDev) {
  const prodFfmpeg = path.join(process.resourcesPath, "ffmpeg.exe");
  const prodFfprobe = path.join(process.resourcesPath, "ffprobe.exe");
  if (fs.existsSync(prodFfmpeg)) ffmpegPath = prodFfmpeg;
  if (fs.existsSync(prodFfprobe)) ffprobePath = prodFfprobe;
}

ffmpeg.setFfmpegPath(fixPathForAsar(ffmpegPath));
ffmpeg.setFfprobePath(fixPathForAsar(ffprobePath));

// ─────────────────────────────────────────────
// BACKEND SERVER (CHUẨN KIẾN TRÚC ASAR NỘI BỘ)
// ─────────────────────────────────────────────
function startBackend() {
  const serverPath = path.join(__dirname, "../server/index.js");

  if (app.isPackaged) {
    const runtimePath = process.execPath;
    backendProcess = spawn(runtimePath, [serverPath], {
      stdio: "pipe",
      detached: false,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
      },
    });
  } else {
    backendProcess = spawn("node", [serverPath], {
      stdio: "pipe",
      detached: false,
    });
  }

  // Luồng hứng log đẩy lên Console F12
  backendProcess.stdout?.on("data", (d) => {
    const logMsg = d.toString().trim();
    console.log("[Backend]", logMsg);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend-log", {
        type: "info",
        text: logMsg,
      });
    }
  });

  backendProcess.stderr?.on("data", (d) => {
    const errorMsg = d.toString().trim();
    console.error("[Backend ERR]", errorMsg);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend-log", {
        type: "error",
        text: errorMsg,
      });
    }
  });

  backendProcess.on("exit", (code) => {
    console.log(`[Backend] Exited with code ${code}`);
  });

  backendProcess.on("error", (err) => {
    console.error("[Backend] Spawn error:", err);
  });
}

// ─────────────────────────────────────────────
// CLOUDFLARE TUNNEL
// ─────────────────────────────────────────────
function startTunnel() {
  const cloudflaredPath = app.isPackaged
    ? path.join(process.resourcesPath, "cloudflared.exe")
    : path.join(__dirname, "../cloudflared.exe");

  if (!fs.existsSync(cloudflaredPath)) {
    console.warn("[Tunnel] cloudflared.exe không tìm thấy:", cloudflaredPath);
    return;
  }

  tunnelProcess = spawn(
    cloudflaredPath,
    ["tunnel", "run", "--url", "http://localhost:3001", "postVideo"],
    { stdio: "pipe", detached: false },
  );

  tunnelProcess.stdout?.on("data", (d) =>
    console.log("[Tunnel]", d.toString().trim()),
  );
  tunnelProcess.stderr?.on("data", (d) =>
    console.log("[Tunnel]", d.toString().trim()),
  );
  tunnelProcess.on("error", (err) =>
    console.error("[Tunnel] Spawn error:", err),
  );
  tunnelProcess.on("exit", (code) =>
    console.log(`[Tunnel] Exited with code ${code}`),
  );
}

// ─────────────────────────────────────────────
// WINDOW
// ─────────────────────────────────────────────
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 850,
    title: "Cut video - Pro Video Tool",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  const startUrl = isDev
    ? "http://localhost:5173"
    : `file://${path.join(__dirname, "../dist/index.html")}`;

  mainWindow.loadURL(startUrl);

  if (isDev) mainWindow.webContents.openDevTools();

  // ─── Menu Bar ───
  const menuTemplate = [
    {
      label: "File",
      submenu: [
        {
          label: "Thoát",
          role: "quit",
          accelerator: process.platform === "darwin" ? "Command+Q" : "Ctrl+Q",
        },
      ],
    },
    {
      label: "Dashboard", // Viết hoa chữ cái đầu cho đẹp UI
      click: (menuItem, focusedWindow) => {
        if (focusedWindow)
          focusedWindow.webContents.send("navigate", "/dashboard");
      },
    },
    {
      label: "Quản trị dữ liệu",
      click: (menuItem, focusedWindow) => {
        if (focusedWindow)
          focusedWindow.webContents.send("navigate", "/import-sheet");
      },
    },
  ];

  if (isDev) {
    menuTemplate.push({
      label: "Dev",
      submenu: [
        { label: "Reload", role: "reload" },
        { label: "DevTools", role: "toggleDevTools" },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

// ─────────────────────────────────────────────
// APP LIFECYCLE
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
  if (!isDev) {
    startBackend();
    startTunnel();

    try {
      await waitForBackend("http://localhost:3001/");
    } catch (e) {
      console.error("Luồng khởi động bị treo:", e.message);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  backendProcess?.kill();
  tunnelProcess?.kill();
});

// ─────────────────────────────────────────────
// HW ENCODER DETECTION (GPU)
// ─────────────────────────────────────────────
let cachedEncoder = null;
const HW_CANDIDATES = [
  {
    name: "h264_nvenc",
    args: [
      "-f",
      "lavfi",
      "-i",
      "nullsrc=s=64x64:d=1",
      "-c:v",
      "h264_nvenc",
      "-f",
      "null",
      "-",
    ],
  },
  {
    name: "hevc_videotoolbox",
    args: [
      "-f",
      "lavfi",
      "-i",
      "nullsrc=s=64x64:d=1",
      "-c:v",
      "hevc_videotoolbox",
      "-f",
      "null",
      "-",
    ],
  },
  {
    name: "h264_videotoolbox",
    args: [
      "-f",
      "lavfi",
      "-i",
      "nullsrc=s=64x64:d=1",
      "-c:v",
      "h264_videotoolbox",
      "-f",
      "null",
      "-",
    ],
  },
  {
    name: "h264_amf",
    args: [
      "-f",
      "lavfi",
      "-i",
      "nullsrc=s=64x64:d=1",
      "-c:v",
      "h264_amf",
      "-f",
      "null",
      "-",
    ],
  },
  {
    name: "h264_qsv",
    args: [
      "-f",
      "lavfi",
      "-i",
      "nullsrc=s=64x64:d=1",
      "-c:v",
      "h264_qsv",
      "-f",
      "null",
      "-",
    ],
  },
];

const detectHwEncoder = async () => {
  if (cachedEncoder) return cachedEncoder;
  const bin = fixPathForAsar(ffmpegPath);

  for (const candidate of HW_CANDIDATES) {
    try {
      await new Promise((resolve, reject) => {
        execFile(bin, ["-y", ...candidate.args], { timeout: 8000 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      cachedEncoder = candidate.name;
      return cachedEncoder;
    } catch (e) {
      /* thử encoder tiếp theo */
    }
  }

  cachedEncoder = "libx264";
  return cachedEncoder;
};

const getEncoderPreset = (encoder) => {
  if (encoder === "h264_nvenc")
    return ["-preset", "p4", "-rc", "vbr", "-cq", "23", "-b:v", "0"];
  if (["h264_videotoolbox", "hevc_videotoolbox"].includes(encoder))
    return ["-q:v", "65", "-realtime", "false"];
  if (encoder === "h264_amf")
    return ["-quality", "balanced", "-rc", "cqp", "-qp_i", "23", "-qp_p", "23"];
  if (encoder === "h264_qsv") return ["-preset", "faster", "-q", "23"];
  return ["-preset", "ultrafast", "-crf", "23"];
};

// ─────────────────────────────────────────────
// TIỆN ÍCH & XỬ LÝ SONG SONG
// ─────────────────────────────────────────────
const timemarkToSeconds = (timemark) => {
  if (!timemark || typeof timemark !== "string") return 0;
  const parts = timemark.split(":");
  return parts.length === 3
    ? parseFloat(parts[0]) * 3600 +
        parseFloat(parts[1]) * 60 +
        parseFloat(parts[2])
    : parseFloat(timemark) || 0;
};

const runConcurrent = async (tasks, maxWorkers) => {
  const results = [],
    executing = [];
  for (const task of tasks) {
    const p = task();
    results.push(p);
    if (maxWorkers <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= maxWorkers) await Promise.race(executing);
    }
  }
  return Promise.all(results);
};

class ProgressMerger {
  constructor(segments, onProgress) {
    this.durations = segments.map((s) => s.duration);
    this.totalDuration = this.durations.reduce((a, b) => a + b, 0) || 1;
    this.pcts = segments.map(() => 0);
    this.speeds = segments.map(() => 1);
    this.onProgress = onProgress;
  }

  update(idx, pct, speed) {
    this.pcts[idx] = pct;
    this.speeds[idx] = Math.max(speed, 0.01);
    if (this.onProgress) {
      const doneSeconds = this.durations.reduce(
        (sum, dur, i) => sum + (this.pcts[i] / 100) * dur,
        0,
      );
      const overallPct = Math.min(
        Math.floor((doneSeconds / this.totalDuration) * 100),
        99,
      );
      const avgSpeed =
        this.speeds.reduce((a, b) => a + b, 0) / this.speeds.length;
      const etaSeconds = (this.totalDuration - doneSeconds) / avgSpeed;
      this.onProgress(overallPct, Math.max(etaSeconds, 0));
    }
  }
}

const runFfmpeg = (args, segmentDuration, onProgress) => {
  return new Promise((resolve, reject) => {
    const bin = fixPathForAsar(ffmpegPath);
    let lastSpeed = 1.0;

    const proc = execFile(
      bin,
      args,
      { maxBuffer: 100 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr?.slice(-800) || error.message));
        else resolve();
      },
    );

    proc.stderr.on("data", (data) => {
      const line = data.toString();
      const matchSpeed = line.match(/speed=\s*([\d.]+)x?/);
      if (matchSpeed) lastSpeed = Math.max(parseFloat(matchSpeed[1]), 0.01);
      const matchTime = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/);
      if (matchTime && onProgress && segmentDuration > 0) {
        const elapsed = timemarkToSeconds(matchTime[1]);
        const pct = Math.min(Math.round((elapsed / segmentDuration) * 100), 99);
        onProgress(pct, lastSpeed);
      }
    });
  });
};

// ─────────────────────────────────────────────
// IPC HANDLERS
// ─────────────────────────────────────────────
ipcMain.handle("detect-hw-encoder", async () => await detectHwEncoder());

ipcMain.handle("select-video", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
    ],
  });
  if (result.canceled) return { success: false };
  return {
    success: true,
    filePath: result.filePaths[0],
    fileName: path.basename(result.filePaths[0]),
  };
});

ipcMain.handle("get-video-duration", async (event, inputPath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) resolve({ success: false, duration: 0 });
      else
        resolve({
          success: true,
          duration: Math.floor(metadata.format.duration),
        });
    });
  });
});

ipcMain.handle(
  "trim-multiple-segments",
  async (event, { inputPath, segments }) => {
    try {
      const outputBase = path.join(
        os.homedir(),
        "Downloads",
        "Video_Export_Trims",
      );
      if (!fs.existsSync(outputBase))
        fs.mkdirSync(outputBase, { recursive: true });

      const merger = new ProgressMerger(segments, (pct, eta) => {
        mainWindow.webContents.send("trim-progress", { percent: pct, eta });
      });

      const tasks = segments.map((seg, index) => async () => {
        const outPath = path.join(outputBase, `cut_${Date.now()}_${index}.mp4`);
        const args = [
          "-y",
          "-ss",
          seg.startTime.toString(),
          "-t",
          seg.duration.toString(),
          "-i",
          inputPath,
          "-c",
          "copy",
          "-map",
          "0",
          "-movflags",
          "+faststart",
          outPath,
        ];
        await runFfmpeg(args, seg.duration, (pct, speed) =>
          merger.update(index, pct, speed),
        );
      });

      await runConcurrent(tasks, Math.min(segments.length, 4));
      mainWindow.webContents.send("trim-progress", { percent: 100, eta: 0 });
      shell.openPath(outputBase);
      return { success: true, message: "Cắt hoàn tất!" };
    } catch (error) {
      return { success: false, message: "Lỗi cắt video: " + error.message };
    }
  },
);

ipcMain.handle(
  "export-with-aspect-ratio",
  async (event, { inputPath, aspectRatio, segments }) => {
    try {
      const encoder = await detectHwEncoder();
      const isGpu = encoder !== "libx264";
      const outW = aspectRatio === "9:16" ? 1080 : 1920;
      const outH = aspectRatio === "9:16" ? 1920 : 1080;
      const inputResolved = path.resolve(inputPath);
      const ratioTag = aspectRatio === "9:16" ? "9x16" : "16x9";
      const outputFolder = path.join(
        os.homedir(),
        "Downloads",
        `Video_Export_${ratioTag}_${Date.now()}`,
      );
      if (!fs.existsSync(outputFolder))
        fs.mkdirSync(outputFolder, { recursive: true });

      const hasAudio = await new Promise((resolve) => {
        ffmpeg.ffprobe(inputResolved, (err, meta) =>
          resolve(
            meta?.streams?.some((s) => s.codec_type === "audio") || false,
          ),
        );
      });

      const bgW = Math.floor(outW / 4),
        bgH = Math.floor(outH / 4);
      const filterComplex =
        `[0:v]split=2[bg_in][fg_in];` +
        `[bg_in]scale=${bgW}:${bgH}:force_original_aspect_ratio=increase,crop=${bgW}:${bgH},boxblur=10:5,scale=${outW}:${outH}[bg_blur];` +
        `[fg_in]scale=${outW}:${outH}:force_original_aspect_ratio=decrease[fg_scaled];` +
        `[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2[outv]`;

      const merger = new ProgressMerger(segments, (pct, eta) => {
        mainWindow.webContents.send("export-progress", { percent: pct, eta });
      });

      const tasks = segments.map((seg, index) => async () => {
        const outPath = path.join(outputFolder, `segment_${index + 1}.mp4`);
        const args = [
          "-y",
          "-ss",
          seg.startTime.toString(),
          "-t",
          seg.duration.toString(),
          "-i",
          inputResolved,
          "-filter_complex",
          filterComplex,
          "-map",
          "[outv]",
        ];
        if (hasAudio)
          args.push("-map", "0:a:0?", "-c:a", "aac", "-b:a", "192k");
        args.push("-c:v", encoder, ...getEncoderPreset(encoder));
        if (!isGpu)
          args.push(
            "-threads",
            Math.max(1, Math.floor(os.cpus().length / 2)).toString(),
          );
        args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath);

        await runFfmpeg(args, seg.duration, (pct, speed) =>
          merger.update(index, pct, speed),
        );
      });

      await runConcurrent(tasks, Math.min(segments.length, isGpu ? 4 : 2));
      mainWindow.webContents.send("export-progress", { percent: 100, eta: 0 });
      shell.openPath(outputFolder);
      return {
        success: true,
        message: `Xuất thành công ${segments.length} đoạn!`,
      };
    } catch (error) {
      return { success: false, message: "Lỗi xuất video: " + error.message };
    }
  },
);

ipcMain.handle("call-backend-api", async (event, { endpoint, body }) => {
  try {
    const response = await net.fetch(`http://localhost:3001${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
