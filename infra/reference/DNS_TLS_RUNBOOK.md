# DNS and TLS runbook

Standing a custom domain up, and what to do when the certificate does not arrive.

Written after a studio site spent more than 47 hours without HTTPS while every
configuration check passed. Nothing here is theoretical.

**How that one ended:** the site was moved to Pages hosting on the same vendor as its DNS,
and the certificate issued in under a minute. The configuration on the original host was
never wrong, which is exactly why no amount of fixing it helped. If you reach the escalation
section below and the answer is "the configuration is correct and the queue is theirs",
moving hosts is a legitimate resolution and usually a faster one than waiting.

---

## The short version

**Host and DNS with the same vendor.** Pages hosting on that vendor's own DNS issues a
certificate in minutes, because nothing has to prove anything to anyone. Choosing this at
the start removes the entire rest of this document.

---

## Standing up a domain on the default stack

Cloudflare Pages on Cloudflare DNS.

1. Deploy the site to Pages and confirm the `*.pages.dev` URL serves.
2. Add the custom domain in the Pages project. Cloudflare creates the DNS record itself.
3. Wait. The certificate is issued automatically, typically within minutes.

There is no proxy decision to make and no verification step to get wrong. That is the whole
reason this is the default.

---

## Standing up a domain on GitHub Pages behind a proxying DNS provider

Avoid this pairing. If you are already on it, the sequence below is the one that works, and
the order is the part people get wrong.

**The record must be DNS-only from the moment it is created.** GitHub will not issue a
certificate while it sees the proxy's addresses. Creating the record proxied and toggling it
off afterwards is *not* equivalent, because the first verification is the one that sticks.

1. Create the `CNAME` record pointing at `<owner>.github.io`, **proxy off**, before touching
   GitHub at all.
2. Confirm it resolves to the host's addresses on a public resolver, not the proxy's:

   ```
   Resolve-DnsName <sub>.<domain> -Server 1.1.1.1
   ```

3. Only now add the custom domain in the repository's Pages settings.
4. Confirm GitHub agrees, before waiting on anything:

   ```
   gh api repos/<owner>/<repo>/pages/health
   ```

   Look for `is_valid: true`, `is_proxied: false`, `is_cloudflare_ip: false`,
   `is_served_by_pages: true`, `is_https_eligible: true`, `caa_error: null`.

5. Wait for the certificate, then enable **Enforce HTTPS**.

---

## When the certificate does not arrive

**Check the health endpoint first.** If every field above is correct, your configuration is
correct and there is nothing left to change. `https_error: peer_failed_verification` is not
a separate fault; it is what HTTPS reports while no certificate exists yet.

```
gh api repos/<owner>/<repo>/pages           # https_certificate.state
gh api repos/<owner>/<repo>/pages/health    # every check
curl -s -o /dev/null -w "%{http_code}" https://<sub>.<domain>/
```

**Do not cycle the domain.** Removing and re-adding restarts issuance from zero. This is the
single most damaging thing you can do, and it is the most tempting, because it feels like
action. A slow certificate becomes a multi-day outage this way.

**Do not turn the proxy on to get HTTPS today.** It works, in that visitors see a padlock
from the proxy's edge certificate. But it requires the flexible TLS mode, which leaves the
proxy-to-origin leg unencrypted, and it guarantees the real certificate never issues,
because the host will again see proxy addresses. That trades a temporary problem for a
permanent one.

**Escalate instead.** If the configuration passes every check and the state has been
pending for more than a few hours, open a support ticket and attach the health output. The
queue is the provider's, not yours.

**If you need a working HTTPS link in the meantime**, the honest option is the unbranded
one: removing the custom domain restores the `*.github.io` URL over HTTPS within minutes.
Note that this also restarts issuance when you re-add it, so it is only worth doing if you
need a secure link for something specific this week.

---

## Things that look like causes and are not

- **CAA records.** Worth checking once. `caa_error: null` means this is not it.
- **Propagation.** If a public resolver already returns the right answer, propagation is
  done. It is not a reason to keep waiting or to change anything.
- **`is_pointed_to_github_pages_ip: false` on a CNAME setup.** Expected. That field is about
  apex A records. `is_cname_to_github_user_domain: true` is the one that matters.
- **The site serving over HTTP.** Confirms DNS and hosting are correct. It says nothing
  about the certificate.

---

## Before you enable Enforce HTTPS

Setting a custom domain makes the `*.github.io` address redirect rather than serve, so there
is no HTTPS fallback while a certificate is pending. Know that before you need it, not
during.
