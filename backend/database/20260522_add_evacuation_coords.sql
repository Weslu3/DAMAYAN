-- Add latitude/longitude columns to evacuation_centers for map visualisation
ALTER TABLE public.evacuation_centers
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- Optional: populate new columns from admin_sample_shelters where names match (best-effort)
-- This tries to find a shelter entry with same name and copy coords; adjust as needed.
UPDATE public.evacuation_centers ec
SET lat = s.lat, lng = s.lng
FROM public.admin_sample_shelters s
WHERE ec.name = s.name
  AND (ec.lat IS NULL OR ec.lng IS NULL);

-- Create an index for faster spatial lookups when converted to geometry later
CREATE INDEX IF NOT EXISTS evacuation_centers_lat_lng_idx ON public.evacuation_centers (lat, lng);
