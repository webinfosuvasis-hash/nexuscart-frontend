import React from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { X, Minus, Plus, Trash2, ShoppingBag, ChevronRight } from 'lucide-react';

interface Props {
  accentClass?: string;     // bg color for buttons
  fontClass?: string;       // optional font family
}

const CartDrawer: React.FC<Props> = ({ accentClass = 'bg-gray-900', fontClass = '' }) => {
  const { cart, cartOpen, setCartOpen, updateQty, removeFromCart, cartTotal } = useStore();

  return (
    <>
      {cartOpen && (
        <div className="fixed inset-0 bg-black/40 z-[110]" onClick={() => setCartOpen(false)} />
      )}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-[120] shadow-2xl transition-transform duration-300 ${fontClass} ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> Your Bag ({cart.length})
          </h3>
          <button onClick={() => setCartOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-180px)] px-5 py-4 space-y-4">
          {cart.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Your bag is empty.</p>
            </div>
          )}
          {cart.map(line => (
            <div key={line.id} className="flex gap-3 border-b pb-4">
              <img src={line.image} alt={line.name} className="w-20 h-20 rounded-lg object-cover bg-gray-100" />
              <div className="flex-1">
                <p className="font-semibold text-sm leading-snug">{line.name}</p>
                <p className="text-xs text-gray-500">{line.category}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border rounded-lg">
                    <button className="px-2 py-1" onClick={() => updateQty(line.id, line.qty - 1)}><Minus className="w-3 h-3" /></button>
                    <span className="px-2 text-sm">{line.qty}</span>
                    <button className="px-2 py-1" onClick={() => updateQty(line.id, line.qty + 1)}><Plus className="w-3 h-3" /></button>
                  </div>
                  <span className="font-bold text-sm">{inr(line.price * line.qty)}</span>
                </div>
              </div>
              <button onClick={() => removeFromCart(line.id)}><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t bg-white px-5 py-4">
          <div className="flex justify-between mb-3">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-bold text-lg">{inr(cartTotal)}</span>
          </div>
          <Link
            to="/cart"
            onClick={() => setCartOpen(false)}
            className={`w-full ${accentClass} text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${cart.length === 0 ? 'opacity-40 pointer-events-none' : 'hover:opacity-90'} transition-opacity`}
          >
            View Full Bag <ChevronRight className="w-4 h-4"/>
          </Link>
        </div>
      </aside>
    </>
  );
};

export default CartDrawer;
