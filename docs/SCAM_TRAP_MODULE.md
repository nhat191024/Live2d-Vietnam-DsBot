# Scam trap

Kênh bẫy dùng để phát hiện tài khoản có thể đã bị chiếm quyền. **Bất kỳ tài khoản nào gửi tin nhắn vào kênh đã cấu hình đều bị xóa tin nhắn và ban tạm**, kể cả moderator hoặc admin. Đặt kênh ở nơi không có người dùng bình thường cần gửi tin nhắn; chỉ admin nên được phép thay đổi cấu hình bot.

## Thiết lập

Bot cần quyền `Ban Members` trên server và `Manage Messages` trong kênh bẫy. Nếu dùng kênh báo cáo, bot cần `Send Messages` trong kênh đó. Role của bot phải cao hơn role của tài khoản cần ban.

- `/scam-trap setup trap:#kenh-bay minutes:60 alerts:#bao-admin` — bật bẫy, thời gian ban và kênh báo cáo. `alerts` có thể bỏ trống.
- `/scam-trap status` — xem cấu hình hiện tại.
- `/scam-trap disable` — tắt bẫy; các lệnh ban tạm đang chờ vẫn được gỡ khi hết hạn.

Thời gian ban cho phép từ 1 đến 10080 phút. Lịch gỡ ban lưu trong MySQL, bot kiểm tra mỗi 30 giây, nên vẫn tiếp tục xử lý sau khi khởi động lại. Nếu bot mất quyền gỡ ban hoặc rời server, lịch sẽ được giữ lại để thử lại. Khi ban thành công nhưng không lưu được lịch gỡ ban, bot thử gỡ ban ngay và báo lỗi.

Kênh báo cáo nên là kênh riêng của admin. Báo cáo chứa ID tài khoản, kết quả xóa và ban; không lặp lại nội dung tin nhắn scam.
