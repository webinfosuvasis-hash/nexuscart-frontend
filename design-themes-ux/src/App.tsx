
import React, { Suspense, lazy } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { StoreProvider } from "@/context/StoreContext";
import { CartProvider, CartErrorBoundary } from "@/context/CartContext";
import { RegistryProvider } from "@/context/RegistryContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { ProtectedRoute, GuestOnlyRoute } from "@/components/auth/ProtectedRoute";
import CartDrawer from "@/components/CartDrawer";
import { LEGACY_REDIRECTS } from "@/lib/legacyRedirects";

const Index        = lazy(() => import("./pages/Index"));
const ProductPage  = lazy(() => import("./pages/ProductPage"));
const ListingPage  = lazy(() => import("./pages/ListingPage"));
const CartPage     = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const RegistryPage = lazy(() => import("./pages/RegistryPage"));
const LoginPage          = lazy(() => import("./pages/LoginPage"));
const RegisterPage       = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage  = lazy(() => import("./pages/ResetPasswordPage"));
const VerifyEmailPage    = lazy(() => import("./pages/VerifyEmailPage"));
const AccountPage        = lazy(() => import("./pages/AccountPage"));
const AddressBookPage    = lazy(() => import("./pages/AddressBookPage"));
const OrderHistoryPage   = lazy(() => import("./pages/OrderHistoryPage"));
const OrderDetailsPage   = lazy(() => import("./pages/OrderDetailsPage"));
const ShipmentTrackingPage = lazy(() => import("./pages/ShipmentTrackingPage"));
const CancellationPage = lazy(() => import("./pages/CancellationPage"));
const InvoicePage = lazy(() => import("./pages/InvoicePage"));
const CmsPage      = lazy(() => import("./pages/CmsPage"));
const NotFound     = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();


const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
      <p className="text-[12px] text-gray-500" style={{ fontFamily: 'system-ui, sans-serif' }}>Loading…</p>
    </div>
  </div>
);

const App = () => (
  <HelmetProvider>
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
          <CustomerAuthProvider>
          <CartErrorBoundary>
          <CartProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                {/* Single global cart drawer — present on every page */}
                <CartDrawer accentClass="bg-purple-800" />

                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/products/:id" element={<ProductPage />} />
                    <Route path="/category/:categorySlug" element={<ListingPage />} />
                    <Route path="/collection/:collectionSlug" element={<ListingPage />} />
                    <Route path="/brand/:brandSlug" element={<ListingPage />} />
                    <Route path="/search" element={<ListingPage />} />
                    <Route path="/jewellery/:category" element={<ListingPage />} />
                    <Route path="/jewellery" element={<ListingPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/registry" element={<RegistryPage />} />
                    {/* CMS pages — the menu resolver emits /pages/:slug for CMS_PAGE links */}
                    <Route path="/pages/:slug" element={<CmsPage />} />

                    {/* Auth — redirect away if already logged in */}
                    <Route element={<GuestOnlyRoute />}>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    </Route>
                    {/* Reachable regardless of auth state — a reset/verify link may be
                        opened while a different session is still active in this browser. */}
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />

                    {/* Requires a logged-in customer */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="/account" element={<AccountPage />} />
                      <Route path="/account/addresses" element={<AddressBookPage />} />
                      <Route path="/account/orders" element={<OrderHistoryPage />} />
                      <Route path="/account/orders/:orderId" element={<OrderDetailsPage />} />
                      <Route path="/account/orders/:orderId/tracking" element={<ShipmentTrackingPage />} />
                      <Route path="/account/orders/:orderId/cancel" element={<CancellationPage />} />
                      <Route path="/account/orders/:orderId/invoice" element={<InvoicePage />} />
                    </Route>

                    {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
                      <Route key={from} path={from} element={<Navigate to={to} replace />} />
                    ))}

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </CartProvider>
          </CartErrorBoundary>
          </CustomerAuthProvider>
        </QueryClientProvider>
      </RegistryProvider>
    </StoreProvider>
  </ThemeProvider>
  </HelmetProvider>
);

export default App;
