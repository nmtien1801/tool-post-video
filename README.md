# Doc: 
https://docs.zernio.com/platforms/youtube
1. Vào zernio tạo account lấy key ytb, tiktok
2. vào gg console lấy api sheet, api gg, api json-service
3. Mua tên miền

# Cài đặt Electron
npm install --save-dev electron electron-builder wait-on cross-env

# cloudflared connect domain
.\cloudflared tunnel login (chạy 1 lần)
.\cloudflared.exe tunnel create postVideo
.\cloudflared.exe tunnel route dns postVideo video.cmicstudio.shop

# build
npm run build
cd C:\Users\Admin\Desktop\test\tool\tool-post-video
npm run dist

# dev
npm run dev


