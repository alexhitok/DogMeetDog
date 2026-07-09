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
