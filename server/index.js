import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3001;
const isProd = process.env.NODE_ENV !== "development";

// Khôi phục lại biến __dirname vì ES Module không có sẵn biến này
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());

// Biến thư mục public_videos ở ngoài thư mục gốc thành link tĩnh /videos
const publicVideosPath = isProd
  ? path.join(process.resourcesPath, "public_videos") // Khi đã build: nằm ở thư mục resources lộ thiên
  : path.join(__dirname, "../public_videos");
  
app.use("/videos", express.static(publicVideosPath));

app.listen(PORT, () => {
  console.log(
    `🚀 [Backend] Server video đang chạy tại: http://localhost:${PORT}`,
  );
});
