import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import RequireAuth from './components/RequireAuth'
import PageTransition from './components/PageTransition'
import RouteLoadingFallback from './components/RouteLoadingFallback'
import ChatbotWidget from './components/ChatbotWidget'
import { NetworkStatusProvider } from './context/NetworkStatusContext'
import { ThemeProvider } from './context/ThemeContext'

// Every page is its own JS chunk, fetched only when someone actually
// navigates there, instead of one giant bundle everyone downloads up front
// just to view the homepage. Paired with the Suspense fallback below, this is
// what "lazy loading" means for the app's own code (as opposed to images --
// see components/LazyImage.tsx -- which is a separate, per-photo concern).
const Home = lazy(() => import('./pages/Home'))
const Browse = lazy(() => import('./pages/Browse'))
const Sell = lazy(() => import('./pages/Sell'))
const Orders = lazy(() => import('./pages/Orders'))
const Vault = lazy(() => import('./pages/Vault'))
const Profile = lazy(() => import('./pages/Profile'))
const Login = lazy(() => import('./pages/Login'))
const Terms = lazy(() => import('./pages/legal/Terms'))
const Privacy = lazy(() => import('./pages/legal/Privacy'))
const RefundPolicy = lazy(() => import('./pages/legal/RefundPolicy'))
const ShippingPolicy = lazy(() => import('./pages/legal/ShippingPolicy'))
const ContactUs = lazy(() => import('./pages/legal/ContactUs'))
const AboutUs = lazy(() => import('./pages/legal/AboutUs'))
const Pricing = lazy(() => import('./pages/legal/Pricing'))
const CancellationPolicy = lazy(() => import('./pages/legal/CancellationPolicy'))
const SellerOnboarding = lazy(() => import('./pages/legal/SellerOnboarding'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ListingDetail = lazy(() => import('./pages/ListingDetail'))
const EditListing = lazy(() => import('./pages/EditListing'))
const MyListings = lazy(() => import('./pages/MyListings'))
const Admin = lazy(() => import('./pages/Admin'))
const SellerProfile = lazy(() => import('./pages/SellerProfile'))
const Messages = lazy(() => import('./pages/Messages'))
const Saved = lazy(() => import('./pages/Saved'))
const Explore = lazy(() => import('./pages/Explore'))
const Help = lazy(() => import('./pages/Help'))

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Home, Browse, Explore, listing detail, and seller profile stay publicly
            viewable (no RequireAuth) -- these are the pages that show products and
            pricing. Payment-gateway reviewers (PayU, Razorpay) and search crawlers
            hit these anonymously; gating them behind login made the whole site look
            "non-operational" during verification even though the data layer (RLS
            policies) already allows anonymous reads. Actions that need an account
            (chat, buy, save, edit) already redirect to /login on their own inside
            each page -- see handleChat/handleBuy in ListingDetail.tsx. */}
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/browse" element={<PageTransition><Browse /></PageTransition>} />
        <Route path="/explore" element={<PageTransition><Explore /></PageTransition>} />
        <Route path="/listing/:id" element={<PageTransition><ListingDetail /></PageTransition>} />
        <Route
          path="/listing/:id/edit"
          element={
            <RequireAuth>
              <PageTransition><EditListing /></PageTransition>
            </RequireAuth>
          }
        />
        <Route path="/seller/:id" element={<PageTransition><SellerProfile /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/terms" element={<PageTransition><Terms /></PageTransition>} />
        <Route path="/privacy" element={<PageTransition><Privacy /></PageTransition>} />
        <Route path="/refund-policy" element={<PageTransition><RefundPolicy /></PageTransition>} />
        <Route path="/cancellation-policy" element={<PageTransition><CancellationPolicy /></PageTransition>} />
        <Route path="/seller-onboarding" element={<PageTransition><SellerOnboarding /></PageTransition>} />
        <Route path="/shipping-policy" element={<PageTransition><ShippingPolicy /></PageTransition>} />
        <Route path="/contact" element={<PageTransition><ContactUs /></PageTransition>} />
        <Route path="/about" element={<PageTransition><AboutUs /></PageTransition>} />
        {/* Legal/compliance pages stay reachable without logging in -- payment
            gateways (Razorpay) and app-store review both expect Terms/Privacy/
            Refund/Contact to be publicly viewable, not gated behind auth. */}
        <Route path="/pricing" element={<PageTransition><Pricing /></PageTransition>} />
        {/* Public for the same reason as Terms/Privacy/etc above -- someone who
            doesn't understand the site yet is, almost by definition, not
            logged in, so this can't sit behind RequireAuth. */}
        <Route path="/help" element={<PageTransition><Help /></PageTransition>} />
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <PageTransition><Messages /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/messages/:id"
          element={
            <RequireAuth>
              <PageTransition><Messages /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/sell"
          element={
            <RequireAuth>
              <PageTransition><Sell /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/my-listings"
          element={
            <RequireAuth>
              <PageTransition><MyListings /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAuth>
              <PageTransition><Orders /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/vault"
          element={
            <RequireAuth>
              <PageTransition><Vault /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <PageTransition><Profile /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/saved"
          element={
            <RequireAuth>
              <PageTransition><Saved /></PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <PageTransition><Admin /></PageTransition>
            </RequireAuth>
          }
        />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <NetworkStatusProvider>
        <div className="flex min-h-screen flex-col bg-cream">
          <Navbar />
          <main className="flex-1">
            <Suspense fallback={<RouteLoadingFallback />}>
              <AnimatedRoutes />
            </Suspense>
          </main>
          <Footer />
          <ChatbotWidget />
        </div>
      </NetworkStatusProvider>
    </ThemeProvider>
  )
}
