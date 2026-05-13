## 2024-05-13 - Missing Secure Flag on Authentication Cookie
**Vulnerability:** The authentication cookie `bt_auth` was being set and cleared without the `Secure` flag in `src/App.tsx`.
**Learning:** Even if a site is intended to be served over HTTPS, cookies without the `Secure` flag can be transmitted over unencrypted HTTP connections (e.g., if a user manually types http:// or during a downgrade attack), exposing sensitive access keys to Man-in-the-Middle (MitM) attackers.
**Prevention:** Always append the `Secure` attribute (along with `SameSite`) when setting or clearing authentication cookies in JavaScript via `document.cookie`.
