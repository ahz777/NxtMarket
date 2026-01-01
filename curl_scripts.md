# Requirements

install jq for better JSON format

```bash
choco install jq -y
jq --version
```

# Base URL

```bash
BASE=http://localhost:5000
HEALTH_BASE=http://localhost:5001
```

# NxtMarket cURL Scripts

## Auth

### Register (user/vendor/admin):

```bash
curl -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test-user@nxt.com",
    "password": "user@123",
    "role": "user"
  }' | jq
```

Expected: 201 with { user, token }.

## Login:

### Admin

```bash
curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@nxt.com",
    "password":"Admin@123"
  }' | jq
```

Expected: 200 with { user, token }.

### Vendor

```bash
curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"vendor1@nxt.com",
    "password":"Vendor@123"
  }' | jq
```

Expected: 200 with { user, token }.

### User

```bash
curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"alice@nxt.com",
    "password":"User@123"
  }' | jq
```

Expected: 200 with { user, token }.

set variables

```bash
ADMIN_TOKEN=
VENDOR_TOKEN=
USER_TOKEN=
ADMIN_ID=
VENDOR_ID=
USER_ID=
```

## Call protected route

```bash
curl "$BASE/api/whoami" \
  -H "Authorization: Bearer $VENDOR_TOKEN" | jq
```

Expected: 200 with { user: { id, role, email } }.

## Products

### Create product

```bash
curl -X POST "$BASE/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -d '{
    "sku": "NX-2001",
    "title": "Nxt Mouse",
    "description": "Wireless",
    "price": 25,
    "stock": 50,
    "categories": ["electronics","accessories"],
    "images": ["public/images/mo1.png"]
  }' | jq
```

```bash
curl -X POST "$BASE/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -d '{
    "sku": "nx-2002",
    "title": "Nxt Keyboard",
    "description": "Mechanical keyboard",
    "price": 120,
    "stock": 15,
    "categories": ["electronics", "keyboards"],
    "images": ["public/images/kb1.png"]
  }' | jq
```

```bash
curl -X POST "$BASE/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -d '{
    "sku": "test",
    "title": "test product",
    "description": "",
    "price": 99,
    "stock": 1,
    "categories": [],
    "images": []
  }' | jq
```

Expected: 201 with { "product" : {} }

### Default list

```bash
curl "$BASE/api/products" | jq
```

Expected: 200 with { "items" : [ {item-1}, {item-2}, ...], list-details }

set variables

```bash
PRODUCT1001ID=
PRODUCT1002ID=
PRODUCT2001ID=
PRODUCT2002ID=
PRODUCT3001ID=
TESTPRODUCTID=
```

### List Search + filters:

```bash
curl "$BASE/api/products?q=keyboard&minPrice=50&maxPrice=200&category=keyboards&sort=price_asc&page=1&limit=12" | jq
```

Expected: 200 with { "items" : [ {filtered-item-1}, {filtered-item-2}, ...], list-details }

### In-stock only

```bash
curl "$BASE/api/products?inStock=true" | jq
```

Expected: 200 with { "items" : [ {item-1}, {item-2}, ...], list-details }

### Get product details:

```bash
curl "$BASE/api/products/$PRODUCT1001ID" | jq
```

Expected: 200 with { "product" : {product-details} }

### Update product (vendor/admin):

```bash
curl -X PATCH "$BASE/api/products/$PRODUCT1001ID" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":24,"stock":60}' | jq
```

Expected: 200 with { "product" : {product-details-with-updated-price&stock} }

### Delete product (vendor/admin):

```bash
curl -X DELETE "$BASE/api/products/$TESTPRODUCTID" \
  -H "Authorization: Bearer $VENDOR_TOKEN" | jq
```

Expected: 200 with { "deleted":true }

### Add review (user):

```bash
curl -X POST "$BASE/api/products/$PRODUCT1001ID/reviews" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating":5,"comment":"Great product!"}' | jq
```

