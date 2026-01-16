# Asset Guidelines - Hướng dẫn đặt tài nguyên

## Cấu trúc thư mục

```
src/assets/
├── character/    # Sprite nhân vật (player + AI)
├── structor/     # Công trình (giường, cửa, trụ phòng thủ)
├── monster/      # Quái vật
└── items/        # Vật phẩm (vàng, buff, drop)
```

## Cách đặt file

1. **Tải sprite** từ các nguồn miễn phí (xem bên dưới)
2. **Đặt file ảnh** (.png, .jpg, .webp, .gif) vào đúng thư mục
3. **Game tự động tải** ảnh đầu tiên trong mỗi thư mục
4. Nếu chưa có ảnh, game sẽ hiển thị hình thay thế (placeholder)

## Định dạng khuyến nghị

- **Kích thước sprite**: 32x32px hoặc 64x64px
- **Định dạng**: PNG với nền trong suốt
- **Phong cách**: Top-down hoặc side-view 2D pixel art

## Nguồn sprite miễn phí

| Tên | URL | Ghi chú |
|-----|-----|---------|
| Kenney Assets | https://kenney.nl/assets | CC0, chất lượng cao |
| OpenGameArt | https://opengameart.org | Nhiều lựa chọn |
| Itch.io Free Assets | https://itch.io/game-assets/free | Pack đa dạng |
| CraftPix Freebies | https://craftpix.net/freebies/ | Chuyên nghiệp |
| Game-Icons.net | https://game-icons.net | Icon cho UI |

## Ví dụ cách đặt

```
src/assets/character/
├── player.png      # Sprite người chơi chính
├── ai_1.png        # Sprite AI 1
├── ai_2.png        # Sprite AI 2
└── ...

src/assets/monster/
├── zombie.png      # Quái vật chính
└── ...

src/assets/structor/
├── bed.png         # Giường ngủ
├── door.png        # Cửa phòng
├── turret.png      # Trụ phòng thủ
└── ...

src/assets/items/
├── gold.png        # Vàng
├── potion.png      # Thuốc hồi
└── ...
```

## Lưu ý giấy phép

- Luôn kiểm tra giấy phép trước khi sử dụng
- CC0: Dùng tự do, không cần ghi nguồn
- CC-BY: Cần ghi nguồn tác giả
- Một số asset yêu cầu mua bản quyền thương mại
