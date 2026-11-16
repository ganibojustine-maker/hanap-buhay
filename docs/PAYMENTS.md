# Payments (PayMongo)

Employer plans (Starter, Business ₱499, Business Plus ₱1,499) and the client Service Buyer Pass (Free, ₱249, ₱599) are paid through **PayMongo Checkout Sessions**. All the rules live in `backend/app/libraries/Payments.php`.

## Rules

1. **A plan changes only when PayMongo says the payment is paid.** That proof comes from the signed webhook or from our own look-up of the checkout session. Returning to the "success" page only triggers a check; it proves nothing.
2. **Every outcome is recorded** in `payments.status`: `pending`, `paid`, `failed`, `cancelled`, `expired`, `refunded`. Partial refunds are tracked in `refund_status` and `refunded_amount`.
3. **Nothing is counted twice:**
   - Each webhook event id is stored in `paymongo_events`, so a repeated event is ignored.
   - Moving a payment to `paid` is a conditional `UPDATE … WHERE status IN ('pending','failed','expired')`, so only one request can win.
   - `paymongo_payment_id` is UNIQUE, so one PayMongo payment can never activate two rows.
4. **Missed webhooks are recovered.** PayMongo does not resend events it could not deliver, so `Payments::reconcile()` asks PayMongo about every pending payment. It runs:
   - when the person opens their billing page,
   - from the cron URL (`/api/cron/reminders?key=…` every 15–30 minutes),
   - when an admin presses "Re-check pending payments".
5. **No automatic charges.** Plans are paid per period. Three days before a plan ends we send a reminder; when it ends, the account moves to the free plan and the locked features are recorded.

## Plan changes

| Change | What happens |
|---|---|
| New / upgrade | Pay now. Starts when paid. Unused credits carry over. |
| Renew same plan | Pay now. The new days are added on top of the days left. |
| Downgrade / switch to free | Nothing charged. Saved as `scheduled_plan_id` and takes effect when the current plan ends. |
| Cancel | `cancel_at_period_end = 1`: no reminders, ends on its date. "Keep my plan" undoes it. |
| Full refund | The plan it paid for ends now (`end_plan`, event `refunded`). |

Every change is a row in `subscription_events`, with the features unlocked or locked. The billing page shows this as the plan timeline.

## What people see

| Status | Message |
|---|---|
| Pending | "We're waiting for PayMongo to confirm your payment. Your plan changes only after the payment is confirmed." Buttons: Continue payment, Cancel it. |
| Paid | "Payment received. Your plan is active." Receipt (HB-OR-YYYY-000123). |
| Failed | "Your payment didn't go through. Your plan was not changed. You can try again or use another payment method." Button: Try again. |
| Cancelled | "You left the payment page, so nothing was charged." Button: Try again. |
| Expired | "The payment window timed out before a payment was made." Button: Try again. |
| Refunded | Shown with the refund status: being processed, done, or not completed. |

Each outcome also creates an in-app notification and an email (Brevo).

## Payment methods

Set `PAYMONGO_METHODS` in `backend/.env` to the methods turned on for your PayMongo account. The default is `card,gcash,paymaya,grab_pay,qrph`. The checkout dialog lists the same methods.

## Setup for the demo (test mode)

1. In the PayMongo dashboard, copy the **test** keys into `PAYMONGO_SECRET_KEY` and `PAYMONGO_PUBLIC_KEY`.
2. Create a webhook for `https://<api>/api/subscriptions/webhook` with these events: `checkout_session.payment.paid`, `payment.paid`, `payment.failed`, `payment.refunded`, `payment.refund.updated`. Put its secret in `PAYMONGO_WEBHOOK_SECRET`.
3. The project uses the PayMongo **sandbox** only, but every screen, receipt, email and the admin page shows payments like a real system, with no "Test" labels. The database still saves each sandbox payment with `is_test = 1`, so the records stay honest. Set `PAYMONGO_SHOW_TEST_LABELS=true` to show the labels again. A live key (`sk_live_`) is ignored unless `PAYMONGO_ALLOW_LIVE=true`.
4. Show the panel: a paid checkout, a declined test card (failed), closing the page (cancelled), a refund from the admin page, and the "Re-check pending payments" button.

## Admin

**Admin → Payments** shows:

- revenue: collected, this month, refunded, and net after PayMongo fees and refunds,
- totals by plan and by payment method,
- every transaction, with filters for status, search, and test or live,
- a refund button that goes through the PayMongo Refunds API,
- the reconcile button.
