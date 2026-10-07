#!/bin/bash
cd /home/user/LIN
export DATABASE_URL=postgres://lin:lin@localhost:5432/lin APP_URL=http://localhost:3113
export CRON_SECRET=test-cron-secret-0123456789abcdef
export STRIPE_SECRET_KEY=sk_test_mock STRIPE_WEBHOOK_SECRET=whsec_test_mock_secret_0123456789 STRIPE_API_BASE=http://localhost:4010 PLATFORM_FEE_BPS=${PLATFORM_FEE_BPS:-500}
exec npx next dev -p 3113
