# Enable Google and Discord sign-in

The website and account-save database are already deployed. These remaining steps connect your Google and Discord applications to Supabase. Enter secrets directly into Supabase; do not put them in chat, GitHub, Vercel's frontend variables, or the planner.

## 1. Set the website addresses in Supabase

Open your [planner project](https://supabase.com/dashboard/project/knqnkhindjfcxfkdhpvd). Go to **Authentication → URL Configuration** and save:

| Setting | Value |
| --- | --- |
| Site URL | `https://brm5-hq-planner.vercel.app` |
| Redirect URLs → Add URL | `https://brm5-hq-planner.vercel.app/auth/callback` |

The callback used inside Google and Discord is a different address:

```
https://knqnkhindjfcxfkdhpvd.supabase.co/auth/v1/callback
```

The provider returns to Supabase first; Supabase then returns to the planner. Use the exact addresses above. Production does not need a wildcard redirect or any localhost address. [Supabase redirect settings](https://supabase.com/docs/guides/auth/redirect-urls)

## 2. Enable Discord

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and choose **New Application**. Name it **BRM5 HQ Planner**.
2. In that application, open **OAuth2**. Under **Redirects**, add `https://knqnkhindjfcxfkdhpvd.supabase.co/auth/v1/callback` and save.
3. Find its **Client ID** and **Client Secret** in OAuth2's client information. If needed, generate/reset the secret yourself.
4. Return to the [Supabase project](https://supabase.com/dashboard/project/knqnkhindjfcxfkdhpvd). Open **Authentication → Sign In / Providers → Discord**.
5. Enable Discord, enter the client ID and secret directly there, and save.
6. Refresh [the planner](https://brm5-hq-planner.vercel.app). **Continue with Discord** should become available.

These are the provider's documented setup steps. [Supabase Discord guide](https://supabase.com/docs/guides/auth/social-login/auth-discord)

## 3. Enable Google

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project for **BRM5 HQ Planner**.
2. Open **Google Auth Platform → Branding** and save the following values. For the support-email dropdown, use a Google account that manages the support Google Group. Set developer contact details to an address you monitor for Google's notices.

   | Branding field | Value |
   | --- | --- |
   | App name | `BRM5 HQ Planner` |
   | User support email | `brm5hqplanner@googlegroups.com` |
   | Application home page | `https://brm5-hq-planner.vercel.app` |
   | Application privacy policy | `https://brm5-hq-planner.vercel.app/privacy.html` |

   The homepage links to the public privacy policy and support contact. If **Publish app** is disabled, finish and save the required Branding fields first. Google may separately request domain ownership or branding verification; follow the validation shown in the console. [Google Branding requirements](https://support.google.com/cloud/answer/15549049?hl=en)
3. In **Audience**, choose **External**. Start in **Testing** and add your Google email as a test user.
4. In **Data Access**, select `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
5. Under **Clients**, create an OAuth client with application type **Web application**.
6. Set **Authorized JavaScript origins** to `https://brm5-hq-planner.vercel.app`.
7. Set **Authorized redirect URIs** to `https://knqnkhindjfcxfkdhpvd.supabase.co/auth/v1/callback`.
8. Create the client. Enter its ID and secret directly into **Supabase → Authentication → Sign In / Providers → Google**, enable Google, then save.
9. Refresh the planner and test **Continue with Google**.
10. After testing, change Google's audience to **In production** for public users. Complete any branding verification Google requests; this can take additional time.

[Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google)

## 4. Verify the account saves

1. As a guest, enter sample cash or a completed research item. Sign in and choose **Save guest HQ to account**. When asked whether to download a recovery file, choose **Yes, download** for a portable backup or **No, continue** to skip the download. A recovery copy is still kept in this browser.
2. Wait for **Saved to account** before closing the page.
3. Open the same site on another device and sign in using the same provider/account. Verify the cash and research match.
4. Sign out. The guest HQ should return; the account HQ should disappear from the interface.
5. If two devices change the same HQ before syncing, use **Review saves** to choose one. Both versions are preserved; resources and payouts are never combined automatically.

The database isolation, revision checks and idempotent saves have been tested. Real Google/Discord redirects and signed-in multi-device behavior still need this final verification after the providers are configured.

## Move your existing HQ

Export a backup from your [original private tracker](https://brm5-hq-planner-lukas.amberolm256.chatgpt.site). Import it on the new website, check your balances, staff, research and timers, then sign in and save that guest HQ to your account. The original tracker has not been reset or replaced.
