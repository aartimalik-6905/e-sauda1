import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import RequireAuth from './components/RequireAuth'
import PageTransition from './components/PageTransition'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Sell from './pages/Sell'
import Orders from './pages/Orders'
import Vault from './pages/Vault'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Terms from './pages/legal/Terms'
import Privacy from './pages/legal/Privacy'
import RefundPolicy from './pages/legal/RefundPolicy'
import ShippingPolicy from './pages/legal/ShippingPolicy'
import ContactUs from './pages/legal/ContactUs'
import Pricing from './pages/legal/Pricing'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ListingDetail from './pages/ListingDetail'
import EditListing from './pages/EditListing'
import MyListings from './pages/MyListings'
import Admin from './pages/Admin'
import SellerProfile from './pages/SellerProfile'
import Messages from './pages/Messages'
import Saved from './pages/Saved'
import Explore from './pages/Explore'
import ChatbotWidget from './components/ChatbotWidget'

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
        <Route path="/shipping-policy" element={<PageTransition><ShippingPolicy /></PageTransition>} />
        <Route path="/contact" element={<PageTransition><ContactUs /></PageTransition>} />
        {/* Legal/compliance pages stay reachable without logging in -- payment
            gateways (Razorpay) and app-store review both expect Terms/Privacy/
            Refund/Contact to be publicly viewable, not gated behind auth. */}
        <Route path="/pricing" element={<PageTransition><Pricing /></PageTransition>} />
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
    <div className="flex min-h-screen flex-col bg-cream">
      <Navbar />
      <main className="flex-1">
        <AnimatedRoutes />
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  )
}
