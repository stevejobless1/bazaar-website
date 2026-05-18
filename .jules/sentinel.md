## 2024-05-13 - Missing Secure Flag on Authentication Cookie
**Vulnerability:** The authentication cookie `bt_auth` was being set and cleared without the `Secure` flag in `src/App.tsx`.
**Learning:** Even if a site is intended to be served over HTTPS, cookies without the `Secure` flag can be transmitted over unencrypted HTTP connections (e.g., if a user manually types http:// or during a downgrade attack), exposing sensitive access keys to Man-in-the-Middle (MitM) attackers.
**Prevention:** Always append the `Secure` attribute (along with `SameSite`) when setting or clearing authentication cookies in JavaScript via `document.cookie`.

## 2024-06-25 - Authentication Bypass via Cookie Substring Spoofing
**Vulnerability:** The authentication cookie `bt_auth` was validated using `document.cookie.includes('bt_auth=true')` in `src/App.tsx`, allowing an attacker to bypass authentication by creating a different cookie containing the target substring (e.g., `not_bt_auth=true`).
**Learning:** Using string search methods like `.includes()` or `.indexOf()` on `document.cookie` is insecure because it matches partial strings across different cookie names and values.
**Prevention:** Always use precise regular expressions (e.g., `/(^|;\s*)cookie_name=value(;\s*|$)/.test(document.cookie)`) or a dedicated cookie parsing library to validate specific cookie keys and values.
