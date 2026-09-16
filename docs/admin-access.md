# Admin access

The public IH Seeds catalogue does not require an account. Catalogue administration is protected by Clerk sign-in and the server-owned `ih_admin_users` role table.

Clerk is provisioned and proxied by Replit. Development and Production use separate Clerk user stores; an account created in one environment does not automatically exist in the other.

## Private registration

The Clerk instance runs with its registration allowlist enabled. The allowlist is synchronized from the configured bootstrap administrator, active administrators, and pending invitations whenever the API starts. Unknown public email addresses cannot create an account.

The public admin route is sign-in only. Account creation is available exclusively through a valid Clerk invitation ticket sent from the authenticated **Administrators** screen.

## Grant the first production administrator

1. Set the production-only `ADMIN_BOOTSTRAP_EMAILS` environment variable to the intended administrator's exact email address. This is a server-only allowlist, not a password; never prefix it with `VITE_` or `NEXT_PUBLIC_`. Separate multiple addresses with commas.
2. Publish the application. Publishing applies the development schema changes to production. Do not select the option to overwrite production data with development data, and do not run manual production DDL.
3. When the API starts, it adds the seed address to Clerk's allowlist and sends one invitation if that environment does not already have the account or a pending invitation.
4. The administrator follows that invitation to create credentials, or signs in at `/admin/sign-in` if the account already exists, and verifies that account's **primary** email address.
5. On the first successful session check, the server creates their `admin` role in `ih_admin_users`.
6. Remove the address from `ADMIN_BOOTSTRAP_EMAILS` after the role has been created, then publish again.

The bootstrap list is checked only on the server. Signing up alone never grants access. A signed-in user whose verified primary email has neither bootstrap authorization nor a pending approval receives an access-denied page. An unverified address or a verified secondary address cannot claim approval.

After entering the admin area, open **Administrators** and confirm the account appears in the active list. Production access is not confirmed until the intended person completes this sign-in.

## Approve another administrator

1. Open **Administrators** from the admin navigation.
2. Enter the recipient's exact email address and send the invitation.
3. Clerk emails a one-time invitation link that opens the ticket-only `/admin/invitation` route.
4. The recipient creates credentials for the invited address. The pending invitation becomes an active administrator on their next authenticated access check.

The public login does not provide account creation. Email matching ignores case and surrounding whitespace, but does not treat aliases or differently spelled addresses as equivalent.

Pending invitations can be cancelled from the same screen with confirmation. Invitation, cancellation, claim, bootstrap and revocation actions appear in its audit history with the actor, target and time.

## Remove administrator access

Use **Revoke access** in **Administrators** and confirm the account being removed. Their next protected API request is denied even if their Clerk session remains active. Revocation does not delete their Clerk account.

Do **not** manually delete role rows. The access-management workflow retains a revocation record so an old bootstrap setting cannot silently restore access. An existing administrator must explicitly approve the email again to restore it.

The final active administrator cannot be revoked. Pending invitations do not count as active administrators. Have a second invited person complete sign-in before removing the last existing administrator. This protection is enforced on the server even when requests arrive simultaneously.

## Troubleshooting access

- **Sign-in succeeds but access is denied:** check that you are on the published site, using the exact invited primary email, and that it is verified. Ask an existing administrator to check the pending invitation.
- **No first administrator exists:** confirm the production-only bootstrap setting and publish, then sign in again. Do not create a public setup endpoint or automatically elevate the first signup.
- **The preview works but production does not:** Development and Production use separate Clerk user stores and require separate invitations or bootstrap claims.
- **Schema missing after an update:** publish the updated application with its schema changes. Do not add startup migrations or copy development data over production.
- **A revoked administrator needs access again:** an active administrator must explicitly approve the email again; leaving it in the bootstrap setting is insufficient.

## Protected operations

All `/api/admin/*` routes and all product create, update, and delete routes require the server-side `admin` role. Public catalogue reads, redirects, availability, sitemap data, and customer enquiry submission remain anonymous.