# DogMeetDog – Project Instructions

## Project overview
DogMeetDog is a modern responsive web platform for dogs and their owners in Sofia.

The platform includes:
- dog profiles with posts, photos, videos and comments
- dog diary and history timeline
- dog socialization and meetups
- adoption listings
- lost dog reports
- veterinary clinics and pet shops by district
- private dog location for the owner only
- user messages and admin moderation

## Required technologies
- Use Vite, HTML, CSS, vanilla JavaScript and Bootstrap 5.
- Use ES modules with import and export.
- Do not use React, TypeScript, Vue, Angular or Tailwind.
- Use Supabase later for database, authentication, storage and Row-Level Security.
- Do not add Supabase, authentication or database logic until explicitly requested.

## Architecture
- Use a multi-page application structure with separate HTML pages.
- Keep pages, components, services, utilities and styles in separate files.
- Avoid large monolithic JavaScript files.
- Use reusable Bootstrap components where appropriate.
- Keep HTML, CSS and JavaScript readable and well organized.

## UI and design direction
- Create a polished, premium, modern and trustworthy pet platform.
- Do not make the design childish or cartoonish.
- Use a light warm background, deep forest green as the main brand color, warm coral accents and dark navy text.
- Use rounded cards, subtle shadows, clean spacing and responsive layouts.
- Prioritize excellent mobile and desktop usability.
- Use Bootstrap 5 and custom CSS.
- Use Lucide icons through CDN when icons are needed.

## Security and privacy
- Never hardcode secret keys, passwords or private data.
- Never commit .env files.
- Dog GPS location must be private and visible only to the owner of that dog profile.
- Later, use Supabase RLS policies so users can edit only their own profiles, dogs, posts, listings and location data.
- Admin features must be accessible only to users with an admin role.

## Development workflow
- Before making major changes, inspect the existing project structure.
- Make focused changes only to files related to the requested feature.
- Do not overwrite unrelated files.
- Explain briefly which files were created or changed.
- Prefer simple, maintainable solutions over unnecessary complexity.
- Do not create fake commits or pretend that functionality works without testing.
