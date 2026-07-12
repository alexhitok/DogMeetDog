# DogMeetDog – Project Instructions

## Project overview
DogMeetDog is a modern responsive web platform for dogs and their owners in Sofia.

The platform includes:
- dog profiles with create, view, edit and delete flows
- dog photo upload and download
- adoption listings
- lost dog reports
- veterinary clinics, pet shops and other places by district
- Supabase authentication, database, storage and Row-Level Security
- user roles and a protected admin panel
- Discover, Adoption, Lost Dogs and Places public pages

## Required technologies
- Use Vite, HTML, CSS, vanilla JavaScript and Bootstrap 5.
- Use ES modules with import and export.
- Do not use React, TypeScript, Vue, Angular or Tailwind.
- Use Supabase for database, authentication, storage and Row-Level Security.

## Architecture
- Use a Vite multi-page-style application with a custom client-side router and clean URLs without hashes.
- Keep each page and shared component in separate HTML, CSS and JavaScript files.
- Load page fragments dynamically through the router.
- Keep pages, components, services, utilities and styles in separate files.
- Avoid large monolithic JavaScript files.
- Use reusable Bootstrap components where appropriate.
- Keep HTML, CSS and JavaScript readable and well organized.
- Use a custom client-side router with clean URLs without hashes.
- Keep each route page and shared component in separate HTML, CSS and JavaScript files, loaded dynamically by the router.

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
- Admin features must be accessible only to users with an admin role.

## Development workflow
- Before making major changes, inspect the existing project structure.
- Make focused changes only to files related to the requested feature.
- Do not overwrite unrelated files.
- Explain briefly which files were created or changed.
- Prefer simple, maintainable solutions over unnecessary complexity.
- Do not create fake commits or pretend that functionality works without testing.
- Database schema changes must use migrations.
- The next major phase is UI redesign in Bolt, so backend behavior and Supabase services must not be replaced during UI work.
