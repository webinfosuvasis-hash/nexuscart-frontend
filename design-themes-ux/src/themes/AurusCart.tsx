import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore, inr, cartLineKey } from '@/context/StoreContext';
import { PRODUCTS } from '@/data/products';
import {
  ArrowLeft, X, Plus, Minus, ChevronDown, ChevronUp,
  MapPin, Tag, MessageCircle, Phone,
  RefreshCw, Award, Clock, ShoppingBag, ChevronRight, Check,
} from 'lucide-react';

const UI = { fontFamily: 'system-ui, -apple-system, sans-serif' };

/* â”€â”€â”€ TRUST FOOTER BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const TrustBar: React.FC = () => (
  <footer className="bg-white border-t border-gray-200 mt-auto" style={UI}>
    <div className="px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-8 flex-wrap">
        {([
          [RefreshCw, '15 Day Exchange',   'On Online Orders'],
          [Award,     '100% Certified',    ''],
          [RefreshCw, 'Lifetime Exchange', ''],
          [Clock,     'One Year Warranty', ''],
        ] as const).map(([Icon, title, sub]: any, i) => (
          <div key={i} className="flex items-center gap-2">
            <Icon className="w-[22px] h-[22px] text-gray-500 flex-shrink-0" strokeWidth={1.5}/>
            <div>
              <p className="text-[13px] font-semibold text-gray-700 leading-none">{title}</p>
              {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {['VISA', 'Mastercard', 'PayPal', 'American Express'].map((b) => (
          <div key={b} className="border border-gray-300 rounded px-2.5 py-1.5 h-[30px] flex items-center">
            <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{b}</span>
          </div>
        ))}
      </div>
    </div>
  </footer>
);

/* â”€â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CartHeader: React.FC<{
  activeTab: 'bag' | 'trial';
  setActiveTab: (t: 'bag' | 'trial') => void;
  cartCount: number;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ activeTab, setActiveTab, cartCount, navigate }) => (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40" style={UI}>
    <div className="px-6 h-[54px] flex items-center gap-4">

      <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-purple-700 transition-colors flex-shrink-0">
        <ArrowLeft className="w-5 h-5"/>
      </button>

      {/* Dot-grid CL logo matching CaratLane exactly */}
      <Link to="/jewellery/rings" className="w-8 h-8 rounded-full border-2 border-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <div className="grid grid-cols-3 gap-[2px] p-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className={`w-[4px] h-[4px] rounded-full ${[0,2,4,6,8].includes(i) ? 'bg-purple-700' : 'bg-purple-300'}`}/>
          ))}
        </div>
      </Link>

      {/* Centered pill tabs */}
      <div className="flex-1 flex justify-center">
        <div className="inline-flex border border-gray-300 rounded-full overflow-hidden text-[13px]">
          <button
            onClick={() => setActiveTab('bag')}
            className="px-6 py-[7px] font-medium transition-all whitespace-nowrap"
            style={activeTab === 'bag'
              ? { background: 'linear-gradient(90deg,#9333EA,#7B22F9)', color: '#fff' }
              : { background: '#fff', color: '#555' }}
          >
            Shopping Bag ({cartCount})
          </button>
          <button
            onClick={() => setActiveTab('trial')}
            className="px-6 py-[7px] font-medium transition-all whitespace-nowrap"
            style={activeTab === 'trial'
              ? { background: 'linear-gradient(90deg,#9333EA,#7B22F9)', color: '#fff' }
              : { background: '#fff', color: '#555' }}
          >
            Home Trial (0)
          </button>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] text-gray-500">Need Assistance?</span>
        <MessageCircle className="w-5 h-5 text-green-500 cursor-pointer"/>
        <Phone className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"/>
      </div>
    </div>
  </header>
);

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN CART COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const AurusCart: React.FC = () => {
  const { cart, removeFromCart, updateQty, addToCart } = useStore();
  const navigate = useNavigate();

  const [activeTab,  setActiveTab]  = useState<'bag'|'trial'>('bag');
  const [fbtOpen,    setFbtOpen]    = useState(true);
  const [pincode,         setPincode]         = useState('');
  const [pincodeOk,       setPincodeOk]       = useState(false);
  const [showPincodeInput,setShowPincodeInput] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');

  const subtotal   = cart.reduce((s, l) => s + l.mrp   * l.qty, 0);
  const totalSaved = cart.reduce((s, l) => s + (l.mrp - l.price) * l.qty, 0);
  const totalCost  = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const cartIds  = new Set(cart.map(l => l.id));
  const fbtItems = PRODUCTS.aurus.filter(p => !cartIds.has(p.id)).slice(0, 3);

  /* â”€â”€ EMPTY STATE â”€â”€ */
  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F5F3F8', ...UI }}>
        <CartHeader activeTab={activeTab} setActiveTab={setActiveTab} cartCount={0} navigate={navigate}/>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <ShoppingBag className="w-14 h-14 text-purple-200 mb-4"/>
          <h2 className="text-[20px] font-semibold text-gray-800 mb-2">Your Shopping Bag is Empty</h2>
          <p className="text-[13px] text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
          <Link to="/jewellery/rings" className="bg-purple-700 text-white px-8 py-2.5 text-[13px] font-bold tracking-wide hover:bg-purple-800 transition-colors">
            CONTINUE SHOPPING
          </Link>
        </div>
        <TrustBar/>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F3F8', ...UI }}>

      <CartHeader activeTab={activeTab} setActiveTab={setActiveTab} cartCount={cart.length} navigate={navigate}/>

      {/* â”€â”€ Main content â€” centered, same proportions as CaratLane â”€â”€ */}
      <div className="flex-1 w-full">
        {/*
          CaratLane uses a ~970px centered container.
          Grid: left column (flex-1) + right sidebar (300px) with ~32px gap.
        */}
        <div className="max-w-[1280px] mx-auto px-6 pt-[82px] pb-12">
          <div className="flex gap-8 items-start">

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                LEFT â€” Cart Items
            â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="flex-1 min-w-0 space-y-3">

              {/* Video-call banner */}
              <div
                className="flex items-center gap-4 px-5 py-4 rounded-xl"
                style={{ background: 'linear-gradient(90deg,#C8F5EE 0%,#AEEAE1 100%)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,137,123,0.2)' }}
                >
                  <MessageCircle className="w-5 h-5" style={{ color: '#00695C' }}/>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold leading-none mb-1" style={{ color: '#004D40' }}>
                    See it Before You Buy It
                  </p>
                  <p className="text-[12px]" style={{ color: '#00695C' }}>
                    Experience our designs in detail via video call
                  </p>
                </div>
                <button
                  className="flex-shrink-0 text-white text-[11px] font-bold tracking-[0.12em] uppercase px-5 py-2 rounded"
                  style={{ background: '#00897B' }}
                >
                  SEE IT LIVE
                </button>
              </div>

              {/* Cart item cards */}
              {cart.map(line => {
                const itemSave = (line.mrp - line.price) * line.qty;
                const lineKey = cartLineKey(line);
                return (
                  <div key={lineKey} className="bg-white rounded-lg" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <div className="flex gap-4 p-4">

                      {/* Product image â€” 120px, white bg, orange badge at bottom */}
                      <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
                        <div
                          className="w-full h-full rounded overflow-hidden flex items-center justify-center"
                          style={{ background: '#FAFAFA', border: '1px solid #F0F0F0' }}
                        >
                          <img
                            src={line.image}
                            alt={line.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* ðŸ”¥ badge */}
                        <div
                          className="absolute bottom-0 left-0 right-0 text-white text-center leading-none font-bold"
                          style={{ background: '#F57C00', fontSize: 8, padding: '3px 2px' }}
                        >
                          ðŸ”¥ 13k+ BOUGHT THIS
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 justify-between">
                          <Link
                            to={`/products/${line.id}`}
                            className="text-[14px] font-semibold text-gray-900 hover:text-purple-700 transition-colors leading-snug line-clamp-2 flex-1"
                          >
                            {line.name}
                          </Link>
                          {/* Dark âœ• button â€” matches CaratLane */}
                          <button
                            onClick={() => removeFromCart(lineKey)}
                            className="flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-colors"
                            style={{ background: '#333' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#C62828')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#333')}
                          >
                            <X className="w-3 h-3 text-white"/>
                          </button>
                        </div>

                        {/* Price row */}
                        <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                          <span className="text-[15px] font-bold text-gray-900">{inr(line.price * line.qty)}</span>
                          <span className="text-[13px] text-gray-400 line-through">{inr(line.mrp * line.qty)}</span>
                          <span className="text-[12px] font-bold" style={{ color: '#E91E8C' }}>
                            Save {inr(itemSave)}
                          </span>
                        </div>

                        {/* SKU â€” real variant SKU when present, else the parent product id */}
                        {line.variantSku && (
                          <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-wide">
                            {line.variantSku}
                          </p>
                        )}

                        {/* Quantity + delivery link */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2 text-[13px] text-gray-700">
                            <span>Quantity:</span>
                            <button
                              onClick={() => updateQty(lineKey, line.qty - 1)}
                              disabled={line.qty <= 1}
                              className="w-[20px] h-[20px] rounded-full border border-gray-400 flex items-center justify-center hover:border-purple-600 disabled:opacity-30 transition-colors"
                            >
                              <Minus className="w-3 h-3"/>
                            </button>
                            <span className="font-semibold">{line.qty}</span>
                            <button
                              onClick={() => updateQty(lineKey, line.qty + 1)}
                              className="w-[20px] h-[20px] rounded-full border border-gray-400 flex items-center justify-center hover:border-purple-600 transition-colors"
                            >
                              <Plus className="w-3 h-3"/>
                            </button>
                          </div>
                          {/* Pink link â€” matches CaratLane */}
                          <button
                            className="text-[12.5px] underline underline-offset-2"
                            style={{ color: '#E91E8C' }}
                          >
                            Check Delivery Date
                          </button>
                        </div>

                        {/* Variant chips â€” real selected options for API-driven products, legacy metalType for the static demo catalog */}
                        {line.variantOptions && Object.keys(line.variantOptions).length > 0 ? (
                          <div className="flex gap-2 mt-2.5 flex-wrap">
                            {Object.entries(line.variantOptions).map(([k, v]) => (
                              <span key={k} className="text-[10px] border border-gray-300 text-gray-600 px-2.5 py-0.5 rounded-full bg-white capitalize">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        ) : line.metalType && (
                          <div className="flex gap-2 mt-2.5">
                            <span className="text-[10px] border border-gray-300 text-gray-600 px-2.5 py-0.5 rounded-full bg-white">
                              {line.metalType}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Frequently Bought Together */}
              {fbtItems.length > 0 && (
                <div className="bg-white rounded-lg" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <button
                    onClick={() => setFbtOpen(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors rounded-lg"
                  >
                    <span className="text-[13.5px] font-semibold text-gray-800">Frequently Bought Together</span>
                    {fbtOpen ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                  </button>

                  {fbtOpen && (
                    <div className="px-5 pb-5 flex gap-4 overflow-x-auto">
                      {fbtItems.map(p => {
                        const inC = cartIds.has(p.id);
                        return (
                          <div key={p.id} className="flex-shrink-0 w-[140px]">
                            <div
                              className="relative w-[140px] h-[140px] rounded overflow-hidden"
                              style={{ background: '#F8F6FF' }}
                            >
                              <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover"/>
                              <button
                                onClick={() => addToCart(p)}
                                className="absolute top-1.5 right-1.5 bg-white border border-gray-200 rounded-full text-[8px] font-bold text-gray-700 px-1.5 py-0.5 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-all shadow-sm"
                              >
                                {inC ? 'âœ“' : '+ ADD'}
                              </button>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-baseline gap-1 flex-wrap">
                                <span className="text-[12px] font-bold text-gray-900">{inr(p.price)}</span>
                                <span className="text-[10px] text-gray-400 line-through">{inr(p.mrp)}</span>
                              </div>
                              <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2 leading-snug">{p.name}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                RIGHT â€” Order Summary
            â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="flex-shrink-0 space-y-3" style={{ width: 360, marginTop: 24 }}>

              {/* App promo card */}
              <div
                className="rounded-xl overflow-hidden relative"
                style={{ background: 'linear-gradient(135deg,#2D0353 0%,#5B1494 50%,#7C3AED 100%)' }}
              >
                {/* Header row: logo left, Free â‚¹500 right */}
                <div className="flex items-start justify-between px-4 pt-4 pb-0">
                  {/* Left: logo + description */}
                  <div style={{ maxWidth: 150 }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#E91E8C' }}>
                        <span className="text-white text-[7px] font-black">CL</span>
                      </div>
                      <div>
                        <p className="text-white text-[10px] font-bold leading-none">CaratLane</p>
                        <p className="text-[8px] leading-none" style={{ color: '#C9B8D8' }}>Fine Jewellery</p>
                      </div>
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: '#E0D4F0' }}>
                      Get â‚¹500 off by completing your profile on the App
                    </p>
                  </div>

                  {/* Right: Free + big â‚¹500 + Just for you! */}
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-[11px] font-light leading-none" style={{ color: '#C9B8D8' }}>Free</p>
                    <p
                      className="font-black leading-none mt-0.5"
                      style={{
                        fontSize: 38,
                        background: 'linear-gradient(135deg,#FF6BA8 0%,#FF8A65 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      â‚¹500
                    </p>
                    <p className="text-[8px] leading-none" style={{ color: '#C9B8D8' }}>Just for you!</p>
                  </div>
                </div>

                {/* Install App button */}
                <div className="px-4 pt-3 pb-4">
                  <button className="flex items-center gap-1 bg-white text-purple-900 text-[11.5px] font-bold px-4 py-1.5 rounded-full hover:bg-purple-50 transition-colors">
                    Install App <ChevronRight className="w-3 h-3"/>
                  </button>
                </div>
              </div>

              {/* Apply Coupon â€” lavender bg */}
              <div className="rounded-xl overflow-hidden" style={{ background: '#EDE9FE' }}>
                <button
                  onClick={() => setCouponOpen(o => !o)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#DDD6FE' }}>
                    <Tag className="w-4 h-4" style={{ color: '#7C3AED' }}/>
                  </div>
                  <span className="flex-1 text-[13px] font-semibold text-gray-800 text-left">Apply Coupon</span>
                  <ChevronRight className="w-4 h-4 text-gray-500"/>
                </button>
                {couponOpen && (
                  <div className="px-4 pb-3 border-t border-purple-200">
                    <div className="flex gap-2 mt-2.5">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        className="flex-1 border border-purple-300 bg-white px-3 py-1.5 text-[12px] rounded outline-none focus:border-purple-600"
                      />
                      <button
                        disabled={!couponCode}
                        className="bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white px-3 py-1.5 text-[12px] font-bold rounded transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Check Delivery â€” white bg */}
              <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-gray-500"/>
                  </div>
                  <span className="flex-1 text-[12.5px] font-semibold text-gray-700 leading-tight">
                    Check Delivery &amp; Store Details
                  </span>
                  {pincodeOk ? (
                    <span className="text-[11px] text-green-600 font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3"/> Done
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowPincodeInput(o => !o)}
                      className="text-[12px] font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
                      style={{ color: '#E91E8C' }}
                    >
                      {showPincodeInput ? 'Cancel' : 'Enter Pincode'}
                    </button>
                  )}
                </div>

                {/* Expandable input â€” shown when user clicks "Enter Pincode" */}
                {showPincodeInput && !pincodeOk && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-2.5 flex gap-2">
                    <input
                      type="number"
                      value={pincode}
                      autoFocus
                      onChange={e => { setPincode(e.target.value.slice(0, 6)); }}
                      placeholder="Enter 6-digit pincode"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:border-pink-400 transition-colors"
                      style={UI}
                    />
                    <button
                      onClick={() => {
                        if (pincode.length === 6) {
                          setPincodeOk(true);
                          setShowPincodeInput(false);
                        }
                      }}
                      disabled={pincode.length !== 6}
                      className="text-[11px] font-bold border rounded-lg px-3 py-1.5 disabled:opacity-40 transition-colors hover:border-pink-400"
                      style={{ ...UI, color: '#E91E8C', borderColor: '#E91E8C' }}
                    >
                      Check
                    </button>
                  </div>
                )}
              </div>

              {/* Price breakdown â€” white card */}
              <div className="bg-white rounded-xl px-4 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="space-y-3 text-[13px]" style={UI}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-semibold text-gray-800">{inr(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">You Saved</span>
                    <span className="font-bold" style={{ color: '#00897B' }}>â€“ {inr(totalSaved)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Coupon Discount</span>
                    <button
                      onClick={() => setCouponOpen(true)}
                      className="font-semibold text-[12px] hover:opacity-80 transition-opacity"
                      style={{ color: '#E91E8C' }}
                    >
                      Apply Coupon
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Shipping (Standard)</span>
                    <span className="font-semibold" style={{ color: '#00897B' }}>Free</span>
                  </div>
                </div>

                <div className="h-px my-3" style={{ background: '#E5E7EB' }}/>

                <div className="flex items-center justify-between">
                  <span className="text-[14.5px] font-bold text-gray-900">Total Cost</span>
                  <span className="text-[15px] font-black text-gray-900">{inr(totalCost)}</span>
                </div>
              </div>

              {/* PLACE ORDER */}
              <Link
                to="/checkout"
                className="block w-full py-3.5 text-white text-[13.5px] font-black tracking-[0.14em] uppercase rounded-xl hover:opacity-90 active:scale-[0.98] transition-all text-center"
                style={{
                  background: 'linear-gradient(90deg,#9333EA 0%,#7B22F9 100%)',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
                }}
              >
                PLACE ORDER
              </Link>
            </div>

          </div>
        </div>
      </div>

      <TrustBar/>

    </div>
  );
};

export default AurusCart;

