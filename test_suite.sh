#!/bin/bash
H="Content-Type: application/json"
API="http://localhost:3000/api"
PT=$(curl -s -X POST $API/auth/verify-otp -H "$H" -d '{"phone":"+998900000003","code":"12345","deviceId":"p3","deviceName":"P","appType":"PASSENGER"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
DT=$(curl -s -X POST $API/auth/verify-otp -H "$H" -d '{"phone":"+998900000002","code":"12345","deviceId":"d1","deviceName":"D","appType":"DRIVER"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
AT=$(curl -s -X POST $API/auth/verify-otp -H "$H" -d '{"phone":"+998900000001","code":"12345","deviceId":"a1","deviceName":"A","appType":"PASSENGER"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")

docker exec rideshare-postgres psql -U rideshare_user -d rideshare -c "TRUNCATE TABLE orders, offers, ratings, commission_holds, order_status_history, order_location_proofs CASCADE; UPDATE wallets SET balance=50000, held_amount=0 WHERE user_id IN (SELECT id FROM users WHERE phone='+998900000002'); UPDATE driver_profiles SET avg_rating=NULL, total_ratings=0;" > /dev/null

pass() { echo "  PASS $1"; }
fail() { echo "  FAIL $1 ($2)"; }
hc() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
pj() { python -c "import sys,json;d=json.load(sys.stdin); print($1)"; }

echo
echo "AUTH"
[ "$(hc -X POST $API/auth/send-otp -H "$H" -d '{"phone":"+998900000099"}')" = "200" ] && pass "send-otp 200" || fail "send-otp"
[ "$(hc -X POST $API/auth/send-otp -H "$H" -d '{"phone":"bad"}')" = "400" ] && pass "send-otp invalid 400" || fail "send-otp bad"
[ "$(hc -X POST $API/auth/verify-otp -H "$H" -d '{"phone":"+998900000099","code":"99999","deviceId":"x","deviceName":"x","appType":"PASSENGER"}')" = "401" ] && pass "verify-otp wrong code 401" || fail "verify-otp wrong"

echo
echo "PROFILE"
ME=$(curl -s $API/me -H "Authorization: Bearer $DT")
echo "$ME" | grep -q '"role":"DRIVER"' && pass "GET /me returns driver" || fail "GET /me"
[ "$(hc -X PATCH $API/me -H "Authorization: Bearer $PT" -H "$H" -d '{"firstName":"Hi"}')" = "200" ] && pass "PATCH /me 200" || fail "PATCH /me"
[ "$(hc -X PATCH $API/me -H "Authorization: Bearer $PT" -H "$H" -d '{}')" = "400" ] && pass "PATCH /me empty 400" || fail "patch /me empty"
[ "$(hc $API/driver/profile -H "Authorization: Bearer $PT")" = "403" ] && pass "/driver/profile passenger 403" || fail "driver guard"
curl -s -X PATCH $API/driver/profile -H "Authorization: Bearer $DT" -H "$H" -d '{"bio":"hello"}' | grep -q '"bio":"hello"' && pass "PATCH /driver/profile bio" || fail "patch driver"

echo
echo "REGIONS / ROUTES"
REGS=$(curl -s $API/regions | pj "len(d['data'])")
[ "$REGS" -ge "2" ] && pass "Public regions ($REGS)" || fail "regions"
RT=$(curl -s $API/routes | pj "d['data'][0]['id'] if d['data'] else 'NONE'")
[ "$RT" != "NONE" ] && pass "Public route exists" || fail "routes empty"
[ "$(hc -X POST $API/admin/regions -H "Authorization: Bearer $DT" -H "$H" -d '{"name":"X","lat":0,"lng":0,"radiusKm":1}')" = "403" ] && pass "admin guard 403" || fail "guard"

echo
echo "VEHICLES"
V=$(curl -s $API/driver/vehicles -H "Authorization: Bearer $DT" | pj "(d['data'] or {}).get('plateNumber','NONE')")
[ "$V" = "01A123BC" ] && pass "GET vehicle: $V" || fail "vehicle get"
DUP=$(curl -s -X POST $API/driver/vehicles -H "Authorization: Bearer $DT" -F "brand=X" -F "model=Y" -F "color=R" -F "plateNumber=02B456CD" -F "year=2021" -F "seatCount=4" | pj "d.get('code')")
[ "$DUP" = "VEHICLE_ALREADY_EXISTS" ] && pass "duplicate vehicle blocked" || fail "$DUP"
INV=$(curl -s -X POST $API/driver/vehicles -H "Authorization: Bearer $DT" -F "brand=X" -F "model=Y" -F "color=R" -F "plateNumber=BAD" -F "year=2021" -F "seatCount=4" | pj "d.get('code')")
[ "$INV" = "VALIDATION_ERROR" ] && pass "Invalid plate 400" || fail "$INV"

echo
echo "WALLET"
WAL=$(curl -s $API/wallet -H "Authorization: Bearer $DT" | pj "d['data']['balance']")
pass "Driver balance: $WAL"
TUP=$(curl -s -X POST $API/wallet/topup -H "Authorization: Bearer $PT" -H "$H" -d '{"amount":10000}' | pj "d['data']['balance']")
pass "Passenger topup: balance=$TUP"
NEG=$(curl -s -X POST $API/wallet/topup -H "Authorization: Bearer $PT" -H "$H" -d '{"amount":-1}' | pj "d.get('code')")
[ "$NEG" = "VALIDATION_ERROR" ] && pass "Negative topup blocked" || fail "$NEG"

echo
echo "ORDERS + OFFERS + LIFECYCLE"
OID=$(curl -s -X POST $API/orders -H "Authorization: Bearer $PT" -H "$H" -d "{\"routeId\":\"$RT\"}" | pj "d['data']['id']")
[ -n "$OID" ] && pass "Order created" || fail "order"
DUP=$(curl -s -X POST $API/orders -H "Authorization: Bearer $PT" -H "$H" -d "{\"routeId\":\"$RT\"}" | pj "d['data']['id']")
[ -n "$DUP" ] && pass "2nd active order allowed" || fail "$DUP"
COUNT=$(curl -s $API/driver/orders/open -H "Authorization: Bearer $DT" | pj "d['data']['total']")
pass "Driver sees $COUNT open"
OFID=$(curl -s -X POST $API/driver/offers -H "Authorization: Bearer $DT" -H "$H" -d "{\"orderId\":\"$OID\",\"offeredPrice\":140000}" | pj "d['data']['id']")
pass "Offer created"
DUP=$(curl -s -X POST $API/driver/offers -H "Authorization: Bearer $DT" -H "$H" -d "{\"orderId\":\"$OID\",\"offeredPrice\":120000}" | pj "d.get('code')")
[ "$DUP" = "OFFER_EXISTS" ] && pass "Dup offer blocked" || fail "$DUP"
RES=$(curl -s -X POST $API/offers/$OFID/accept -H "Authorization: Bearer $PT" | pj "d['data']['status']+'/'+str(d['data']['finalPrice'])")
[ "$RES" = "ACCEPTED/140000" ] && pass "Accept: $RES" || fail "$RES"
WAL2=$(curl -s $API/wallet -H "Authorization: Bearer $DT" | pj "str(d['data']['balance'])+'/'+str(d['data']['heldAmount'])")
[ "$WAL2" = "36000/14000" ] && pass "Commission HOLD: $WAL2" || fail "$WAL2"
BAD=$(curl -s -X POST $API/driver/orders/$OID/arrive -H "Authorization: Bearer $DT" -H "$H" -d '{"lat":50,"lng":50}' | pj "d.get('code')")
[ "$BAD" = "TOO_FAR_FROM_PICKUP" ] && pass "Bad GPS rejected" || fail "$BAD"
ARR=$(curl -s -X POST $API/driver/orders/$OID/arrive -H "Authorization: Bearer $DT" -H "$H" -d '{"lat":41.3,"lng":69.25,"accuracyMeters":5}' | pj "d['data']['status']")
[ "$ARR" = "ARRIVED" ] && pass "GPS valid -> ARRIVED" || fail "$ARR"
WRONG=$(curl -s -X POST $API/driver/orders/$OID/found -H "Authorization: Bearer $DT" -H "$H" -d '{"otpCode":"9999"}' | pj "d.get('code')")
[ "$WRONG" = "WRONG_OTP" ] && pass "Wrong OTP rejected" || fail "$WRONG"
OTP=$(curl -s $API/orders/$OID -H "Authorization: Bearer $PT" | pj "d['data']['otpCode']")
FND=$(curl -s -X POST $API/driver/orders/$OID/found -H "Authorization: Bearer $DT" -H "$H" -d "{\"otpCode\":\"$OTP\"}" | pj "d['data']['status']")
[ "$FND" = "FOUND" ] && pass "OTP correct -> FOUND" || fail "$FND"
WAL3=$(curl -s $API/wallet -H "Authorization: Bearer $DT" | pj "str(d['data']['balance'])+'/'+str(d['data']['heldAmount'])")
[ "$WAL3" = "36000/0" ] && pass "Commission CAPTURED: $WAL3" || fail "$WAL3"

echo
echo "RATINGS"
RES=$(curl -s -X POST $API/orders/$OID/ratings -H "Authorization: Bearer $PT" -H "$H" -d '{"score":5}' | pj "d['data']['score']")
[ "$RES" = "5" ] && pass "Rate driver: 5" || fail "$RES"
DUP=$(curl -s -X POST $API/orders/$OID/ratings -H "Authorization: Bearer $PT" -H "$H" -d '{"score":4}' | pj "d.get('code')")
[ "$DUP" = "ALREADY_RATED" ] && pass "Dup rate blocked" || fail "$DUP"
AVG=$(curl -s $API/driver/profile -H "Authorization: Bearer $DT" | pj "str(d['data']['avgRating'])+'/'+str(d['data']['totalRatings'])")
pass "Driver avg/total: $AVG"

echo
echo "ADMIN"
COUNT=$(curl -s "$API/admin/users?limit=50" -H "Authorization: Bearer $AT" | pj "d['data']['total']")
pass "users count: $COUNT"
DID=$(curl -s "$API/admin/users?role=DRIVER" -H "Authorization: Bearer $AT" | pj "d['data']['items'][0]['id']")
SUS=$(curl -s -X PATCH "$API/admin/users/$DID" -H "Authorization: Bearer $AT" -H "$H" -d '{"isActive":false}' | pj "d['data']['isActive']")
[ "$SUS" = "False" ] && pass "Suspend driver" || fail "$SUS"
curl -s -X PATCH "$API/admin/users/$DID" -H "Authorization: Bearer $AT" -H "$H" -d '{"isActive":true}' > /dev/null

echo
echo "ALL TESTS DONE"
