import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const app = express();
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Kiểm tra môi trường đóng gói đóng gói của Electron
const isProd =
  __dirname.includes("app.asar") || process.resourcesPath !== undefined;
const resourcesDir = process.resourcesPath ? process.resourcesPath : __dirname;

const publicVideosPath = isProd
  ? path.join(resourcesDir, "public_videos")
  : path.join(__dirname, "../public_videos");

if (!fs.existsSync(publicVideosPath)) {
  fs.mkdirSync(publicVideosPath, { recursive: true });
}

app.use("/videos", express.static(publicVideosPath));
app.use(cors());
app.use(express.json());

// ─── ĐÃ SỬA CHUẨN ĐƯỜNG DẪN: Đọc đúng file credentials.json khi build ───
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

function getGoogleAuthClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null; // Không throw Error làm sập nguồn Node nữa
  }
  return new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Thêm Endpoint gốc phục vụ luồng check sức khỏe của file main.js
app.get("/", (req, res) => {
  res.send("Backend Matrix Engine is Ready.");
});

// API Đọc Dữ Liệu Sheet
app.post("/api/sheets/read", async (req, res) => {
  const { sheetId, range } = req.body;
  if (!sheetId || !range) {
    return res
      .status(400)
      .json({ error: "Thiếu tham số bắt buộc: sheetId hoặc range." });
  }

  try {
    const auth = getGoogleAuthClient();
    if (!auth) {
      return res
        .status(500)
        .json({
          error: `Không tìm thấy file credentials.json cấu hình tại: ${CREDENTIALS_PATH}`,
        });
    }

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Read Sheet Error:", error);
    res
      .status(500)
      .json({
        error: "Backend kết nối Google Sheet thất bại: " + error.message,
      });
  }
});

// API Cập Nhật Dữ Liệu Sheet
app.post("/api/sheets/update", async (req, res) => {
  const { sheetId, range, values } = req.body;
  if (!sheetId || !range || !values) {
    return res
      .status(400)
      .json({ error: "Thiếu tham số dữ liệu cập nhật Sheet." });
  }

  try {
    const auth = getGoogleAuthClient();
    if (!auth) {
      return res
        .status(500)
        .json({
          error: `Không tìm thấy file credentials.json cấu hình tại: ${CREDENTIALS_PATH}`,
        });
    }

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    res.json(response.data);
  } catch (error) {
    console.error("Update Sheet Error:", error);
    res
      .status(500)
      .json({ error: "Backend ghi dữ liệu Sheet thất bại: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `🚀 [Backend Direct Client] Server đang chạy ổn định tại: http://localhost:${PORT}`,
  );
});