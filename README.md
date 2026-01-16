# Survival IDE - Game sinh tồn phòng thủ 2D

## Mục tiêu

Game sinh tồn tự động lấy cảm hứng từ cơ chế "ngủ để nhận tài nguyên". Người chơi thật cùng 4 AI ở trong các phòng riêng. Khi ngủ, người chơi tạo vàng để nâng cấp cửa, xây trụ phòng thủ và sửa chữa trước khi quái vật phá cửa.

## Công nghệ

- Vue 3 + TypeScript + Vite
- Canvas 2D (nhân vật di chuyển thật)
- Tailwind CSS
- PWA (offline-ready)
- Web Audio API (âm thanh + hiệu ứng)

## Tính năng

- **Trang chủ**: Bắt đầu chơi, cài đặt âm thanh, hướng dẫn tài nguyên
- **Trang game**: Canvas 2D với nhân vật di chuyển, hiệu ứng hạt, âm thanh
- **Phân trang rõ ràng**: HomePage và GamePage tách biệt

## Gameplay cơ bản

- 1 người chơi thật + 4 AI
- Mỗi phòng có cửa với máu riêng
- Quái vật chọn phòng yếu nhất để tấn công theo chu kỳ
- Người chơi ngủ để tạo vàng và nâng cấp phòng
- Nhân vật và quái vật di chuyển thật trên canvas 2D
- Thắng khi quái vật bị tiêu diệt, thua khi tất cả người chơi chết

## Chạy dự án

```bash
npm install
npm run dev
```

## Cấu trúc dự án

```
src/
├── App.vue                    # Router giữa các trang
├── pages/
│   ├── HomePage.vue           # Trang chủ (menu, cài đặt)
│   └── GamePage.vue           # Trang game (canvas 2D)
├── composables/
│   ├── useAudio.ts            # Quản lý âm thanh
│   └── useAssets.ts           # Quản lý sprite/asset
├── types/
│   └── game.ts                # Type definitions
└── assets/
    ├── character/             # Sprite nhân vật
    ├── structor/              # Công trình
    ├── monster/               # Quái vật
    └── items/                 # Vật phẩm
```

## Hướng dẫn đặt tài nguyên

Xem chi tiết tại: [src/assets/README.md](src/assets/README.md)

**Tóm tắt:**
1. Tải sprite từ các nguồn miễn phí (Kenney, OpenGameArt, Itch.io)
2. Đặt file ảnh vào đúng thư mục trong `src/assets/`
3. Game tự động tải ảnh đầu tiên trong mỗi thư mục

## Nguồn sprite miễn phí

- https://kenney.nl/assets (CC0)
- https://opengameart.org
- https://itch.io/game-assets/free
- https://craftpix.net/freebies/

## Mở rộng

- Hệ thống vật phẩm, kỹ năng, bẫy
- AI nâng cao (đổi mục tiêu, phối hợp phòng thủ)
- Thêm loại quái vật, boss
- Bảng xếp hạng, lưu tiến trình
