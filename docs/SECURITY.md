# Security

How hanapbuhay handles the common web application threats (OWASP), and where in the code.

| Threat | How it is handled | Where |
|---|---|---|
| **SQL injection** | Every value from a person goes to the database as a bound parameter: the LavaLust Query Builder in the models (`where()`, `in()`, `insert()`, `update()`), or `raw($sql, [$values])` with `?` placeholders for the few complex report queries. Column and table names are never taken from input; sort orders and filters are picked from fixed lists (`in_array(..., true)`). The Query Builder also rejects identifiers that contain SQL keywords. | `app/models/*`, `scheme/database/Database.php` (`validate_identifier`) |
| **Cross-site scripting (XSS)** | React escapes everything it renders. The few places that build HTML escape first: email templates use `htmlspecialchars()`, map pop-ups use `esc()`. An email preview is shown in a sandboxed `<iframe sandbox srcDoc>`, so nothing in it can run. Contract files open from a `blob:` URL instead of written HTML. | `app/libraries/Mailer.php`, `frontend/src/pages/JobMap.jsx`, `frontend/src/pages/Dashboard.jsx` |
| **Cross-site request forgery (CSRF)** | The API does not use cookies. Every request carries the JWT in the `Authorization: Bearer` header, which a page on another site cannot read or send, so a forged request arrives without credentials. That is why LavaLust's cookie-based `csrf_protection` is off for this JSON API. CORS only allows the site's own origins (`ALLOWED_ORIGINS`). | `app/config/config.php`, `app/config/api.php` |
| **Broken authentication** | Passwords are stored with `password_hash()` and checked with `password_verify()`. The login error does not say which field was wrong. Access tokens last 1 hour; refresh tokens are stored as HMAC-SHA256 hashes and revoked on sign-out. Email verification and password reset tokens are stored as SHA-256 hashes and expire. | `app/controllers/AuthController.php`, `app/config/api.php` |
| **Brute force** | Rate limits per IP or per account: sign-in 15 per 5 minutes, registration 10 per 10 minutes, password reset 5 per 15 minutes, plus limits on posting, proposals, invites and uploads. Too many attempts get `429 Too many requests`. | `$this->api->rate_limit()` in each controller |
| **Insecure file uploads** | The real content is checked, not the file name or the browser's Content-Type: `getimagesizefromstring()` for photos (JPG, PNG, WEBP only) and the `%PDF-` header for PDFs; resumes are sniffed from their first bytes. Each type has a size limit (2–10 MB). Files are stored in the database and served by a controller with `X-Content-Type-Options: nosniff` and a sandboxing CSP, never from a folder the web server could execute. | `PhotoController`, `VerificationController`, `BusinessController`, `SkillController`, `AuthController::parse_resume` |
| **Broken access control (IDOR)** | Every record is loaded together with its owner check: a contract only for its client, worker or an admin; an application only for its worker or the job's employer; ID documents, permits, certificates and receipts only for their owner or an admin. Changing the number in the URL gives `404`. Admin pages check `role = admin` on the server. | `contract()`, `owned()`, `require_admin()` in the controllers |
| **Sensitive data exposure** | Secrets live only in `.env` (git-ignored) and in Render's environment settings; `app/config/*.php` reads them with `getenv()`. The database connection is TLS-encrypted (Aiven). Phone numbers and emails of workers are hidden until a contact is unlocked or they applied. In production (`APP_ENV=production`, also the default), database errors and exceptions show no SQL, stack trace or file path. | `.gitignore`, `app/config/*.php`, `scheme/kernel/Errors.php` |
| **Security misconfiguration** | The Docker image uses `php.ini-production` with `display_errors=Off`, `expose_php=Off`, Apache `ServerTokens Prod`. Only `public/` is served; `app/`, `scheme/`, `runtime/` and `.env` are out of reach, and `.htaccess` denies `.env`, `.sql`, `.log` and similar files. Migrations and seed scripts run only from the command line. The API root returns a short JSON message, not a framework page. | `backend/Dockerfile`, `backend/.htaccess`, `MigrationController`, `Welcome` |
| **Security headers** | API answers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a strict `Content-Security-Policy`, `Permissions-Policy`, `Cross-Origin-*` (LavaLust `Security_headers`). Website: the same frame, nosniff, referrer and permissions headers plus HSTS, set in `render.yaml`. | `scheme/kernel/Security_headers.php`, `render.yaml` |
| **Payments** | A plan changes only when PayMongo confirms the payment (signed webhook or a server-side look-up), never because the browser returned to a success page. Webhook signatures are checked with `PAYMONGO_WEBHOOK_SECRET`; each event is processed once; live keys are ignored unless explicitly allowed. | `app/libraries/Payments.php`, `app/libraries/Paymongo.php`, [PAYMENTS.md](PAYMENTS.md) |

## Known limits

- The database certificate is not verified against `certs/aiven-ca.pem` (PHP could not complete
  a verified TLS connection to the Aiven host). The connection is still encrypted.
- There is no Content-Security-Policy on the website itself yet: Google sign-in, Firebase and the
  map tiles would each need to be listed, and a wrong list breaks sign-in.

## Reporting a problem

Send details to the support email shown on the Help page. Please do not test against other
people's accounts.