Expected: 201 with { "product" : {product-details-with-updated-rating&reviews} }

### Upload and attach images to an existing product (vendor/admin):

```bash
curl -X POST "$BASE/api/uploads/products/$PRODUCT1002ID" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -F "images=@public/images/keyboard.jpg;type=image/jpeg" | jq
```

Expected: 201 with { product: { id, images: [...] } }.

## Orders

### User: Add item to cart

```bash
curl -X POST "$BASE/api/cart/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"productId\":\"$PRODUCT1001ID\",\"qty\":2}" | jq
```

Expected: 201 with {"cart" : {id, userId, items:[{productId:{},qty}, {}],...}}

### User: View cart

```bash
curl "$BASE/api/cart" \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```

Expected: 200 with {"cart" : {id, userId, items:[{productId:{},qty}, {}],...}}

### User: Checkout cart (creates SQL order, clears cart, decrements Mongo stock):

set variables

```bash
IDEM_KEY1=checkout-001
IDEM_KEY2=checkout-002
IDEM_KEY3=checkout-003
IDEM_KEY4=checkout-004
```

### cart checkout

```bash
curl -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: $IDEM_KEY1" \
  -H "Content-Type: application/json" | jq
```

Expected 201 with { orderId, status, total }.

### User: Make more orders

Order 2

```bash
curl -X POST "$BASE/api/cart/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"productId\": \"$PRODUCT2001ID\",\"qty\": 4}" | jq
```

```bash
curl -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: $IDEM_KEY2" \
  -H "Content-Type: application/json" | jq
```

Order 3

```bash
curl -X POST "$BASE/api/cart/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"productId\": \"$PRODUCT2001ID\",\"qty\": 2}" | jq
```

```bash
curl -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: $IDEM_KEY3" \
  -H "Content-Type: application/json" | jq
```

Order 4

```bash
curl -X POST "$BASE/api/cart/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"productId\": \"$PRODUCT2001ID\",\"qty\": 2}" | jq
```

```bash
curl -X POST "$BASE/api/cart/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"productId\": \"$PRODUCT2002ID\",\"qty\": 3}" | jq
```

```bash
curl -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: $IDEM_KEY4" \
  -H "Content-Type: application/json" | jq
```

### User: List my orders:

```bash
curl "$BASE/api/orders/my" \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```

set variable

```bash
ORDER01ID=
ORDER02ID=
ORDER03ID=
ORDER04ID=
```

### User/Admin: Order detail:

```bash
curl "$BASE/api/orders/$ORDER01ID" \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```

### User: Cancel order (PENDING only):

```bash
curl -X PATCH "$BASE/api/orders/$ORDER01ID/cancel" \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```

Expected:

- order becomes `CANCELLED`
- product stock increments back

### Admin: Update order status:

```bash
curl -X PATCH "$BASE/api/orders/$ORDER02ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"SHIPPED"}' | jq
```

### Vendor: list orders containing vendor items

```bash
curl "$BASE/api/vendor/orders?page=1&limit=20" \
  -H "Authorization: Bearer $VENDOR_TOKEN" | jq
```

### Vendor: get vendor-scoped details for a specific order

```bash
curl "$BASE/api/vendor/orders/$ORDER02ID" \
  -H "Authorization: Bearer $VENDOR_TOKEN" | jq
```

### Admin: list orders

```bash
curl "$BASE/api/admin/orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

### Admin: order detail:

```bash
curl "$BASE/api/admin/orders/$ORDER03ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

### Admin: basic metrics

```bash
curl "$BASE/api/admin/metrics" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

## Idempotent checkout

Use the same key twice; you should receive the same `orderId` both times.

```bash
curl -X POST "$BASE/api/orders" \
  -H"Authorization: Bearer $USER_TOKEN" \
  -H"Idempotency-Key: $IDEM_KEY1" | jq

