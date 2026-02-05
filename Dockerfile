FROM node:18-bullseye-slim

WORKDIR /app

RUN npm install -g pnpm@10.12.4

COPY package.json pnpm-lock.yaml ./

# Tạo user với UID cụ thể (thường là 1000 cho user đầu tiên trên Linux)
RUN groupadd -g 1000 botuser && \
    useradd -u 1000 -g botuser -m botuser

# Cấp quyền cho user botuser vào thư mục app
RUN chown -R botuser:botuser /app

RUN pnpm install --frozen-lockfile --prod

# Copy toàn bộ code vào (nếu không dùng volume mount toàn bộ folder)
COPY . .
RUN chown -R botuser:botuser /app

USER botuser

CMD ["pnpm", "start"]