#!/bin/bash
cd /home/user/LIN
export DATABASE_URL=postgres://lin:lin@localhost:5432/lin APP_URL=http://localhost:3113 CRON_SECRET=test-cron-secret-0123456789abcdef
unset STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_API_BASE PLATFORM_FEE_BPS
exec npx next dev -p 3113
