## 2024-05-13 - Missing Secure Flag on Authentication Cookie
**Vulnerability:** The authentication cookie `bt_auth` was being set and cleared without the `Secure` flag in `src/App.tsx`.
**Learning:** Even if a site is intended to be served over HTTPS, cookies without the `Secure` flag can be transmitted over unencrypted HTTP connections (e.g., if a user manually types http:// or during a downgrade attack), exposing sensitive access keys to Man-in-the-Middle (MitM) attackers.
**Prevention:** Always append the `Secure` attribute (along with `SameSite`) when setting or clearing authentication cookies in JavaScript via `document.cookie`.

## 2024-11-20 - Authentication Bypass via Cookie Substring Matching
**Vulnerability:** The application was vulnerable to an authentication bypass because it used `.includes('bt_auth=true')` to check if the user was authenticated.
**Learning:** This substring matching allowed an attacker to create a differently named cookie that contained the exact string (e.g., `not_bt_auth=true`) and bypass authentication entirely.
**Prevention:** Always use precise regex patterns like `/(^|;\s*)cookie_name=value(;\s*|$)/.test(document.cookie)` or a dedicated cookie parsing library to strictly validate cookie names and values.
