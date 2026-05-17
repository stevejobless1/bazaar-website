## 2024-05-13 - Missing Secure Flag on Authentication Cookie
**Vulnerability:** The authentication cookie `bt_auth` was being set and cleared without the `Secure` flag in `src/App.tsx`.
**Learning:** Even if a site is intended to be served over HTTPS, cookies without the `Secure` flag can be transmitted over unencrypted HTTP connections (e.g., if a user manually types http:// or during a downgrade attack), exposing sensitive access keys to Man-in-the-Middle (MitM) attackers.
**Prevention:** Always append the `Secure` attribute (along with `SameSite`) when setting or clearing authentication cookies in JavaScript via `document.cookie`.

## 2024-05-17 - Authentication Bypass in Cookie Parsing
**Vulnerability:** The app checked for the authentication cookie using `document.cookie.includes('bt_auth=true')`. An attacker could set a different cookie containing this string (e.g., `fake_bt_auth=true`) and bypass authentication.
**Learning:** Using `String.prototype.includes()` or `String.prototype.indexOf()` on `document.cookie` is dangerous because it doesn't parse cookie keys and values correctly, leading to potential authentication bypass or state injection.
**Prevention:** Always use proper cookie parsing methods or precise regular expressions (e.g., `/(^|;\s*)bt_auth=true(;\s*|$)/.test(document.cookie)`) to verify specific cookie values.
