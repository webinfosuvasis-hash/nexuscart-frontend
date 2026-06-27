// Mock data for the e-commerce SaaS admin platform

export const revenueData = [
  { month: 'Jan', revenue: 42000, orders: 320, profit: 18000 },
  { month: 'Feb', revenue: 38500, orders: 298, profit: 15800 },
  { month: 'Mar', revenue: 51200, orders: 410, profit: 22400 },
  { month: 'Apr', revenue: 47800, orders: 380, profit: 20100 },
  { month: 'May', revenue: 62300, orders: 489, profit: 28900 },
  { month: 'Jun', revenue: 58900, orders: 455, profit: 26700 },
  { month: 'Jul', revenue: 71400, orders: 562, profit: 34200 },
  { month: 'Aug', revenue: 68200, orders: 531, profit: 32100 },
  { month: 'Sep', revenue: 79800, orders: 618, profit: 39400 },
  { month: 'Oct', revenue: 84500, orders: 672, profit: 42800 },
  { month: 'Nov', revenue: 98200, orders: 781, profit: 51200 },
  { month: 'Dec', revenue: 112400, orders: 894, profit: 61300 },
];

export const trafficSources = [
  { name: 'Organic Search', value: 42, color: '#4f46e5' },
  { name: 'Direct', value: 23, color: '#10b981' },
  { name: 'Social Media', value: 18, color: '#f59e0b' },
  { name: 'Paid Ads', value: 12, color: '#ef4444' },
  { name: 'Referral', value: 5, color: '#8b5cf6' },
];

export const topProducts = [
  { name: 'Wireless Earbuds Pro', views: 12400, sales: 892, revenue: 71360 },
  { name: 'Smart Watch Series 7', views: 9800, sales: 654, revenue: 130800 },
  { name: 'Leather Backpack', views: 8200, sales: 512, revenue: 46080 },
  { name: 'Mechanical Keyboard', views: 7600, sales: 421, revenue: 50520 },
  { name: 'Ceramic Coffee Mug Set', views: 6900, sales: 738, revenue: 22140 },
  { name: 'Running Shoes Ultra', views: 6400, sales: 389, revenue: 42790 },
];

const categories = ['Electronics', 'Apparel', 'Home & Living', 'Beauty', 'Sports', 'Accessories'];
const statuses = ['Active', 'Draft', 'Archived'];
const productNames = [
  'Wireless Earbuds Pro', 'Smart Watch Series 7', 'Leather Backpack', 'Mechanical Keyboard',
  'Ceramic Coffee Mug Set', 'Running Shoes Ultra', 'Cotton Hoodie', 'Bluetooth Speaker',
  'Yoga Mat Premium', 'Desk Lamp LED', 'Sunglasses Aviator', 'Water Bottle Insulated',
  'Phone Case Clear', 'Wool Beanie', 'Gaming Mouse RGB', 'Scented Candle Vanilla',
  'Denim Jacket', 'Wireless Charger', 'Resistance Bands Set', 'Face Serum Vitamin C',
  'Travel Pillow', 'Notebook Hardcover', 'Stainless Steel Pan', 'Fitness Tracker',
];

export const products = productNames.map((name, i) => ({
  id: `PRD-${1000 + i}`,
  name,
  category: categories[i % categories.length],
  price: Math.round((19.99 + i * 7.3) * 100) / 100,
  stock: Math.floor(Math.random() * 240),
  status: statuses[i % 3 === 0 ? 0 : i % 5 === 0 ? 1 : 0],
  sku: `SKU-${4000 + i}`,
  sales: Math.floor(Math.random() * 900),
  rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
  featured: i % 4 === 0,
  image: `https://picsum.photos/seed/p${i}/80`,
}));

const customerNames = [
  'Aarav Sharma', 'Priya Patel', 'Liam Johnson', 'Emma Williams', 'Noah Brown',
  'Olivia Davis', 'Rohan Mehta', 'Sophia Garcia', 'Ethan Wilson', 'Ananya Singh',
  'Mason Lee', 'Isabella Martinez', 'Vihaan Gupta', 'Mia Anderson', 'Lucas Taylor',
  'Diya Reddy', 'Logan Thomas', 'Charlotte Moore', 'Arjun Kumar', 'Amelia Jackson',
];

export const customers = customerNames.map((name, i) => ({
  id: `CUST-${2000 + i}`,
  name,
  email: name.toLowerCase().replace(' ', '.') + '@email.com',
  orders: Math.floor(Math.random() * 40) + 1,
  spent: Math.round((Math.random() * 8000 + 200) * 100) / 100,
  segment: ['VIP', 'Regular', 'New', 'At Risk'][i % 4],
  joined: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
  status: i % 7 === 0 ? 'Inactive' : 'Active',
}));

const orderStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];
const payMethods = ['Stripe', 'Razorpay', 'PayPal', 'COD'];

export const orders = Array.from({ length: 32 }, (_, i) => ({
  id: `#ORD-${9000 + i}`,
  customer: customerNames[i % customerNames.length],
  date: `2025-06-${String((i % 14) + 1).padStart(2, '0')}`,
  items: Math.floor(Math.random() * 5) + 1,
  total: Math.round((Math.random() * 600 + 30) * 100) / 100,
  status: orderStatuses[i % orderStatuses.length],
  payment: payMethods[i % payMethods.length],
}));

export const categoryTree = [
  { id: 1, name: 'Electronics', count: 142, level: 0, children: [
    { id: 11, name: 'Audio', count: 38, level: 1 },
    { id: 12, name: 'Wearables', count: 24, level: 1 },
    { id: 13, name: 'Computer Accessories', count: 56, level: 1 },
  ]},
  { id: 2, name: 'Apparel', count: 218, level: 0, children: [
    { id: 21, name: "Men's", count: 98, level: 1 },
    { id: 22, name: "Women's", count: 102, level: 1 },
    { id: 23, name: 'Kids', count: 18, level: 1 },
  ]},
  { id: 3, name: 'Home & Living', count: 174, level: 0, children: [
    { id: 31, name: 'Kitchen', count: 64, level: 1 },
    { id: 32, name: 'Decor', count: 48, level: 1 },
  ]},
  { id: 4, name: 'Beauty', count: 96, level: 0, children: [] },
  { id: 5, name: 'Sports', count: 130, level: 0, children: [] },
];

export const coupons = [
  { id: 1, code: 'SUMMER25', type: '25% Off', uses: 1240, limit: 5000, status: 'Active', expires: '2025-08-31' },
  { id: 2, code: 'FREESHIP', type: 'Free Shipping', uses: 3820, limit: 10000, status: 'Active', expires: '2025-12-31' },
  { id: 3, code: 'WELCOME10', type: '$10 Off', uses: 892, limit: 2000, status: 'Active', expires: '2025-09-15' },
  { id: 4, code: 'FLASH50', type: '50% Off', uses: 5000, limit: 5000, status: 'Expired', expires: '2025-05-01' },
  { id: 5, code: 'VIPONLY', type: '30% Off', uses: 124, limit: 500, status: 'Active', expires: '2025-10-20' },
];

export const warehouses = [
  { id: 1, name: 'Mumbai Central DC', location: 'Mumbai, MH', stock: 12400, capacity: 20000, status: 'Operational' },
  { id: 2, name: 'Bangalore Hub', location: 'Bangalore, KA', stock: 8900, capacity: 15000, status: 'Operational' },
  { id: 3, name: 'Delhi North FC', location: 'Delhi, DL', stock: 14200, capacity: 18000, status: 'Operational' },
  { id: 4, name: 'Chennai Coastal', location: 'Chennai, TN', stock: 3200, capacity: 12000, status: 'Low Capacity' },
];

export const suppliers = [
  { id: 1, name: 'TechSource Global', items: 84, leadTime: '7 days', rating: 4.8, status: 'Active' },
  { id: 2, name: 'Fabric & Co', items: 142, leadTime: '12 days', rating: 4.5, status: 'Active' },
  { id: 3, name: 'HomeGoods Ltd', items: 67, leadTime: '5 days', rating: 4.9, status: 'Active' },
  { id: 4, name: 'BeautyWholesale', items: 38, leadTime: '10 days', rating: 4.2, status: 'Pending' },
];

export const lowStock = products.filter(p => p.stock < 30).slice(0, 6);

export const cmsBlocks = [
  { id: 'hero', name: 'Hero Banner', icon: 'Image', desc: 'Full-width hero with CTA' },
  { id: 'features', name: 'Feature Grid', icon: 'Grid3x3', desc: '3-column feature highlights' },
  { id: 'products', name: 'Product Carousel', icon: 'ShoppingBag', desc: 'Scrollable product showcase' },
  { id: 'testimonials', name: 'Testimonials', icon: 'Quote', desc: 'Customer reviews slider' },
  { id: 'newsletter', name: 'Newsletter', icon: 'Mail', desc: 'Email capture form' },
  { id: 'banner', name: 'Promo Banner', icon: 'Megaphone', desc: 'Promotional strip' },
  { id: 'gallery', name: 'Image Gallery', icon: 'Images', desc: 'Masonry image grid' },
  { id: 'video', name: 'Video Block', icon: 'Video', desc: 'Embedded video player' },
];
