# Background location on Google Play

Riders share their location with their own vendor while they are on duty, and while the app is closed. Google Play treats that as **background location** and asks for a declaration and a short video before it approves the build. This page has what the declaration needs.

## What the app does

| | |
|---|---|
| Who | Riders only: accounts a vendor issues (Role Selection → Rider). Customers, vendors and staff never share location in the background. |
| When | Only while the rider is **on duty** or carrying an order. Going off duty stops it at once. Signing out is blocked while a delivery is open. |
| What | The phone's position, sent to MetroMatrix's API: when the rider has moved 10 m or more, and at least every 15 seconds on duty. |
| Who sees it | The rider's own vendor (its live rider map) and the customer of the order they carry (the tracking map). A position older than two minutes isn't shown. |
| Kept | The newest position on the rider, and a trail for each delivery, deleted after 14 days. |
| Off switch | Off duty. A build can also ship with tracking off (`TRACKING_ENABLED` in `services/location/riderLocation.ts`), and the server can turn it off. |

While it runs on Android, a foreground-service notification says **"MetroMatrix — on duty: Sharing your location with your vendor while you deliver."**

## Before the system prompt

Tapping **On duty** first opens the app's own explanation sheet, "Share your location on duty": "While you're on duty or carrying an order, *vendor* sees where you are, and the customer sees you on their way. Go off duty and nothing is shared." Only **Allow location** goes on to Android's prompts (while using the app, then "Allow all the time").

## The Play Console declaration

**Permissions → Location permissions → Background location.**

- **Feature:** Live delivery tracking for a vendor's own riders.
- **Why it's needed:** "Riders deliver food for their vendor with the screen off and the phone in a pocket. While a rider is on duty, the app shares their location so their vendor can see where they are and the customer can follow the order to their door. Sharing starts only when the rider goes on duty and stops when they go off duty."
- **Is it core to the app?** Yes, for the rider role: without it the vendor can't follow a delivery and the customer's tracking stops whenever the rider's screen turns off.
- **Prominent disclosure:** the "Share your location on duty" sheet (above), shown before any system prompt.

`app.json` declares `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION`. The `expo-location` plugin sets the background and foreground-service options, with the permission texts.

## The video (30–60 seconds)

Record on a phone running a release build:

1. Sign in as a rider (Role Selection → Rider).
2. Tap **On duty**. Show the explanation sheet, tap **Allow location**, and choose "Allow all the time" in Android's prompt.
3. Show the "MetroMatrix — on duty" notification in the shade.
4. Lock the phone and walk a few steps; unlock and show the vendor's live rider map (a second phone or the web) with the position moving.
5. Back in the rider app, tap **Off duty**. Show the notification gone.

Upload it as an unlisted YouTube link in the declaration.

## Data safety form

**Location → Precise location: collected**, shared with the vendor and the customer of the order (they are the people the rider works with); purpose **App functionality**; not optional for riders on duty; deleted after 14 days.
