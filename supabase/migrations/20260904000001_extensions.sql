-- 拡張機能の有効化
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "vector";   -- pgvector（Phase2以降の意味検索・埋め込み用）
