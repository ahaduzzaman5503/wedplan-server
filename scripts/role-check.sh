#!/bin/bash
# Usage:
#   export ADMIN="token" VENDOR="token" CUSTOMER="token"
#   bash scripts/role-check.sh

API="${API_URL:-https://wedplan-server-six.vercel.app}"
ZERO="000000000000000000000000"
pass=0
fail=0

check() {
  local name="$1" expected="$2" method="$3" path="$4" token="$5" body="$6"
  local args=(-s -o /dev/null -w "%{http_code}" -X "$method" "$API$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  local status
  status=$(curl "${args[@]}")
  if [ "$status" = "$expected" ]; then
    echo "PASS  $name ($status)"
    pass=$((pass + 1))
  else
    echo "FAIL  $name (expected $expected, got $status)"
    fail=$((fail + 1))
  fi
}

if [ -z "$ADMIN" ] || [ -z "$VENDOR" ] || [ -z "$CUSTOMER" ]; then
  echo "Please export ADMIN, VENDOR and CUSTOMER tokens first."
  exit 1
fi

echo "--- Public ---"
check "services list is public" 200 GET "/api/services"
check "invalid service id" 400 GET "/api/services/abc"
check "webhook rejects unsigned requests" 400 POST "/api/webhooks/stripe" "" '{}'

echo "--- No token (401) ---"
check "GET me" 401 GET "/api/me"
check "POST service" 401 POST "/api/services" "" '{}'
check "GET my services" 401 GET "/api/services/mine"
check "GET my bookings" 401 GET "/api/bookings/mine"
check "GET vendor bookings" 401 GET "/api/bookings/vendor"
check "POST booking" 401 POST "/api/bookings" "" '{}'
check "PATCH profile" 401 PATCH "/api/profile" "" '{}'
check "POST checkout" 401 POST "/api/payments/create-checkout-session"
check "GET admin stats" 401 GET "/api/admin/stats"
check "GET admin users" 401 GET "/api/admin/users"

echo "--- Fake token (401) ---"
check "GET me with fake token" 401 GET "/api/me" "abc.def.ghi"

echo "--- Customer must be refused (403) ---"
check "customer POST service" 403 POST "/api/services" "$CUSTOMER" '{}'
check "customer GET my services" 403 GET "/api/services/mine" "$CUSTOMER"
check "customer DELETE service" 403 DELETE "/api/services/$ZERO" "$CUSTOMER"
check "customer GET vendor bookings" 403 GET "/api/bookings/vendor" "$CUSTOMER"
check "customer decide booking" 403 PATCH "/api/bookings/$ZERO/status" "$CUSTOMER" '{"status":"accepted"}'
check "customer POST checkout" 403 POST "/api/payments/create-checkout-session" "$CUSTOMER"
check "customer GET admin stats" 403 GET "/api/admin/stats" "$CUSTOMER"
check "customer GET admin users" 403 GET "/api/admin/users" "$CUSTOMER"
check "customer block user" 403 PATCH "/api/admin/users/$ZERO/block" "$CUSTOMER" '{"isBlocked":true}'
check "customer delete service (admin)" 403 DELETE "/api/admin/services/$ZERO" "$CUSTOMER"

echo "--- Vendor must be refused (403) ---"
check "vendor POST booking" 403 POST "/api/bookings" "$VENDOR" '{}'
check "vendor GET my bookings" 403 GET "/api/bookings/mine" "$VENDOR"
check "vendor cancel booking" 403 PATCH "/api/bookings/$ZERO/cancel" "$VENDOR"
check "vendor GET admin stats" 403 GET "/api/admin/stats" "$VENDOR"
check "vendor GET admin services" 403 GET "/api/admin/services" "$VENDOR"
check "vendor delete service (admin)" 403 DELETE "/api/admin/services/$ZERO" "$VENDOR"

echo "--- Admin must be refused (403) ---"
check "admin POST service" 403 POST "/api/services" "$ADMIN" '{}'
check "admin POST booking" 403 POST "/api/bookings" "$ADMIN" '{}'
check "admin GET vendor bookings" 403 GET "/api/bookings/vendor" "$ADMIN"
check "admin POST checkout" 403 POST "/api/payments/create-checkout-session" "$ADMIN"

echo "--- Allowed requests (200) ---"
check "customer GET me" 200 GET "/api/me" "$CUSTOMER"
check "customer GET my bookings" 200 GET "/api/bookings/mine" "$CUSTOMER"
check "vendor GET my services" 200 GET "/api/services/mine" "$VENDOR"
check "vendor GET vendor bookings" 200 GET "/api/bookings/vendor" "$VENDOR"
check "admin GET stats" 200 GET "/api/admin/stats" "$ADMIN"
check "admin GET users" 200 GET "/api/admin/users" "$ADMIN"
check "admin GET services" 200 GET "/api/admin/services" "$ADMIN"
check "admin GET transactions" 200 GET "/api/admin/transactions" "$ADMIN"

echo "--- Ownership and missing records (404, nothing changes) ---"
check "vendor DELETE missing service" 404 DELETE "/api/services/$ZERO" "$VENDOR"
check "vendor decide missing booking" 404 PATCH "/api/bookings/$ZERO/status" "$VENDOR" '{"status":"accepted"}'
check "customer cancel missing booking" 404 PATCH "/api/bookings/$ZERO/cancel" "$CUSTOMER"
check "no route to edit a transaction" 404 PATCH "/api/admin/transactions/$ZERO" "$ADMIN" '{"status":"paid"}'

echo
echo "Passed: $pass   Failed: $fail"
[ "$fail" -eq 0 ]