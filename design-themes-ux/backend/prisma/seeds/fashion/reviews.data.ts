export interface CustomerSeed {
  email: string;
  name: string;
  phone: string;
  segment: 'VIP' | 'REGULAR' | 'NEW' | 'AT_RISK';
  city: string;
  state: string;
}

export const CUSTOMERS: CustomerSeed[] = [
  { email: 'priya.sharma@example.com',   name: 'Priya Sharma',   phone: '+91 98200 11223', segment: 'VIP',     city: 'Mumbai',     state: 'Maharashtra' },
  { email: 'ananya.iyer@example.com',    name: 'Ananya Iyer',    phone: '+91 98450 22334', segment: 'REGULAR', city: 'Bengaluru',  state: 'Karnataka' },
  { email: 'kavya.reddy@example.com',    name: 'Kavya Reddy',    phone: '+91 99080 33445', segment: 'REGULAR', city: 'Hyderabad',  state: 'Telangana' },
  { email: 'meera.nair@example.com',     name: 'Meera Nair',     phone: '+91 97450 44556', segment: 'NEW',     city: 'Kochi',      state: 'Kerala' },
  { email: 'ritu.singh@example.com',     name: 'Ritu Singh',     phone: '+91 98100 55667', segment: 'VIP',     city: 'Delhi',      state: 'Delhi' },
  { email: 'sneha.patel@example.com',    name: 'Sneha Patel',    phone: '+91 99250 66778', segment: 'REGULAR', city: 'Ahmedabad',  state: 'Gujarat' },
  { email: 'pooja.verma@example.com',    name: 'Pooja Verma',    phone: '+91 98330 77889', segment: 'REGULAR', city: 'Lucknow',    state: 'Uttar Pradesh' },
  { email: 'divya.menon@example.com',    name: 'Divya Menon',    phone: '+91 97870 88990', segment: 'NEW',     city: 'Chennai',    state: 'Tamil Nadu' },
  { email: 'isha.kapoor@example.com',    name: 'Isha Kapoor',    phone: '+91 98920 99001', segment: 'VIP',     city: 'Pune',       state: 'Maharashtra' },
  { email: 'neha.joshi@example.com',     name: 'Neha Joshi',     phone: '+91 99700 10112', segment: 'AT_RISK', city: 'Jaipur',     state: 'Rajasthan' },
];

export interface ReviewTemplate {
  rating: number;
  title: string;
  body: string;
  isVerified: boolean;
}

export const REVIEW_TEMPLATES: ReviewTemplate[] = [
  { rating: 5, title: 'Absolutely loved it!',          body: 'The fabric quality is fantastic and the fit is exactly as shown in the pictures. Got so many compliments wearing this to a family function.', isVerified: true },
  { rating: 5, title: 'Worth every rupee',             body: 'Premium quality, fast delivery and beautiful packaging. This is now my go-to brand for ethnic wear.',                                          isVerified: true },
  { rating: 4, title: 'Great quality, true to size',   body: 'Fabric feels rich and the colour matches the photos. Sizing was accurate as per the chart. Would definitely order again.',                     isVerified: true },
  { rating: 4, title: 'Beautiful design',              body: 'The embroidery work is even more beautiful in person. Slightly long for my height but easy to get tailored.',                                  isVerified: true },
  { rating: 5, title: 'Perfect for the occasion',      body: 'Wore this for a wedding function and felt like a million bucks. The drape and finishing are top notch.',                                       isVerified: true },
  { rating: 3, title: 'Good but delivery was slow',    body: 'Product quality is good, matches the description, but it took longer than expected to arrive. Otherwise happy with the purchase.',             isVerified: true },
  { rating: 5, title: 'Stunning piece',                body: 'The colour is even richer in person. Lightweight and comfortable to wear for long hours. Highly recommend.',                                   isVerified: false },
  { rating: 4, title: 'Nice fabric and finishing',     body: 'Loved the fabric quality and stitching. The only reason for 4 stars is the packaging could be better.',                                        isVerified: true },
  { rating: 5, title: 'Exceeded my expectations',      body: 'I was a bit skeptical ordering online but this exceeded my expectations. The fit and finish are excellent.',                                   isVerified: true },
  { rating: 4, title: 'Lovely for the price',          body: 'Great value for money. The fabric is soft and breathable, perfect for everyday wear.',                                                          isVerified: true },
  { rating: 5, title: 'My new favourite',              body: 'Bought this for Diwali and it was perfect. Got the fit altered slightly but the base quality is excellent.',                                   isVerified: true },
  { rating: 3, title: 'Decent, color slightly different', body: 'The product is decent overall but the actual colour is a shade darker than what was shown on screen.',                                     isVerified: false },
];
