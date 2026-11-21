# WedPlan Server

This repository contains the Express.js API and MongoDB business logic for the WedPlan wedding planning platform.

WedPlan supports three roles:

- **Customer:** Browses approved services and submits or cancels booking requests.
- **Vendor:** Publishes services, manages booking requests, and manages a Premium subscription.
- **Admin:** Reviews services, manages users, and views platform payment transactions.

## Live API

Live API deployment: **https://wedplan-server-six.vercel.app**

## Repositories

- **Client repository:** https://github.com/ahaduzzaman5503/wedplan-client
- **Server repository:** https://github.com/ahaduzzaman5503/wedplan-server

## Important Features

- JWT verification through Better Auth JSON Web Key Set data
- Server-side role authorization
- Blocked-user enforcement
- Protected API routes
- Resource ownership verification
- Request validation
- Vendor service limits
- Admin service approval and rejection
- Public approved-and-active service listings
- Customer, vendor, and admin booking workflows
- Duplicate booking prevention
- Stripe Checkout subscription sessions
- Verified Stripe webhook processing
- Subscription cancellation and expiration handling
- Read-only admin transaction records
- MongoDB-backed business data
- Helmet security middleware
- CORS and centralized API error handling

## Technology Stack

- Node.js
- Express.js 5
- MongoDB
- Better Auth JWT integration
- JOSE JWT/JWKS verification
- Stripe Checkout and Stripe Webhooks
- CORS
- Helmet
- dotenv

## API Routes

### Public

- `GET /`
- `GET /api/services`
- `GET /api/services/locations`
- `GET /api/services/:id`

### Authenticated user

- `GET /api/me`
- `PATCH /api/profile`

### Vendor

- `POST /api/services`
- `GET /api/services/mine`
- `PATCH /api/services/:id`
- `PATCH /api/services/:id/availability`
- `DELETE /api/services/:id`
- `GET /api/bookings/vendor`
- `PATCH /api/bookings/:id/status`
- `POST /api/payments/create-checkout-session`

### Customer

- `POST /api/bookings`
- `GET /api/bookings/mine`
- `PATCH /api/bookings/:id/cancel`

### Admin

- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id/block`
- `GET /api/admin/services`
- `PATCH /api/admin/services/:id/status`
- `DELETE /api/admin/services/:id`
- `GET /api/admin/transactions`

### Stripe

- `POST /api/webhooks/stripe`

The Stripe webhook uses the raw request body and a verified Stripe signature.

## Installation

### Prerequisites

- Node.js 20 or newer
- npm
- MongoDB
- Better Auth configured on the WedPlan client
- A Stripe account with Checkout enabled
- Stripe CLI for local webhook testing

### Steps

1. Clone the server repository:

```bash
git clone https://github.com/ahaduzzaman5503/wedplan-server.git
cd wedplan-server
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` from the example file:

```bash
cp .env.example .env
```

4. Add real values to `.env`.

## Environment Variables

```env
PORT=5000
CLIENT_URL=http://localhost:3000

MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name

AUTH_JWKS_URL=https://your-client-domain/api/auth/jwks
AUTH_ISSUER=https://your-client-domain

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

Variable descriptions:

- `PORT`: Local Express server port.
- `CLIENT_URL`: Allowed client origin for CORS and Stripe success/cancel redirects.
- `MONGODB_URI`: MongoDB connection string.
- `DB_NAME`: MongoDB database name.
- `AUTH_JWKS_URL`: Better Auth JWKS endpoint used to verify JWT signatures.
- `AUTH_ISSUER`: Expected JWT issuer.
- `STRIPE_SECRET_KEY`: Stripe server secret key.
- `STRIPE_WEBHOOK_SECRET`: Secret used to verify signed Stripe webhook events.

Keep all credentials in `.env`. Never commit `.env` or real secret values to GitHub.

## Running Locally

Start the development server:

```bash
npm run dev
```

Start without Nodemon:

```bash
npm start
```

The API runs at `https://wedplan-server-six.vercel.app` by default.

## Local Stripe Webhook Testing

1. Start the server.

2. Start Stripe forwarding:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

3. Put the webhook signing secret printed by Stripe CLI into `STRIPE_WEBHOOK_SECRET`.

4. Restart the server and perform a test Checkout payment.

## Database Collections

The server uses the following main business collections:

### `user`

Better Auth manages authentication users. Relevant application fields include:

- `_id`
- `name`
- `email`
- `image`
- `role`
- `isBlocked`
- `businessName`
- `subscriptionPlan`
- `subscriptionExpiresAt`

### `services`

- `vendorId`
- `serviceName`
- `category`
- `description`
- `price`
- `location`
- `images`
- `status`
- `isActive`
- `createdAt`
- `updatedAt`

### `bookings`

- `serviceId`
- `vendorId`
- `customerId`
- `eventDate`
- `eventLocation`
- `message`
- `status`
- `createdAt`
- `updatedAt`

### `transactions`

- `vendorId`
- `plan`
- `amount`
- `currency`
- `stripeSessionId`
- `stripeInvoiceId` for supported renewal records
- `stripeSubscriptionId`
- `status`
- `createdAt`

Better Auth may also manage its own authentication collections, such as sessions and accounts.

## Security Rules

- Protected API routes require a valid Bearer JWT.
- Expired or invalid JWTs return `401`.
- Wrong role access returns `403`.
- Blocked users are denied protected APIs.
- Public signup cannot create Admin accounts.
- Service and booking mutations verify ownership on the server.
- Client-provided user IDs and roles are not trusted for protected operations.
- Stripe Premium status is activated only after verified Stripe webhook events.
- The raw Stripe webhook body is used to verify the signature.

## Production Deployment

- Set all environment variables in the deployment platform.
- Set `CLIENT_URL` to the exact deployed client origin.
- Enable HTTPS and use secure production cookies through Better Auth.
- Configure the Stripe webhook endpoint to:

```text
https://your-server-domain/api/webhooks/stripe
```

- Verify the deployed webhook signing secret.
- Do not expose Stripe secret keys or MongoDB credentials.
- Test route reload behavior, CORS, authorized access, blocked users, Checkout, webhook activation, and subscription cancellation.
