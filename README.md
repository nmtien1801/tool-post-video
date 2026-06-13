# Cài đặt Electron
npm install --save-dev electron electron-builder wait-on cross-env

# cloudflared connect domain
.\cloudflared tunnel login (chạy 1 lần)
.\cloudflared.exe tunnel create postVideo
.\cloudflared.exe tunnel route dns postVideo video.cmicstudio.shop

# build
npm run build
cd C:\Users\Admin\Desktop\test\my-tool
npm run dist

# dev
npm run dev

cloudflared tunnel localhost:3001 --zone videocuatoi.com --hostname video.videocuatoi.com

