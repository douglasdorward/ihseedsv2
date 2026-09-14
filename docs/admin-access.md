# Admin access

The public IH Seeds catalogue does not require an account. Catalogue administration is protected by Clerk sign-in and the server-owned `ih_admin_users` role table.

Clerk is provisioned and proxied by Replit. Development and Production use separate Clerk user stores; an account created in one environment does not automatically exist in the other.

## Development

The API development workflow enables a development-only administrator automatically. The admin interface displays **Development auto-sign-in · Administrator** while this bypass is active.

The server requires `NODE_ENV=development` for the bypass. A client build flag, cookie, header, or request parameter cannot enable it in production.

## Grant the first production administrator

1. Set the production-only `ADMIN_BOOTSTRAP_EMAILS` environment variable to the intended administrator's exact email address. This is a server-only allowlist, not a password; never prefix it with `VITE_` or `NEXT_PUBLIC_`. Separate multiple addresses with commas.
2. Publish the application. Publishing applies the development schema changes to production. Do not select the option to overwrite production data with development data, and do not run manual production DDL.
3. The administrator signs up or signs in on the **published site** at `/admin/sign-in` and verifies that account's **primary** email address.
4. On the first successful session check, the server creates their `admin` role in `ih_admin_users`.
5. Remove the address from `ADMIN_BOOTSTRAP_EMAILS` after the role has been created, then publish again.

The bootstrap list is checked only on the server. Signing up alone never grants access. A signed-in user whose verified primary email has neither bootstrap authorization nor a pending approval receives an access-denied page. An unverified address or a verified secondary address cannot claim approval.

After entering the admin area, open **Administrators** and confirm the account appears in the active list. Production access is not confirmed until the intended person completes this sign-in; development auto-sign-in does not test it.

## Approve another administrator

1. Open **Administrators** from the admin navigation.
2. Enter the recipient's exact email address and approve it.
3. Tell the recipient to visit the published site's `/admin/sign-in` page. They must sign in or create an account and verify the approved address as their primary email.
4. The pending approval becomes an active administrator on their next authenticated access check.

Approval does **not** create a Clerk account or send an invitation email. Share the sign-in instructions yourself. Email matching ignores case and surrounding whitespace, but does not treat aliases or differently spelled addresses as equivalent.

Pending approvals can be cancelled from the same screen with confirmation. Approval, cancellation, claim, bootstrap and revocation actions appear in its audit history with the actor, target and time.

## Remove administrator access

Use **Revoke access** in **Administrators** and confirm the account being removed. Their next protected API request is denied even if their Clerk session remains active. Revocation does not delete their Clerk account.

Do **not** manually delete role rows. The access-management workflow retains a revocation record so an old bootstrap setting cannot silently restore access. An existing administrator must explicitly approve the email again to restore it.

The final active administrator cannot be revoked. Pending approvals do not count as active administrators. Have a second approved person complete sign-in before removing the last existing administrator. This protection is enforced on the server even when requests arrive simultaneously.

## Troubleshooting access

- **Sign-in succeeds but access is denied:** check that you are on the published site, using the exact approved primary email, and that it is verified. Ask an existing administrator to check the pending approval.
- **No first administrator exists:** confirm the production-only bootstrap setting and publish, then sign in again. Do not create a public setup endpoint or automatically elevate the first signup.
- **The preview works but production does not:** preview may be using the development bypass. Production uses a separate Clerk user store and requires explicit application authorization.
- **Schema missing after an update:** publish the updated application with its schema changes. Do not add startup migrations or copy development data over production.
- **A revoked administrator needs access again:** an active administrator must explicitly approve the email again; leaving it in the bootstrap setting is insufficient.

## Protected operations

All `/api/admin/*` routes and all product create, update, and delete routes require the server-side `admin` role. Public catalogue reads, redirects, availability, sitemap data, and customer enquiry submission remain anonymous.