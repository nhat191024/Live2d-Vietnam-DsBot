# Scam trap

Kênh bẫy dùng để phát hiện tài khoản có thể đã bị chiếm quyền. **Bất kỳ tài khoản nào gửi tin nhắn vào kênh đã cấu hình đều bị xóa tin nhắn và ban tạm**, kể cả moderator hoặc admin. Đặt kênh ở nơi không có người dùng bình thường cần gửi tin nhắn; chỉ admin nên được phép thay đổi cấu hình bot.

Bot cũng theo dõi tin nhắn của từng user trên toàn server đã cấu hình. Mặc định, nếu user gửi ở **5 kênh khác nhau trong vòng 5 giây**, bot sẽ xóa các tin đã ghi nhận trong khoảng này, ban tạm cùng thời lượng và gửi báo cáo nếu có kênh báo admin. Tin trong cùng một kênh chỉ tính là một kênh; tin từ bot khác không kích hoạt điều kiện spam. Lịch sử theo dõi nằm trong bộ nhớ, nên được bắt đầu lại khi bot khởi động lại.

## Thiết lập

Bot cần quyền `Ban Members` trên server và `Manage Messages` trong kênh bẫy lẫn các kênh cần xóa tin spam. Bot phải xem được các kênh đó để nhận sự kiện tin nhắn. Nếu dùng kênh báo cáo, bot cần `Send Messages` trong kênh đó. Role của bot phải cao hơn role của tài khoản cần ban.

- `/scam-trap setup trap:#kenh-bay minutes:60 alerts:#bao-admin` — bật bẫy, thời gian ban và kênh báo cáo. `alerts` có thể bỏ trống.
- `/scam-trap trap channel:#kenh-bay enabled:true` — đổi kênh bẫy hoặc chỉ bật/tắt riêng phần kênh bẫy. Có thể chỉ truyền một trong hai tùy chọn.
- `/scam-trap spam enabled:true channels:5 seconds:5` — bật/tắt hoặc đổi riêng ngưỡng spam (2–20 kênh, 1–60 giây). Có thể chỉ truyền các tùy chọn cần đổi.
- `/scam-trap ban minutes:60` — đổi thời gian ban tạm cho cả hai phần.
- `/scam-trap alerts channel:#bao-admin` — đặt kênh báo admin; `/scam-trap alerts-off` — bỏ kênh báo.
- `/scam-trap status` — xem cấu hình hiện tại.
- `/scam-trap disable` — tắt cả hai phần; `/scam-trap enable` — bật lại các phần đã chọn. Các lệnh ban tạm đang chờ vẫn được gỡ khi hết hạn.

`setup` giữ kênh báo admin hiện tại khi bỏ trống `alerts`. Các lệnh chỉnh riêng không thay đổi các thiết lập khác. Admin có thể dùng `/scam-trap spam` để bật phát hiện spam mà không cần đặt kênh bẫy.

Thời gian ban cho phép từ 1 đến 10080 phút. Lịch gỡ ban lưu trong MySQL, bot kiểm tra mỗi 30 giây, nên vẫn tiếp tục xử lý sau khi khởi động lại. Nếu bot mất quyền gỡ ban hoặc rời server, lịch sẽ được giữ lại để thử lại. Khi ban thành công nhưng không lưu được lịch gỡ ban, bot thử gỡ ban ngay và báo lỗi.

Kênh báo cáo nên là kênh riêng của admin. Báo cáo chứa ID tài khoản, kết quả xóa và ban; không lặp lại nội dung tin nhắn scam.
