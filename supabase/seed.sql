-- Demo seed for DogMeetDog
-- Safe to run manually in Supabase SQL Editor.
-- It inserts active demo dogs only if at least one profile exists.

WITH owner_profile AS (
  SELECT id AS owner_id
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO public.dogs (
  owner_id,
  name,
  breed,
  age_years,
  size,
  gender,
  temperament,
  district,
  description,
  status
)
SELECT
  owner_profile.owner_id,
  demo.name,
  demo.breed,
  demo.age_years,
  demo.size,
  demo.gender,
  demo.temperament,
  demo.district,
  demo.description,
  'active'
FROM owner_profile
CROSS JOIN (
  VALUES
    ('Maya', 'French Bulldog', 2, 'small', 'female', 'calm, affectionate, curious', 'Mladost', 'Compact companion with a big personality and a calm home vibe.'),
    ('Rex', 'German Shepherd', 5, 'large', 'male', 'loyal, alert, intelligent', 'Nadezhda', 'Confident and smart dog that enjoys structure and training.'),
    ('Nala', 'Golden Retriever', 3, 'large', 'female', 'social, sweet, energetic', 'Studentski Grad', 'Friendly dog that gets along well with people and other dogs.'),
    ('Bibi', 'Mixed Breed', 1, 'small', 'female', 'playful, shy, quick learner', 'Krasno Selo', 'Young rescue with a gentle nature and lots of potential.'),
    ('Teddy', 'Cocker Spaniel', 6, 'medium', 'male', 'calm, cuddly, obedient', 'Lyulin', 'Easygoing dog who likes a relaxed routine and regular affection.')
) AS demo(name, breed, age_years, size, gender, temperament, district, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dogs existing
  WHERE existing.owner_id = owner_profile.owner_id
    AND lower(existing.name) = lower(demo.name)
);

WITH bibi_dog AS (
  SELECT id AS dog_id
  FROM public.dogs
  WHERE lower(name) = 'bibi'
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO public.adoption_posts (
  dog_id,
  title,
  description,
  status,
  created_at
)
SELECT
  bibi_dog.dog_id,
  'Bibi is looking for a loving home',
  'Bibi is a gentle young dog who would thrive in a patient home with soft routines, affection, and daily walks.',
  'published',
  timestamptz '2026-07-10 09:00:00+00'
FROM bibi_dog
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adoption_posts existing
  WHERE existing.dog_id = bibi_dog.dog_id
    AND lower(existing.title) = lower('Bibi is looking for a loving home')
);

WITH teddy_dog AS (
  SELECT id AS dog_id
  FROM public.dogs
  WHERE lower(name) = 'teddy'
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO public.adoption_posts (
  dog_id,
  title,
  description,
  status,
  created_at
)
SELECT
  teddy_dog.dog_id,
  'A calm home needed for Teddy',
  'Teddy is a calm, affectionate companion who would do best in a relaxed home with regular companionship and steady care.',
  'published',
  timestamptz '2026-07-10 09:10:00+00'
FROM teddy_dog
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adoption_posts existing
  WHERE existing.dog_id = teddy_dog.dog_id
    AND lower(existing.title) = lower('A calm home needed for Teddy')
);

WITH rex_dog AS (
  SELECT id AS dog_id
  FROM public.dogs
  WHERE lower(name) = 'rex'
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO public.lost_dog_reports (
  dog_id,
  last_seen_location,
  last_seen_date,
  contact_phone,
  status,
  created_at
)
SELECT
  rex_dog.dog_id,
  'Borisova Gradina, Sofia',
  date '2026-07-10',
  '+359 88 000 0000',
  'active',
  timestamptz '2026-07-10 10:00:00+00'
FROM rex_dog
WHERE NOT EXISTS (
  SELECT 1
  FROM public.lost_dog_reports existing
  WHERE existing.dog_id = rex_dog.dog_id
    AND lower(existing.last_seen_location) = lower('Borisova Gradina, Sofia')
    AND existing.last_seen_date = date '2026-07-10'
);

INSERT INTO public.places (
  name,
  type,
  district,
  address,
  description,
  created_at
)
SELECT
  demo.name,
  demo.type,
  demo.district,
  demo.address,
  demo.description,
  timestamptz '2026-07-10 11:00:00+00'
FROM (
  VALUES
    ('Paws & Care Veterinary Clinic', 'veterinary clinic', 'Lozenets', 'ul. Bogatitsa 12, Sofia', 'Demo veterinary clinic with basic checkups, vaccinations and friendly staff.'),
    ('South Park Dog Zone', 'dog park', 'Lozenets', 'South Park, Sofia', 'Open green space for leash walks and relaxed off-leash play in designated areas.'),
    ('Happy Tails Pet Shop', 'pet shop', 'Mladost', 'Mladost 3, bl. 303, Sofia', 'Demo pet shop with food, toys, harnesses and everyday dog care supplies.'),
    ('Bark & Brew Cafe', 'dog-friendly cafe', 'Center', 'ul. Graf Ignatiev 48, Sofia', 'Dog-friendly cafe with outdoor seating and water bowls for visiting pets.')
) AS demo(name, type, district, address, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.places existing
  WHERE lower(existing.name) = lower(demo.name)
    AND lower(existing.address) = lower(demo.address)
);
