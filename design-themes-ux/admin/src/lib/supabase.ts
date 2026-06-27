import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://lqssptijgqqbgmgewlsn.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImQyNzkzZTgwLTBkZWQtNGI2Zi1iMGIwLWM0NTc0MWVjMTBhNSJ9.eyJwcm9qZWN0SWQiOiJscXNzcHRpamdxcWJnbWdld2xzbiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgxNTA1NDc1LCJleHAiOjIwOTY4NjU0NzUsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.D92esPKjGFsrOAqIgEK9PxMSOLV1kJ2h_7HMIs7c2lU';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };