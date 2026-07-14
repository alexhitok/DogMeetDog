# DogMeetDog

DogMeetDog is a responsive web app for dog owners in Sofia. It helps users discover nearby dogs, arrange safer playdates, message matched owners, browse adoption posts, report lost dogs, and find dog-friendly places.

## Features

- Dog profiles with create, edit, delete, and photo upload flows
- Discover page with filters and nearby map
- Playdate requests and accepted matches
- Private messages between matched users
- Adoption listings
- Lost dog reports
- Places by district
- Notifications
- Admin panel for privileged users
- English and Bulgarian interface
- Responsive desktop and mobile layout

## Tech Stack

- Vite
- HTML, CSS, and vanilla JavaScript
- Bootstrap 5
- Supabase for authentication, database, storage, and Row-Level Security
- Leaflet for the nearby map

## Project Structure

- `src/app` - router, route definitions, and app template helpers
- `src/components` - shared UI pieces such as header and footer
- `src/pages` - page modules, HTML templates, and styles
- `src/services` - Supabase and app data access helpers
- `src/i18n` - translations and language switching
- `src/utils` - shared utilities
- `supabase/migrations` - database schema and RLS migrations
- `supabase/seed.sql` - seed data for local development

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Create a local environment file and add your Supabase values.

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Use a local `.env` or `.env.local` file for these values and do not commit it to the repository.

3. Start the development server.

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - start the Vite development server
- `npm run build` - create a production build
- `npm run preview` - preview the production build locally

## Supabase Notes

- The app uses Supabase Auth for sign in, sign up, and sign out.
- Database access is protected with Row-Level Security.
- Dog photos are stored in Supabase Storage.
- If Supabase env variables are missing, the app can still load, but data-driven features will be limited.

## Pages

- Home
- Discover
- Adoption
- Lost Dogs
- Places
- Notifications
- Messages
- Profile
- Login
- Register
- Admin
- Dog Details

## Contributing

Keep changes focused, readable, and consistent with the existing vanilla JS and Bootstrap structure.

## License

Add a license here if you plan to publish the project publicly.