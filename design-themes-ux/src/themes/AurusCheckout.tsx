import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import {
  ArrowLeft, Check, ChevronRight, MapPin, CreditCard,
  Smartphone, Wallet, Truck, Lock, ShoppingBag,
} from 'lucide-react';

const UI    = { fontFamily: 'system-ui, -apple-system, sans-serif' };
const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

const PAYMENT_METHODS = [
  { id: 'upi',  label: 'UPI',              icon: Smartphone, sub: 'Google Pay, PhonePe, Paytm'   },
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, sub: 'Visa, Mastercard, RuPay'    },
  { id: 'cod',  label: 'Cash on Delivery',  icon: Truck,      sub: 'Pay when you receive'         },
  { id: 'emi',  label: 'EMI',              icon: Wallet,     sub: 'No-cost EMI on 3â€“12 months'   },
];

/* â”€â”€â”€ Order success overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const OrderSuccess: React.FC<{ orderId: string; total: number; onClose: () => void }> = ({ orderId, total, onClose }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
    <div className="bg-white rounded-2xl shadow-2xl max-w-[420px] w-full p-8 text-center" style={UI}>
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
        <Check className="w-10 h-10 text-green-500" strokeWidth={2.5}/>
      </div>
      <h2 className="text-[22px] font-bold text-gray-900 mb-1">Order Confirmed!</h2>
      <p className="text-[13px] text-gray-500 mb-4">Thank you for shopping with Aurus. Your order is on its way.</p>

      <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-3 mb-4">
        <p className="text-[11px] text-purple-500 uppercase tracking-wide font-semibold">Order ID</p>
        <p className="text-[18px] font-black text-purple-700 mt-0.5 tracking-wider">{orderId}</p>
      </div>

      <div className="text-left space-y-2 text-[12.5px] text-gray-600 border-t border-gray-100 pt-4 mb-6">
        <div className="flex justify-between">
          <span>Amount paid</span>
          <span className="font-bold text-gray-900">{inr(total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Estimated delivery</span>
          <span className="font-semibold text-green-600">5â€“7 working days</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span className="font-semibold text-green-600">FREE</span>
        </div>
      </div>

      <Link
        to="/jewellery/rings"
        onClick={onClose}
        className="block w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold text-[13px] tracking-wide rounded-full transition-colors mb-3"
      >
        Continue Shopping
      </Link>
      <button onClick={onClose} className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors">
        Close
      </button>
    </div>
  </div>
);

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CHECKOUT PAGE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const AurusCheckout: React.FC = () => {
  const { cart, cartTotal } = useStore();
  const navigate = useNavigate();

  /* Address */
  const [addr, setAddr] = useState({ name:'', phone:'', pincode:'', address:'', city:'', state:'', landmark:'' });
  const [payment, setPayment] = useState('upi');
  const [upiId,   setUpiId]   = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId] = useState(() => 'ORD' + Math.random().toString(36).slice(2,8).toUpperCase());

  const subtotal   = cart.reduce((s, l) => s + l.mrp   * l.qty, 0);
  const totalSaved = cart.reduce((s, l) => s + (l.mrp - l.price) * l.qty, 0);
  const totalCost  = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const addrFilled = addr.name && addr.phone.length === 10 && addr.pincode.length === 6 && addr.address && addr.city;

  const handleConfirm = () => {
    if (!addrFilled) return;
    setOrderSuccess(true);
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3FA]" style={UI}>
        <ShoppingBag className="w-14 h-14 text-purple-200 mb-4"/>
        <p className="text-[18px] font-semibold text-gray-700 mb-4">Your cart is empty</p>
        <Link to="/jewellery/rings" className="bg-purple-700 text-white px-8 py-2.5 rounded-full text-[13px] font-bold hover:bg-purple-800 transition-colors">
          Browse Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3FA]" style={UI}>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-6 h-[54px] flex items-center gap-4">
          <button onClick={() => navigate('/cart')} className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px]">
            <ArrowLeft className="w-4 h-4"/> Back to Bag
          </button>
          <div className="flex-1 text-center">
            <span className="text-[18px] font-light text-gray-900" style={SERIF}>Checkout</span>
          </div>
          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px]" style={UI}>
            <span className="text-purple-700 font-bold">â‘  Address</span>
            <ChevronRight className="w-3 h-3 text-gray-300"/>
            <span className="text-gray-400">â‘¡ Payment</span>
            <ChevronRight className="w-3 h-3 text-gray-300"/>
            <span className="text-gray-400">â‘¢ Confirm</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

        {/* â”€â”€ LEFT: Address + Payment â”€â”€ */}
        <div className="space-y-5">

          {/* Delivery Address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-4.5 h-4.5 text-purple-600" style={{ width: 18, height: 18 }}/>
              <h2 className="text-[15px] font-bold text-gray-900">Delivery Address</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name *"      value={addr.name}     onChange={v => setAddr(a=>({...a,name:v}))}     placeholder="Priya Sharma"/>
              <Field label="Mobile Number *"  value={addr.phone}    onChange={v => setAddr(a=>({...a,phone:v}))}    placeholder="10-digit number" type="number" maxLen={10}/>
              <Field label="Pincode *"        value={addr.pincode}  onChange={v => setAddr(a=>({...a,pincode:v}))}  placeholder="6-digit pincode"  type="number" maxLen={6}/>
              <Field label="City *"           value={addr.city}     onChange={v => setAddr(a=>({...a,city:v}))}     placeholder="Mumbai"/>
              <div className="sm:col-span-2">
                <Field label="Address (House / Flat / Area) *" value={addr.address} onChange={v => setAddr(a=>({...a,address:v}))} placeholder="House No., Street, Locality"/>
              </div>
              <Field label="State"            value={addr.state}    onChange={v => setAddr(a=>({...a,state:v}))}    placeholder="Maharashtra"/>
              <Field label="Landmark"         value={addr.landmark} onChange={v => setAddr(a=>({...a,landmark:v}))} placeholder="Near Metro Station (optional)"/>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <CreditCard className="w-4.5 h-4.5 text-purple-600" style={{ width: 18, height: 18 }}/>
              <h2 className="text-[15px] font-bold text-gray-900">Payment Method</h2>
            </div>

            <div className="space-y-3">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                const sel  = payment === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPayment(m.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left"
                    style={{ borderColor: sel ? '#7C3AED' : '#E5E7EB', background: sel ? '#FAF5FF' : '#fff' }}
                  >
                    {/* Radio */}
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: sel ? '#7C3AED' : '#CBD5E1' }}>
                      {sel && <div className="w-2 h-2 rounded-full bg-purple-700"/>}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: sel ? '#EDE9FE' : '#F3F4F6' }}>
                      <Icon className="w-4 h-4" style={{ color: sel ? '#7C3AED' : '#6B7280' }}/>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">{m.label}</p>
                      <p className="text-[11px] text-gray-400">{m.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* UPI input */}
            {payment === 'upi' && (
              <div className="mt-4">
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">UPI ID</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                />
              </div>
            )}

            {/* COD note */}
            {payment === 'cod' && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-[12px] text-amber-800">
                â‚¹50 COD convenience fee will be added at order confirmation.
              </div>
            )}
          </div>
        </div>

        {/* â”€â”€ RIGHT: Order Summary â”€â”€ */}
        <div className="space-y-4">

          {/* Items list */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-gray-900 mb-4">
              Order Summary ({cart.length} item{cart.length > 1 ? 's' : ''})
            </h2>
            <div className="space-y-3">
              {cart.map(line => (
                <div key={line.id} className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={line.image} alt={line.name} loading="lazy" className="w-full h-full object-cover"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 line-clamp-1">{line.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Qty: {line.qty}</p>
                  </div>
                  <span className="text-[13px] font-bold text-gray-900 flex-shrink-0">{inr(line.price * line.qty)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price breakdown */}
          <div className="bg-white rounded-xl shadow-sm px-5 py-4 space-y-2.5">
            <PriceRow label="Subtotal"           value={inr(subtotal)}/>
            <PriceRow label="You Saved"          value={`â€“ ${inr(totalSaved)}`} valueColor="#00897B"/>
            <PriceRow label="Coupon Discount"    value="â€”"/>
            <PriceRow label="Shipping"           value="FREE" valueColor="#00897B"/>
            {payment === 'cod' && <PriceRow label="COD Fee" value={inr(50)}/>}
            <div className="h-px bg-gray-200 my-1"/>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-gray-900">Total</span>
              <span className="text-[16px] font-black text-gray-900">{inr(totalCost + (payment === 'cod' ? 50 : 0))}</span>
            </div>
          </div>

          {/* Confirm CTA */}
          <button
            onClick={handleConfirm}
            disabled={!addrFilled}
            className="w-full py-4 text-white text-[14px] font-black tracking-[0.12em] uppercase rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
            style={{ background: addrFilled ? 'linear-gradient(90deg,#9333EA,#7B22F9)' : '#9CA3AF', boxShadow: addrFilled ? '0 4px 14px rgba(124,58,237,0.4)' : 'none' }}
          >
            {addrFilled ? `CONFIRM & PAY ${inr(totalCost + (payment === 'cod' ? 50 : 0))}` : 'FILL ADDRESS TO CONTINUE'}
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <Lock className="w-3 h-3"/>
            100% Secure & Encrypted Payment
          </div>
        </div>
      </div>

      {/* Order success */}
      {orderSuccess && (
        <OrderSuccess
          orderId={orderId}
          total={totalCost + (payment === 'cod' ? 50 : 0)}
          onClose={() => { setOrderSuccess(false); navigate('/jewellery/rings'); }}
        />
      )}
    </div>
  );
};

/* â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; maxLen?: number;
}> = ({ label, value, onChange, placeholder, type = 'text', maxLen }) => (
  <div>
    <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5" style={UI}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(maxLen ? e.target.value.slice(0, maxLen) : e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
      style={UI}
    />
  </div>
);

const PriceRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="flex items-center justify-between text-[12.5px]" style={UI}>
    <span className="text-gray-500">{label}</span>
    <span className="font-semibold" style={{ color: valueColor ?? '#1F2937' }}>{value}</span>
  </div>
);

export default AurusCheckout;

