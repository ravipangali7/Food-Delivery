import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Auth
import SplashScreen from "./pages/auth/SplashScreen";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

// Admin
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrdersList from "./pages/admin/AdminOrdersList";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";
import AdminOrderTracking from "./pages/admin/AdminOrderTracking";
import AdminProductsList from "./pages/admin/AdminProductsList";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminProductView from "./pages/admin/AdminProductView";
import AdminCategoriesList from "./pages/admin/AdminCategoriesList";
import AdminParentCategoryForm from "./pages/admin/AdminParentCategoryForm";
import AdminSubCategoryForm from "./pages/admin/AdminSubCategoryForm";
import AdminParentCategoryView from "./pages/admin/AdminParentCategoryView";
import AdminSubCategoryView from "./pages/admin/AdminSubCategoryView";
import AdminUsersList from "./pages/admin/AdminUsersList";
import AdminUserForm from "./pages/admin/AdminUserForm";
import AdminUserView from "./pages/admin/AdminUserView";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminCustomerSupport from "./pages/admin/AdminCustomerSupport";
import AdminSupportConversationWindow from "./pages/admin/AdminSupportConversationWindow";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUnitsList from "./pages/admin/AdminUnitsList";
import AdminUnitForm from "./pages/admin/AdminUnitForm";

// Customer
import CustomerLayout from "./components/customer/CustomerLayout";
import CustomerHome from "./pages/customer/CustomerHome";
import CustomerExplore from "./pages/customer/CustomerExplore";
import CustomerProductDetail from "./pages/customer/CustomerProductDetail";
import CustomerCart from "./pages/customer/CustomerCart";
import CustomerCheckout from "./pages/customer/CustomerCheckout";
import CustomerOrderHistory from "./pages/customer/CustomerOrderHistory";
import CustomerOrderTracking from "./pages/customer/CustomerOrderTracking";
import CustomerOrderTrack from "./pages/customer/CustomerOrderTrack";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerEditProfile from "./pages/customer/CustomerEditProfile";
import CustomerSavedAddresses from "./pages/customer/CustomerSavedAddresses";
import CustomerAboutUs from "./pages/customer/CustomerAboutUs";
import CustomerTerms from "./pages/customer/CustomerTerms";
import CustomerPrivacy from "./pages/customer/CustomerPrivacy";
import CustomerSupport from "./pages/customer/CustomerSupport";
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import CustomerCategoryProducts from "./pages/customer/CustomerCategoryProducts";
import CustomerParentCategory from "./pages/customer/CustomerParentCategory";

// Delivery
import DeliveryLayout from "./components/delivery/DeliveryLayout";
import DeliveryHome from "./pages/delivery/DeliveryHome";
import DeliveryMap from "./pages/delivery/DeliveryMap";
import DeliveryOrders from "./pages/delivery/DeliveryOrders";
import DeliveryOrderDetail from "./pages/delivery/DeliveryOrderDetail";
import DeliveryOrderNavigate from "./pages/delivery/DeliveryOrderNavigate";
import DeliveryProfile from "./pages/delivery/DeliveryProfile";
import DeliveryNotifications from "./pages/delivery/DeliveryNotifications";
import DeliveryEarnings from "./pages/delivery/DeliveryEarnings";

import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import { LegacyAdminUsersRedirect } from "./components/admin/LegacyAdminRedirects";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
          {/* Auth */}
          <Route path="/" element={<SplashScreen />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Admin Portal */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute portal="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrdersList />} />
            <Route path="orders/:id/track" element={<AdminOrderTracking />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="products" element={<AdminProductsList />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:slug" element={<AdminProductView />} />
            <Route path="products/:slug/edit" element={<AdminProductForm />} />
            <Route path="units" element={<AdminUnitsList />} />
            <Route path="units/new" element={<AdminUnitForm />} />
            <Route path="units/:id/edit" element={<AdminUnitForm />} />
            <Route path="categories/all" element={<AdminCategoriesList />} />
            <Route path="categories/parents" element={<AdminCategoriesList />} />
            <Route path="parent-categories/new" element={<AdminParentCategoryForm />} />
            <Route path="parent-categories/:id/edit" element={<AdminParentCategoryForm />} />
            <Route path="parent-categories/:id" element={<AdminParentCategoryView />} />
            <Route path="sub-categories/new" element={<AdminSubCategoryForm />} />
            <Route path="sub-categories/:id/edit" element={<AdminSubCategoryForm />} />
            <Route path="sub-categories/:id" element={<AdminSubCategoryView />} />
            <Route path="categories/new" element={<Navigate to="/admin/sub-categories/new" replace />} />
            <Route
              path="categories"
              element={<Navigate to="/admin/categories/all" replace />}
            />
            <Route path="customers" element={<AdminUsersList type="customers" />} />
            <Route path="customers/new" element={<AdminUserForm />} />
            <Route path="customers/:id" element={<AdminUserView />} />
            <Route path="customers/:id/edit" element={<AdminUserForm />} />
            <Route path="delivery-boys" element={<AdminUsersList type="delivery-boys" />} />
            <Route path="delivery-boys/new" element={<AdminUserForm />} />
            <Route path="delivery-boys/:id" element={<AdminUserView />} />
            <Route path="delivery-boys/:id/edit" element={<AdminUserForm />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="customer-support" element={<AdminCustomerSupport />} />
            <Route path="customer-support/chat/:orderId/:lane" element={<AdminSupportConversationWindow />} />
            <Route path="store-settings" element={<AdminSettings />} />
            <Route path="settings" element={<Navigate to="/admin/store-settings" replace />} />
            <Route path="users/*" element={<LegacyAdminUsersRedirect />} />
          </Route>

          {/* Customer Portal */}
          <Route
            path="/customer"
            element={
              <ProtectedRoute portal="customer">
                <CustomerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CustomerHome />} />
            <Route path="explore" element={<CustomerExplore />} />
            <Route path="product/:id" element={<CustomerProductDetail />} />
            <Route path="parent/:id" element={<CustomerParentCategory />} />
            <Route path="category/:id" element={<CustomerCategoryProducts />} />
            <Route path="cart" element={<CustomerCart />} />
            <Route path="checkout" element={<CustomerCheckout />} />
            <Route path="orders" element={<CustomerOrderHistory />} />
            <Route path="order/:id/track" element={<CustomerOrderTrack />} />
            <Route path="order/:id" element={<CustomerOrderTracking />} />
            <Route path="profile" element={<CustomerProfile />} />
            <Route path="profile/edit" element={<CustomerEditProfile />} />
            <Route path="profile/addresses" element={<CustomerSavedAddresses />} />
            <Route path="about" element={<CustomerAboutUs />} />
            <Route path="terms" element={<CustomerTerms />} />
            <Route path="privacy" element={<CustomerPrivacy />} />
            <Route path="support" element={<CustomerSupport />} />
            <Route path="notifications" element={<CustomerNotifications />} />
          </Route>

          {/* Delivery Portal */}
          <Route
            path="/delivery"
            element={
              <ProtectedRoute portal="delivery">
                <DeliveryLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DeliveryHome />} />
            <Route path="map" element={<DeliveryMap />} />
            <Route path="orders" element={<DeliveryOrders />} />
            <Route path="order/:id/navigate" element={<DeliveryOrderNavigate />} />
            <Route path="order/:id" element={<DeliveryOrderDetail />} />
            <Route path="profile" element={<DeliveryProfile />} />
            <Route path="notifications" element={<DeliveryNotifications />} />
            <Route path="earnings" element={<DeliveryEarnings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
