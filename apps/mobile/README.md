# STC FoundIt for Android

The Android pilot app uses the existing Supabase project and database used by the web app.

## 1. Configure Supabase

1. Apply the project's Supabase migrations `0001` through `0009` in order if they are not already applied. The private `report-images` storage bucket must also exist.
2. In Supabase **Authentication → URL Configuration → Redirect URLs**, add `stcfoundit://auth/confirm`, `stcfoundit://auth/reset`, `https://stc-official.netlify.app/auth/confirm`, and (for local web signup) `http://localhost:3000/auth/confirm`. Keep your Netlify URL as the Site URL.
3. Keep **Confirm email** enabled if every account should verify before browsing or posting.
4. In **Authentication → Email Templates → Confirm signup**, set the link to `<a href="{{ .ConfirmationURL }}">Confirm your email</a>`. This lets Supabase return each member to the web app or Android app that started signup.

## 2. Add the public app settings

Copy `.env.example` to `.env` in this folder, then fill in the Supabase project URL and public anon/publishable key from **Project Settings → API**. These are public client settings; never put a service-role key in the app.

## 3. Run on Android

From the repository root:

```sh
npm install
npm run dev:mobile
```

Install **Expo Go** on an Android phone and scan the QR code, or press `a` in the terminal when an Android emulator is open. The app can also be built as an installable Android package with EAS Build after signing in to an Expo account.

To create an Android APK for sharing with pilot testers, sign in to Expo from the terminal and run:

Before the cloud build, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to your Expo project's **Project settings → Environment variables** for the `preview` environment. These are public app settings, not secret credentials. The local `.env` file is only for running the app on your computer.

From the `apps/mobile` folder, run:

```sh
npx eas-cli@latest build --platform android --profile preview
```

EAS builds the APK in Expo's cloud and gives you a download link when it finishes. A Play Store release uses the `production` profile and creates an Android App Bundle.

## Included in this pilot app

- Required sign-in and verified-email gate
- Lost/found discovery, search, and category filters
- Lost/found report creation with private Supabase Storage photos
- Report detail, safe contact flow, and mark-returned action for the report owner
- Private, live-updating conversations and inbox
- Profile, report history, password reset, and sign-out
- Opt-in Android push alerts for messages, possible item matches, and reports marked returned

All data access continues to use Supabase Auth and the existing row-level security policies. No service-role credential is bundled in the app.

## Turn on push notifications for the pilot

Push notification code is included, but the service needs to be set up once for the Supabase and Expo projects:

1. In Supabase **SQL Editor**, run `supabase/migrations/0009_push_notifications.sql` once.
2. Link the mobile app to your Expo account from the `apps/mobile` folder with `npx eas-cli@latest init`. This writes the EAS project ID into the app configuration.
3. Set up Android push credentials. In Firebase Console, create a Firebase project and register the Android package `com.systemtechnologiescompany.stcfoundit`. Download its `google-services.json` into `apps/mobile`, add `"googleServicesFile": "./google-services.json"` under `expo.android` in `apps/mobile/app.json`, and upload a Firebase service-account key for FCM v1 to the EAS project credentials. Keep the private service-account JSON out of the repository. See Expo's [FCM v1 setup guide](https://docs.expo.dev/push-notifications/fcm-credentials/).
4. Deploy the Supabase Edge Function from the repository folder: log in and link the Supabase project with the Supabase CLI, set a random `WEBHOOK_SECRET` as an Edge Function secret, then deploy `push-events` with JWT verification disabled (the function checks the secret header itself):

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase secrets set WEBHOOK_SECRET=YOUR_LONG_RANDOM_SECRET
   npx supabase functions deploy push-events --no-verify-jwt
   ```

5. In Supabase **Database → Webhooks**, create three webhooks that POST to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/push-events`. Add the header `x-webhook-secret` with the same secret from step 4. Subscribe to `public.messages` **INSERT**, `public.matches` **INSERT**, and `public.reports` **UPDATE**. The handler ignores report updates except the first change to `returned`.
6. Build and install a fresh Android APK. Push notifications do not work in Expo Go on Android, so users must install the new APK. Open **You → Push notifications** in the app and enable alerts. Android may also require allowing notifications in the phone's app settings.

Expo's [push setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/) explains the credentials and project linking. A phone only receives alerts after it has enabled notifications and registered its push token in Supabase.
