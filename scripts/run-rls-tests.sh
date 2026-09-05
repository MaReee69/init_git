#!/usr/bin/env bash
# ローカルのPostgreSQL(psql)に対してRLSポリシーの権限テストを実行する。
# 実Supabaseプロジェクトは使わず、auth.uid()/auth.role()を模したスタブ関数(supabase/tests/_local_test_setup.sql)
# を使って本物のRow Level Securityを検証する。
#
# 前提: ローカルにPostgreSQLサーバーが起動していること（例: `service postgresql start`）。
# 使い方: DB_SUPERUSER=postgres ./scripts/run-rls-tests.sh

set -euo pipefail

DB_NAME="${DB_NAME:-skimatch_rls_test}"
DB_SUPERUSER="${DB_SUPERUSER:-postgres}"
# postgresql の peer認証を使うため、OSユーザーpostgresとして接続する。
# 既にpostgresユーザーとしてシェルを実行している場合は SKIP_SUDO=1 を指定する。
PSQL="sudo -u ${DB_SUPERUSER} psql"
if [ "${SKIP_SUDO:-0}" = "1" ] || [ "$(id -un)" = "${DB_SUPERUSER}" ]; then
  PSQL="psql"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Recreating test database: ${DB_NAME}"
${PSQL} -c "DROP DATABASE IF EXISTS ${DB_NAME};"
${PSQL} -c "CREATE DATABASE ${DB_NAME};"

echo "==> Applying local auth stub (auth.uid/auth.role, roles, grants)"
${PSQL} -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${ROOT_DIR}/supabase/tests/_local_test_setup.sql"

echo "==> Applying migrations"
for f in "${ROOT_DIR}"/supabase/migrations/*.sql; do
  echo "   - ${f}"
  ${PSQL} -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${f}"
done

echo "==> Granting table access to authenticated/anon (mirrors Supabase platform defaults)"
${PSQL} -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant usage on all sequences in schema public to authenticated;
"

echo "==> Running RLS test suite"
${PSQL} -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${ROOT_DIR}/supabase/tests/rls_test.sql" 2>&1 | tee /tmp/skimatch-rls-test-output.log | grep -E "PASS|FAIL" || true

echo ""
FAIL_COUNT=$(grep -c "FAIL" /tmp/skimatch-rls-test-output.log || true)
PASS_COUNT=$(grep -c "PASS" /tmp/skimatch-rls-test-output.log || true)
echo "==> Result: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"

if [ "${FAIL_COUNT}" -ne 0 ]; then
  exit 1
fi
