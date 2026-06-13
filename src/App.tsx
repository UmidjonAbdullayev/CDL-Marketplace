import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { ExchangeDataProvider } from "./context/ExchangeDataContext";
import { AppShell } from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import MarketplacePage from "./pages/MarketplacePage";
import DriverDetailPage from "./pages/DriverDetailPage";
import SellPage from "./pages/SellPage";
import MyListingsPage from "./pages/MyListingsPage";
import DealsPage from "./pages/DealsPage";
import DisputesPage from "./pages/DisputesPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import PricingPage from "./pages/PricingPage";
import CompliancePage from "./pages/CompliancePage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import ContractPage from "./pages/ContractPage";
import DealWorkspacePage from "./pages/DealWorkspacePage";
import OngoingDealsPage from "./pages/OngoingDealsPage";
import RegisterPage from "./pages/RegisterPage";
import RegistrationSuccessPage from "./pages/RegistrationSuccessPage";
import HomeRedirect from "./components/HomeRedirect";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ExchangeDataProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/success" element={<RegistrationSuccessPage />} />
            <Route element={<AppShell />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/driver/:id" element={<DriverDetailPage />} />
            <Route path="/hiring/contract/:listingId" element={<ContractPage />} />
            <Route path="/deals/:dealId" element={<DealWorkspacePage />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/my-listings" element={<MyListingsPage />} />
            <Route path="/ongoing-deals" element={<OngoingDealsPage />} />
            <Route path="/purchased" element={<Navigate to="/ongoing-deals" replace />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/disputes" element={<DisputesPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          </Routes>
        </ExchangeDataProvider>
      </BrowserRouter>
    </AppProvider>
  );
}
