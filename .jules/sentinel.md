## 2024-05-13 - Missing Secure Flag on Authentication Cookie
**Vulnerability:** The authentication cookie `bt_auth` was being set and cleared without the `Secure` flag in `src/App.tsx`.
**Learning:** Even if a site is intended to be served over HTTPS, cookies without the `Secure` flag can be transmitted over unencrypted HTTP connections (e.g., if a user manually types http:// or during a downgrade attack), exposing sensitive access keys to Man-in-the-Middle (MitM) attackers.
**Prevention:** Always append the `Secure` attribute (along with `SameSite`) when setting or clearing authentication cookies in JavaScript via `document.cookie`.

## 2024-05-20 - Authentication Bypass via Cookie Substring Spoofing
**Vulnerability:** The authentication check `document.cookie.includes('bt_auth=true')` is vulnerable to spoofing, as an attacker could set a benign cookie like `fake_bt_auth=true` to bypass the check.
**Learning:** Using `String.prototype.includes()` or `indexOf()` on `document.cookie` is insecure because it does not enforce word boundaries, allowing arbitrary prefixes or suffixes to match the expected credential string.
**Prevention:** Always validate cookies using precise regular expressions (e.g., `/(^|;\s*)cookie_name=cookie_value(;\s*|$)/.test(document.cookie)`) or a dedicated cookie parsing library to ensure exact matching of the key and value.