curl -X POST "$BASE/api/orders" \
  -H"Authorization: Bearer $USER_TOKEN" \
  -H"Idempotency-Key: $IDEM_KEY1" | jq
```

## Payments

### User: Create payment intent

```bash
curl -X POST "$BASE/api/payments/intents" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$ORDER03ID\"}" | jq
```

Expected: { intentId, clientSecret, status: "REQUIRES_PAYMENT" }.

### Webhook

set variables

```bash
PAYMENTS_WEBHOOK_SECRET=whsec_9a4f2c7d1e6b8f3a0d5e9c4b7a2f8d1c6e0b
F_EVENT1ID=f_evt01
S_EVENT1ID=s_evt01
S_EVENT2ID=s_evt02
R_EVENT1ID=r_evt01

```

Compute the signature:

```bash
F_E1_SIG=$(node.exe -e "const c=require('crypto');const id='$F_EVENT1ID';const s='$PAYMENTS_WEBHOOK_SECRET';console.log(c.createHash('sha256').update(id+s).digest('hex'))")
S_E1_SIG=$(node.exe -e "const c=require('crypto');const id='$S_EVENT1ID';const s='$PAYMENTS_WEBHOOK_SECRET';console.log(c.createHash('sha256').update(id+s).digest('hex'))")
S_E2_SIG=$(node.exe -e "const c=require('crypto');const id='$S_EVENT2ID';const s='$PAYMENTS_WEBHOOK_SECRET';console.log(c.createHash('sha256').update(id+s).digest('hex'))")
R_E1_SIG=$(node.exe -e "const c=require('crypto');const id='$R_EVENT1ID';const s='$PAYMENTS_WEBHOOK_SECRET';console.log(c.createHash('sha256').update(id+s).digest('hex'))")

```

Payment Failed:

```bash
curl -X POST "$BASE/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $F_E1_SIG" \
  -d "{
    \"eventId\": \"$F_EVENT1ID\",
    \"type\": \"payment_failed\",
    \"data\": { \"orderId\": \"$ORDER03ID\" }
  }" | jq

```

Expected:

- PaymentIntent `FAILED`
- Order remains `PENDING`

Payment Succeeded:

```bash
curl -X POST "$BASE/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $S_E1_SIG" \
  -d "{
    \"eventId\": \"$S_EVENT1ID\",
    \"type\": \"payment_succeeded\",
    \"data\": { \"orderId\": \"$ORDER03ID\" }
  }" | jq
```

```bash
curl -X POST "$BASE/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $S_E2_SIG" \
  -d "{
    \"eventId\": \"$S_EVENT2ID\",
    \"type\": \"payment_succeeded\",
    \"data\": { \"orderId\": \"$ORDER04ID\" }
  }" | jq
```

Expected: order becomes PAID.

Payment Refunded

```bash
curl -X POST "$BASE/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $R_E1_SIG" \
  -d "{
    \"eventId\": \"$R_EVENT1ID\",
    \"type\": \"payment_refunded\",
    \"data\": { \"orderId\": \"$ORDER03ID\" }
  }" | jq
```

Expected:

- order becomes `REFUNDED`
- restocks only if order was not `SHIPPED`

Order detail:

```bash
curl "$BASE/api/orders/$ORDER04ID" \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```

set variable

```bash
ITEMID=
```

### Vendor/Admin: Ship an item:

```bash
curl -X PATCH "$BASE/api/vendor/orders/$ORDER04ID/items/$ITEMID/ship" \
  -H "Authorization: Bearer $VENDOR_TOKEN" | jq
```

Expected:

- item becomes `fulfillmentStatus: SHIPPED`
- order becomes `PARTIALLY_SHIPPED` if not all items shipped, else `SHIPPED`.

## Logging & Metrics (Health Server)

Health:

```bash
curl "$HEALTH_BASE/health" | jq
```

Metrics (log file sizes):

```bash
curl "$HEALTH_BASE/metrics" | jq
```
