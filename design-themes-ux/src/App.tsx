
import React, { Suspense, lazy } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { StoreProvider } from "@/context/StoreContext";
import { RegistryProvider } from "@/context/RegistryContext";

const Index        = lazy(() => import("./pages/Index"));
const ProductPage  = lazy(() => import("./pages/ProductPage"));
const ListingPage  = lazy(() => import("./pages/ListingPage"));
const CartPage     = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const RegistryPage = lazy(() => import("./pages/RegistryPage"));
const NotFound     = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
      <p className="text-[12px] text-gray-400" style={{ fontFamily: 'system-ui, sans-serif' }}>Loading…</p>
    </div>
  </div>
);

const App = () => (
  <HelmetProvider>
  {/* Site-wide OG/Twitter defaults — pages with their own Helmet (e.g. the
      Product Detail Page) override these per-tag via react-helmet-async's
      dedup, rather than duplicating raw <meta> tags from index.html. */}
  <Helmet>
    <meta property="og:title" content="Diverse ECommerce Themes" />
    <meta property="og:description" content="Design distinct eCommerce themes in React, each offering unique user experiences across diverse industries." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/og.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="/og.jpg" />
  </Helmet>
  <ThemeProvider defaultTheme="light">
    <StoreProvider>
      <RegistryProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/products/:id" element={<ProductPage />} />
                  <Route path="/category/:categorySlug" element={<ListingPage />} />
                  <Route path="/collection/:collectionSlug" element={<ListingPage />} />
                  <Route path="/brand/:brandSlug" element={<ListingPage />} />
                  <Route path="/search" element={<ListingPage />} />
                  {/* Legacy routes — kept working, mapped to the same data-driven listing page */}
                  <Route path="/jewellery/:category" element={<ListingPage />} />
                  <Route path="/jewellery" element={<ListingPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/registry" element={<RegistryPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </RegistryProvider>
    </StoreProvider>
  </ThemeProvider>
  </HelmetProvider>
);

export default App;
