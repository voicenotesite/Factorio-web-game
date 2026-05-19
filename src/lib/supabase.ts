import { createClient } from '@supabase/supabase-js';

/** Klient Supabase – inicjalizowany z publicznymi kluczami projektu. */
export const supabase = createClient(
  'https://kxxbowcujznapkrfdovu.supabase.co',
  'sb_publishable_EbZEhP77H7B6k6BN4wwOOA_Am8mzWJe'
);
