import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "./AppContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { registerDataInvalidation } from "../lib/dataInvalidation";
import { marketplaceViewerForUser } from "../lib/account-capabilities";
import { postedWithinSince } from "../lib/driver-types";
import { fmtPrice } from "../lib/format";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  DEFAULT_PAGE_SIZE,
  fetchActivities,
  fetchCategoryStats,
  fetchConversationMessages,
  fetchConversationsPage,
  fetchDashboardStats,
  fetchDealStats,
  fetchDealsPage,
  fetchDisputesPage,
  fetchDriverCardsPage,
  fetchHotListings,
  fetchTrendingListingIds,
  type DashboardPeriod,
  fetchListingById,
  fetchMarketplaceStates,
  fetchOpenDisputeCount,
  fetchPendingApprovalsPage,
  fetchPurchasesPage,
  fetchSellerListingCounts,
  fetchSellerListingsPage,
  fetchSellerReservations,
  fetchSellerStats,
  sendMessage as sendMessageApi,
  subscribeMarketplaceListings,
  type ConversationSummary,
  type DealRow,
  type DisputeRow,
  type MessageRow,
  type PurchaseRow,
  type SellerListingRow
} from "../services/marketplace";
import {
  fetchCdlScoreVerified,
  fetchNotifications,
  fetchUnreadMessageCount,
  fetchUpcomingActions,
  markConversationRead,
  type AppNotification,
  type UpcomingAction
} from "../services/notifications";
import type { Driver, DriverCard, HotListing, ScoreFlag } from "../types";

const STALE_MS = 5 * 60 * 1000;

export type MarketplaceFilters = {
  state: string;
  cdl: string;
  exp: number;
  equip: string;
  score: string;
  priceMin: number;
  priceMax: number;
  verified: boolean;
  route: string;
  minHotScore: number;
  driverType: string;
  postedWithin: string;
};

export const initialMarketplaceFilters: MarketplaceFilters = {
  state: "",
  cdl: "",
  exp: 0,
  equip: "",
  score: "",
  priceMin: 0,
  priceMax: 99999,
  verified: false,
  route: "",
  minHotScore: 0,
  driverType: "",
  postedWithin: ""
};

export type DashboardFindFilters = {
  state: string;
  exp: number;
  cdl: string;
  equip: string;
  route: string;
  minHotScore: number;
};

type DealStats = { inEscrow: number; pendingPayment: number; awaiting: number; completed: number };

type DashboardState = {
  hotListings: HotListing[];
  dashStats: { available: number; avgPrice: number; verifiedPct: number; classAOtr: number };
  dealStats: DealStats;
  openDisputes: number;
  activities: Awaited<ReturnType<typeof fetchActivities>>;
  categories: Awaited<ReturnType<typeof fetchCategoryStats>>;
  upcomingActions: UpcomingAction[];
  sellers: Awaited<ReturnType<typeof fetchSellerStats>>;
  loadedAt: number;
};

type AdminApproval = {
  id: number;
  listing: string;
  seller: string;
  price: string;
  score: ScoreFlag;
  consent: boolean;
};

type ViewKey =
  | "dashboard"
  | "marketplace"
  | "purchased"
  | "deals"
  | "disputes"
  | "messages"
  | "my-listings"
  | "admin";

function pathToView(path: string): ViewKey | "driver" | null {
  if (path === "/" || path === "/dashboard") return "dashboard";
  if (path === "/marketplace") return "marketplace";
  if (path === "/ongoing-deals" || path === "/purchased") return "purchased";
  if (path === "/deals") return "deals";
  if (path === "/disputes") return "disputes";
  if (path === "/messages") return "messages";
  if (path === "/my-listings") return "my-listings";
  if (path === "/admin") return "admin";
  if (path.startsWith("/driver/")) return "driver";
  return null;
}

function refreshMode(loadedAt: number): "skip" | "background" | "initial" {
  if (loadedAt === 0) return "initial";
  if (Date.now() - loadedAt > STALE_MS) return "background";
  return "skip";
}

interface ExchangeDataValue {
  appLoading: boolean;
  badges: { disputes: number; messages: number };
  notifications: AppNotification[];
  dismissAllNotifications: () => void;
  dismissNotification: (id: string) => void;
  refreshNotifications: () => Promise<void>;

  dashboardPeriod: DashboardPeriod;
  setDashboardPeriod: React.Dispatch<React.SetStateAction<DashboardPeriod>>;
  dashboard: DashboardState;
  dashboardLoading: boolean;
  refreshDashboard: (force?: boolean) => Promise<void>;

  marketplaceHotOnly: boolean;
  setMarketplaceHotOnly: React.Dispatch<React.SetStateAction<boolean>>;
  trendingListingIds: Set<number>;
  applyFindDriversFilters: (filters: DashboardFindFilters) => void;

  marketplaceFilters: MarketplaceFilters;
  setMarketplaceFilters: React.Dispatch<React.SetStateAction<MarketplaceFilters>>;
  marketplacePage: number;
  setMarketplacePage: React.Dispatch<React.SetStateAction<number>>;
  resetMarketplaceFilters: () => void;
  marketplaceDrivers: DriverCard[];
  marketplaceTotal: number;
  marketplaceTotalPages: number;
  marketplaceStates: string[];
  marketplaceLoading: boolean;
  marketplaceRefreshing: boolean;
  marketplaceHasLoaded: boolean;
  refreshMarketplace: (force?: boolean) => Promise<void>;

  purchasedPage: number;
  setPurchasedPage: React.Dispatch<React.SetStateAction<number>>;
  purchasedRows: PurchaseRow[];
  purchasedTotal: number;
  purchasedTotalPages: number;
  purchasedLoading: boolean;
  purchasedRefreshing: boolean;
  refreshPurchased: (force?: boolean) => Promise<void>;

  dealsPage: number;
  setDealsPage: React.Dispatch<React.SetStateAction<number>>;
  deals: DealRow[];
  dealsTotal: number;
  dealsTotalPages: number;
  dealsStats: DealStats;
  dealsLoading: boolean;
  dealsRefreshing: boolean;
  refreshDeals: (force?: boolean) => Promise<void>;

  disputesPage: number;
  setDisputesPage: React.Dispatch<React.SetStateAction<number>>;
  disputes: DisputeRow[];
  disputesTotal: number;
  disputesTotalPages: number;
  disputesLoading: boolean;
  disputesRefreshing: boolean;
  refreshDisputes: (force?: boolean) => Promise<void>;

  messagesPage: number;
  setMessagesPage: React.Dispatch<React.SetStateAction<number>>;
  conversations: ConversationSummary[];
  conversationsTotal: number;
  conversationsTotalPages: number;
  conversationsLoading: boolean;
  conversationsRefreshing: boolean;
  activeConversationId: string;
  selectConversation: (id: string) => void;
  cdlScoreVerified: boolean;
  refreshCdlScoreStatus: () => Promise<void>;
  conversationMessages: MessageRow[];
  messagesLoading: boolean;
  refreshConversations: (force?: boolean) => Promise<void>;
  refreshConversationMessages: (force?: boolean) => Promise<void>;
  sendConversationMessage: (text: string) => Promise<void>;

  listingsTab: string;
  setListingsTab: React.Dispatch<React.SetStateAction<string>>;
  listingsPage: number;
  setListingsPage: React.Dispatch<React.SetStateAction<number>>;
  listingRows: SellerListingRow[];
  listingCounts: { active: number; reserved: number; sold: number; expired: number };
  reservations: Awaited<ReturnType<typeof fetchSellerReservations>>;
  listingsTotal: number;
  listingsTotalPages: number;
  listingsLoading: boolean;
  listingsRefreshing: boolean;
  refreshMyListings: (force?: boolean) => Promise<void>;

  adminPage: number;
  setAdminPage: React.Dispatch<React.SetStateAction<number>>;
  adminApprovals: AdminApproval[];
  adminTotal: number;
  adminTotalPages: number;
  adminLoading: boolean;
  adminRefreshing: boolean;
  refreshAdmin: (force?: boolean) => Promise<void>;

  driverDetails: Record<number, Driver>;
  driverDetailLoading: boolean;
  loadDriverDetail: (id: number, force?: boolean) => Promise<Driver | null>;

  invalidateViews: (views: ViewKey | ViewKey[]) => void;
}

const ExchangeDataContext = createContext<ExchangeDataValue | undefined>(undefined);

const emptyDealStats: DealStats = { inEscrow: 0, pendingPayment: 0, awaiting: 0, completed: 0 };

const emptyDashboard: DashboardState = {
  hotListings: [],
  dashStats: { available: 0, avgPrice: 0, verifiedPct: 0, classAOtr: 0 },
  dealStats: emptyDealStats,
  openDisputes: 0,
  activities: [],
  categories: [],
  upcomingActions: [],
  sellers: [],
  loadedAt: 0
};

function readDismissedNotifications(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem("dismissed_notifications") ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function ExchangeDataProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { searchQuery, debouncedSearch: appDebouncedSearch, sessionUser } = useApp();
  const debouncedSearch = useDebouncedValue(searchQuery, 100);
  const effectiveSearch = debouncedSearch || appDebouncedSearch;
  const marketplaceViewer = useMemo(
    () => marketplaceViewerForUser(sessionUser),
    [sessionUser]
  );

  const [appLoading, setAppLoading] = useState(isSupabaseConfigured);
  const [badges, setBadges] = useState({ disputes: 0, messages: 0 });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(readDismissedNotifications);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("7d");
  const [marketplaceHotOnly, setMarketplaceHotOnly] = useState(false);
  const [trendingListingIds, setTrendingListingIds] = useState<Set<number>>(new Set());
  const [cdlScoreVerified, setCdlScoreVerified] = useState(false);

  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboard);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [marketplaceFilters, setMarketplaceFilters] = useState<MarketplaceFilters>(initialMarketplaceFilters);
  const [marketplacePage, setMarketplacePage] = useState(1);
  const [marketplaceDrivers, setMarketplaceDrivers] = useState<DriverCard[]>([]);
  const [marketplaceTotal, setMarketplaceTotal] = useState(0);
  const [marketplaceTotalPages, setMarketplaceTotalPages] = useState(1);
  const [marketplaceStates, setMarketplaceStates] = useState<string[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceRefreshing, setMarketplaceRefreshing] = useState(false);
  const [marketplaceLoadedAt, setMarketplaceLoadedAt] = useState(0);
  const marketplaceQueryKeyRef = useRef("");

  const [purchasedPage, setPurchasedPage] = useState(1);
  const [purchasedRows, setPurchasedRows] = useState<PurchaseRow[]>([]);
  const [purchasedTotal, setPurchasedTotal] = useState(0);
  const [purchasedTotalPages, setPurchasedTotalPages] = useState(1);
  const [purchasedLoading, setPurchasedLoading] = useState(false);
  const [purchasedRefreshing, setPurchasedRefreshing] = useState(false);
  const [purchasedLoadedAt, setPurchasedLoadedAt] = useState(0);

  const [dealsPage, setDealsPage] = useState(1);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [dealsTotal, setDealsTotal] = useState(0);
  const [dealsTotalPages, setDealsTotalPages] = useState(1);
  const [dealsStats, setDealsStats] = useState<DealStats>(emptyDealStats);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsRefreshing, setDealsRefreshing] = useState(false);
  const [dealsLoadedAt, setDealsLoadedAt] = useState(0);

  const [disputesPage, setDisputesPage] = useState(1);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [disputesTotal, setDisputesTotal] = useState(0);
  const [disputesTotalPages, setDisputesTotalPages] = useState(1);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputesRefreshing, setDisputesRefreshing] = useState(false);
  const [disputesLoadedAt, setDisputesLoadedAt] = useState(0);

  const [messagesPage, setMessagesPage] = useState(1);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [conversationsTotalPages, setConversationsTotalPages] = useState(1);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsRefreshing, setConversationsRefreshing] = useState(false);
  const [conversationsLoadedAt, setConversationsLoadedAt] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [conversationMessages, setConversationMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesLoadedForRef = useRef("");

  const [listingsTab, setListingsTab] = useState("active");
  const [listingsPage, setListingsPage] = useState(1);
  const [listingRows, setListingRows] = useState<SellerListingRow[]>([]);
  const [listingCounts, setListingCounts] = useState({ active: 0, reserved: 0, sold: 0, expired: 0 });
  const [reservations, setReservations] = useState<Awaited<ReturnType<typeof fetchSellerReservations>>>([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [listingsTotalPages, setListingsTotalPages] = useState(1);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsRefreshing, setListingsRefreshing] = useState(false);
  const [listingsLoadedAt, setListingsLoadedAt] = useState(0);
  const listingsQueryKeyRef = useRef("");

  const [adminPage, setAdminPage] = useState(1);
  const [adminApprovals, setAdminApprovals] = useState<AdminApproval[]>([]);
  const [adminTotal, setAdminTotal] = useState(0);
  const [adminTotalPages, setAdminTotalPages] = useState(1);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminRefreshing, setAdminRefreshing] = useState(false);
  const [adminLoadedAt, setAdminLoadedAt] = useState(0);

  const [driverDetails, setDriverDetails] = useState<Record<number, Driver>>({});
  const [driverDetailLoading, setDriverDetailLoading] = useState(false);

  const prevFilterKeyRef = useRef<string | null>(null);
  const marketplaceFilterKey = useMemo(
    () => JSON.stringify({ filters: marketplaceFilters, search: effectiveSearch }),
    [marketplaceFilters, effectiveSearch]
  );
  const marketplaceQueryKey = useMemo(
    () => `${marketplaceFilterKey}:${marketplacePage}:${marketplaceHotOnly}`,
    [marketplaceFilterKey, marketplacePage, marketplaceHotOnly]
  );

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !dismissedNotifIds.has(n.id)),
    [notifications, dismissedNotifIds]
  );

  useEffect(() => {
    if (prevFilterKeyRef.current !== null && prevFilterKeyRef.current !== marketplaceFilterKey) {
      setMarketplacePage(1);
      setMarketplaceRefreshing(true);
      setMarketplaceDrivers([]);
      marketplaceQueryKeyRef.current = "";
    }
    prevFilterKeyRef.current = marketplaceFilterKey;
  }, [marketplaceFilterKey]);

  useEffect(() => {
    setListingsPage(1);
  }, [listingsTab]);

  const refreshNotifications = useCallback(async () => {
    try {
      const [items, unread] = await Promise.all([fetchNotifications(), fetchUnreadMessageCount()]);
      setNotifications(items);
      setBadges((b) => ({ ...b, messages: unread }));
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }, []);

  const refreshCdlScoreStatus = useCallback(async () => {
    const verified = await fetchCdlScoreVerified();
    setCdlScoreVerified(verified);
  }, []);

  const dismissAllNotifications = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    const next = new Set([...dismissedNotifIds, ...ids]);
    setDismissedNotifIds(next);
    localStorage.setItem("dismissed_notifications", JSON.stringify([...next]));
  }, [notifications, dismissedNotifIds]);

  const dismissNotification = useCallback((id: string) => {
    setDismissedNotifIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set([...prev, id]);
      localStorage.setItem("dismissed_notifications", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const refreshDashboard = useCallback(async (force = false) => {
    const mode = force ? "background" : refreshMode(dashboard.loadedAt);
    if (mode === "skip" && !force) return;

    if (mode === "initial") setDashboardLoading(true);
    try {
      const [hot, dash, dealStats, openDisputes, activities, categories, upcomingActions, sellers, trending] =
        await Promise.all([
          fetchHotListings(marketplaceViewer),
          fetchDashboardStats(),
          fetchDealStats(dashboardPeriod),
          fetchOpenDisputeCount(),
          fetchActivities(dashboardPeriod),
          fetchCategoryStats(),
          fetchUpcomingActions(),
          fetchSellerStats(),
          fetchTrendingListingIds()
        ]);
      setDashboard({
        hotListings: hot,
        dashStats: dash,
        dealStats,
        openDisputes,
        activities,
        categories,
        upcomingActions,
        sellers,
        loadedAt: Date.now()
      });
      setTrendingListingIds(trending);
      setBadges((b) => ({ ...b, disputes: openDisputes }));
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setDashboardLoading(false);
    }
  }, [dashboard.loadedAt, dashboardPeriod, marketplaceViewer]);

  const refreshMarketplace = useCallback(async (force = false) => {
    const queryChanged = marketplaceQueryKeyRef.current !== marketplaceQueryKey;
    const mode = force ? "background" : queryChanged ? "initial" : refreshMode(marketplaceLoadedAt);
    if (mode === "skip") return;

    if (mode === "initial" && marketplaceLoadedAt === 0) setMarketplaceLoading(true);
    else setMarketplaceRefreshing(true);

    try {
      const [result, states] = await Promise.all([
        fetchDriverCardsPage(
          {
            state: marketplaceFilters.state || undefined,
            cdl: marketplaceFilters.cdl || undefined,
            exp: marketplaceFilters.exp || undefined,
            equip: marketplaceFilters.equip || undefined,
            score: marketplaceFilters.score || undefined,
            priceMin: marketplaceFilters.priceMin || undefined,
            priceMax: marketplaceFilters.priceMax,
            verified: marketplaceFilters.verified || undefined,
            search: effectiveSearch || undefined,
            route: marketplaceFilters.route || undefined,
            minHotScore: marketplaceFilters.minHotScore || undefined,
            hotOnly: marketplaceHotOnly || undefined,
            driverType: marketplaceFilters.driverType || undefined,
            postedSince: postedWithinSince(
              marketplaceFilters.postedWithin as "" | "24h" | "7d" | "30d" | "90d"
            )
          },
          { page: marketplacePage, pageSize: DEFAULT_PAGE_SIZE, viewer: marketplaceViewer }
        ),
        fetchMarketplaceStates()
      ]);
      setMarketplaceDrivers(result.items);
      setMarketplaceTotal(result.total);
      setMarketplaceTotalPages(result.totalPages);
      setMarketplaceStates(states);
      setMarketplaceLoadedAt(Date.now());
      marketplaceQueryKeyRef.current = marketplaceQueryKey;
    } catch (err) {
      console.error("Failed to load marketplace", err);
    } finally {
      setMarketplaceLoading(false);
      setMarketplaceRefreshing(false);
    }
  }, [
    marketplaceQueryKey,
    marketplaceFilters,
    marketplacePage,
    effectiveSearch,
    marketplaceLoadedAt,
    marketplaceHotOnly,
    marketplaceViewer
  ]);

  const refreshPurchased = useCallback(async (force = false) => {
    const mode = force ? "background" : refreshMode(purchasedLoadedAt);
    if (mode === "skip") return;

    if (mode === "initial" && purchasedRows.length === 0) setPurchasedLoading(true);
    else setPurchasedRefreshing(true);

    try {
      const result = await fetchPurchasesPage({ page: purchasedPage, pageSize: DEFAULT_PAGE_SIZE });
      setPurchasedRows(result.items);
      setPurchasedTotal(result.total);
      setPurchasedTotalPages(result.totalPages);
      setPurchasedLoadedAt(Date.now());
    } catch (err) {
      console.error("Failed to load purchases", err);
    } finally {
      setPurchasedLoading(false);
      setPurchasedRefreshing(false);
    }
  }, [purchasedPage, purchasedLoadedAt, purchasedRows.length]);

  const refreshDeals = useCallback(async (force = false) => {
    const mode = force ? "background" : refreshMode(dealsLoadedAt);
    if (mode === "skip") return;

    if (mode === "initial" && deals.length === 0) setDealsLoading(true);
    else setDealsRefreshing(true);

    try {
      const [dealsResult, stats] = await Promise.all([
        fetchDealsPage({ page: dealsPage, pageSize: DEFAULT_PAGE_SIZE }),
        fetchDealStats()
      ]);
      setDeals(dealsResult.items);
      setDealsTotal(dealsResult.total);
      setDealsTotalPages(dealsResult.totalPages);
      setDealsStats(stats);
      setDealsLoadedAt(Date.now());
    } catch (err) {
      console.error("Failed to load deals", err);
    } finally {
      setDealsLoading(false);
      setDealsRefreshing(false);
    }
  }, [dealsPage, dealsLoadedAt, deals.length]);

  const refreshDisputes = useCallback(async (force = false) => {
    const mode = force ? "background" : refreshMode(disputesLoadedAt);
    if (mode === "skip") return;

    if (mode === "initial" && disputes.length === 0) setDisputesLoading(true);
    else setDisputesRefreshing(true);

    try {
      const result = await fetchDisputesPage({ page: disputesPage, pageSize: DEFAULT_PAGE_SIZE });
      setDisputes(result.items);
      setDisputesTotal(result.total);
      setDisputesTotalPages(result.totalPages);
      setDisputesLoadedAt(Date.now());
      const openCount = result.items.filter((d) => d.admin_status !== "Resolved").length;
      setBadges((b) => ({ ...b, disputes: openCount || disputesTotal }));
    } catch (err) {
      console.error("Failed to load disputes", err);
    } finally {
      setDisputesLoading(false);
      setDisputesRefreshing(false);
    }
  }, [disputesPage, disputesLoadedAt, disputes.length, disputesTotal]);

  const refreshConversations = useCallback(async (force = false) => {
    const mode = force ? "background" : refreshMode(conversationsLoadedAt);
    if (mode === "skip") return;

    if (mode === "initial" && conversations.length === 0) setConversationsLoading(true);
    else setConversationsRefreshing(true);

    try {
      const result = await fetchConversationsPage({ page: messagesPage, pageSize: DEFAULT_PAGE_SIZE });
      setConversations(result.items);
      setConversationsTotal(result.total);
      setConversationsTotalPages(result.totalPages);
      setConversationsLoadedAt(Date.now());
      const unread = await fetchUnreadMessageCount();
      setBadges((b) => ({ ...b, messages: unread }));
      if (!activeConversationId && result.items[0]) {
        setActiveConversationId(result.items[0].id);
        void markConversationRead(result.items[0].id);
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
    } finally {
      setConversationsLoading(false);
      setConversationsRefreshing(false);
    }
  }, [messagesPage, conversationsLoadedAt, conversations.length, activeConversationId]);

  const refreshConversationMessages = useCallback(async (force = false) => {
    if (!activeConversationId) {
      setConversationMessages([]);
      return;
    }
    if (!force && messagesLoadedForRef.current === activeConversationId && conversationMessages.length > 0) {
      return;
    }
    setMessagesLoading(true);
    try {
      const rows = await fetchConversationMessages(activeConversationId);
      setConversationMessages(rows);
      messagesLoadedForRef.current = activeConversationId;
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setMessagesLoading(false);
    }
  }, [activeConversationId, conversationMessages.length]);

  const sendConversationMessage = useCallback(async (text: string) => {
    if (!activeConversationId || !text.trim()) return;
    await sendMessageApi(activeConversationId, text);
    const rows = await fetchConversationMessages(activeConversationId);
    setConversationMessages(rows);
    void refreshConversations(true);
    void refreshNotifications();
  }, [activeConversationId, refreshConversations, refreshNotifications]);

  const listingsQueryKey = `${listingsTab}:${listingsPage}`;

  const refreshMyListings = useCallback(async (force = false) => {
    const queryChanged = listingsQueryKeyRef.current !== listingsQueryKey;
    const mode = force ? "background" : queryChanged ? "initial" : refreshMode(listingsLoadedAt);
    if (mode === "skip") return;

    if (mode === "initial" && listingRows.length === 0) setListingsLoading(true);
    else setListingsRefreshing(true);

    const tab = (["active", "reserved", "sold", "expired"].includes(listingsTab)
      ? listingsTab
      : "active") as import("../services/marketplace").SellerListingsTab;

    try {
      const [listings, counts] = await Promise.all([
        fetchSellerListingsPage(tab, { page: listingsPage, pageSize: DEFAULT_PAGE_SIZE }),
        fetchSellerListingCounts()
      ]);
      setListingRows(listings.items);
      setListingsTotal(listings.total);
      setListingsTotalPages(listings.totalPages);
      setListingCounts(counts);
      setReservations([]);
      setListingsLoadedAt(Date.now());
      listingsQueryKeyRef.current = listingsQueryKey;
    } catch (err) {
      console.error("Failed to load listings", err);
    } finally {
      setListingsLoading(false);
      setListingsRefreshing(false);
    }
  }, [listingsTab, listingsPage, listingsQueryKey, listingRows.length, listingsLoadedAt]);

  const refreshAdmin = useCallback(async (force = false) => {
    const mode = force ? "background" : refreshMode(adminLoadedAt);
    if (mode === "skip") return;

    if (mode === "initial" && adminApprovals.length === 0) setAdminLoading(true);
    else setAdminRefreshing(true);

    try {
      const result = await fetchPendingApprovalsPage({ page: adminPage, pageSize: DEFAULT_PAGE_SIZE });
      setAdminApprovals(
        result.items.map((r) => {
          const seller = Array.isArray(r.companies) ? r.companies[0] : r.companies;
          return {
            id: r.id,
            listing: `${r.first_name} ${r.last_name.charAt(0)}. — ${r.state}`,
            seller: seller?.name ?? "—",
            price: fmtPrice(r.price),
            score: r.score_flag as ScoreFlag,
            consent: r.consent_verified
          };
        })
      );
      setAdminTotal(result.total);
      setAdminTotalPages(result.totalPages);
      setAdminLoadedAt(Date.now());
    } catch (err) {
      console.error("Failed to load admin approvals", err);
    } finally {
      setAdminLoading(false);
      setAdminRefreshing(false);
    }
  }, [adminPage, adminLoadedAt, adminApprovals.length]);

  const loadDriverDetail = useCallback(async (id: number, force = false) => {
    if (!force && driverDetails[id]) {
      return driverDetails[id];
    }
    setDriverDetailLoading(true);
    try {
      const driver = await fetchListingById(id, marketplaceViewer);
      if (driver) setDriverDetails((prev) => ({ ...prev, [id]: driver }));
      return driver;
    } catch (err) {
      console.error("Failed to load driver", err);
      return null;
    } finally {
      setDriverDetailLoading(false);
    }
  }, [driverDetails, marketplaceViewer]);

  const invalidateViews = useCallback((views: ViewKey | ViewKey[]) => {
    const list = Array.isArray(views) ? views : [views];
    const current = pathToView(location.pathname);

    if (list.includes("dashboard")) {
      setDashboard((d) => ({ ...d, loadedAt: 0 }));
      if (current === "dashboard") void refreshDashboard(true);
    }
    if (list.includes("marketplace")) {
      setMarketplaceLoadedAt(0);
      marketplaceQueryKeyRef.current = "";
      if (current === "marketplace") void refreshMarketplace(true);
    }
    if (list.includes("purchased")) {
      setPurchasedLoadedAt(0);
      if (current === "purchased") void refreshPurchased(true);
    }
    if (list.includes("deals")) {
      setDealsLoadedAt(0);
      if (current === "deals") void refreshDeals(true);
    }
    if (list.includes("disputes")) {
      setDisputesLoadedAt(0);
      if (current === "disputes") void refreshDisputes(true);
    }
    if (list.includes("messages")) {
      setConversationsLoadedAt(0);
      messagesLoadedForRef.current = "";
      if (current === "messages") void refreshConversations(true);
    }
    if (list.includes("my-listings")) {
      setListingsLoadedAt(0);
      listingsQueryKeyRef.current = "";
      if (current === "my-listings") void refreshMyListings(true);
    }
    if (list.includes("admin")) {
      setAdminLoadedAt(0);
      if (current === "admin") void refreshAdmin(true);
    }
  }, [
    location.pathname,
    refreshDashboard,
    refreshMarketplace,
    refreshPurchased,
    refreshDeals,
    refreshDisputes,
    refreshConversations,
    refreshMyListings,
    refreshAdmin
  ]);

  const resetMarketplaceFilters = useCallback(() => {
    setMarketplaceFilters(initialMarketplaceFilters);
    setMarketplacePage(1);
    setMarketplaceHotOnly(false);
  }, []);

  const applyFindDriversFilters = useCallback((filters: DashboardFindFilters) => {
    setMarketplaceFilters({
      ...initialMarketplaceFilters,
      state: filters.state,
      cdl: filters.cdl,
      exp: filters.exp,
      equip: filters.equip,
      route: filters.route,
      minHotScore: filters.minHotScore,
      score: filters.minHotScore >= 80 ? "green" : ""
    });
    setMarketplaceHotOnly(false);
    setMarketplacePage(1);
    setMarketplaceLoadedAt(0);
    marketplaceQueryKeyRef.current = "";
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      void markConversationRead(id).then(() => refreshNotifications());
    },
    [refreshNotifications]
  );

  useEffect(() => registerDataInvalidation(invalidateViews), [invalidateViews]);

  useEffect(() => {
    if (!isSupabaseConfigured || appLoading) return;
    const unsub = subscribeMarketplaceListings(() => {
      invalidateViews(["marketplace", "dashboard", "my-listings"]);
    });
    return unsub;
  }, [appLoading, invalidateViews]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAppLoading(false);
      return;
    }
    if (!sessionUser?.companyId) {
      setAppLoading(false);
      return;
    }
    setAppLoading(true);
    void Promise.all([
      refreshDashboard(true),
      refreshNotifications(),
      refreshCdlScoreStatus(),
      fetchTrendingListingIds().then(setTrendingListingIds)
    ]).finally(() => setAppLoading(false));
  }, [sessionUser?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (location.search.includes("hot=1")) {
      setMarketplaceHotOnly(true);
      setMarketplacePage(1);
    }
  }, [location.search]);

  useEffect(() => {
    if (appLoading) return;
    void refreshDashboard(true);
  }, [dashboardPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = pathToView(location.pathname);
    if (!view || appLoading) return;

    if (view === "dashboard") void refreshDashboard();
    if (view === "marketplace") void refreshMarketplace();
    if (view === "purchased") void refreshPurchased();
    if (view === "deals") void refreshDeals();
    if (view === "disputes") void refreshDisputes();
    if (view === "messages") void refreshConversations();
    if (view === "my-listings") void refreshMyListings();
    if (view === "admin") void refreshAdmin();
    void refreshNotifications();
    if (view === "driver") {
      const id = Number(location.pathname.split("/").pop());
      if (id) void loadDriverDetail(id);
    }
  }, [
    location.pathname,
    appLoading,
    marketplaceQueryKey,
    purchasedPage,
    dealsPage,
    disputesPage,
    messagesPage,
    listingsQueryKey,
    adminPage,
    marketplaceViewer,
    refreshDashboard,
    refreshMarketplace,
    refreshPurchased,
    refreshDeals,
    refreshDisputes,
    refreshConversations,
    refreshMyListings,
    refreshAdmin,
    loadDriverDetail,
    refreshNotifications
  ]);

  useEffect(() => {
    if (pathToView(location.pathname) === "messages" && activeConversationId) {
      void refreshConversationMessages();
    }
  }, [location.pathname, activeConversationId, refreshConversationMessages]);

  const value = useMemo<ExchangeDataValue>(
    () => ({
      appLoading,
      badges,
      notifications: visibleNotifications,
      dismissAllNotifications,
      dismissNotification,
      refreshNotifications,
      dashboardPeriod,
      setDashboardPeriod,
      dashboard,
      dashboardLoading,
      refreshDashboard,
      marketplaceHotOnly,
      setMarketplaceHotOnly,
      trendingListingIds,
      applyFindDriversFilters,
      marketplaceFilters,
      setMarketplaceFilters,
      marketplacePage,
      setMarketplacePage,
      resetMarketplaceFilters,
      marketplaceDrivers,
      marketplaceTotal,
      marketplaceTotalPages,
      marketplaceStates,
      marketplaceLoading,
      marketplaceRefreshing,
      marketplaceHasLoaded: marketplaceLoadedAt > 0,
      refreshMarketplace,
      purchasedPage,
      setPurchasedPage,
      purchasedRows,
      purchasedTotal,
      purchasedTotalPages,
      purchasedLoading,
      purchasedRefreshing,
      refreshPurchased,
      dealsPage,
      setDealsPage,
      deals,
      dealsTotal,
      dealsTotalPages,
      dealsStats,
      dealsLoading,
      dealsRefreshing,
      refreshDeals,
      disputesPage,
      setDisputesPage,
      disputes,
      disputesTotal,
      disputesTotalPages,
      disputesLoading,
      disputesRefreshing,
      refreshDisputes,
      messagesPage,
      setMessagesPage,
      conversations,
      conversationsTotal,
      conversationsTotalPages,
      conversationsLoading,
      conversationsRefreshing,
      activeConversationId,
      selectConversation,
      cdlScoreVerified,
      refreshCdlScoreStatus,
      conversationMessages,
      messagesLoading,
      refreshConversations,
      refreshConversationMessages,
      sendConversationMessage,
      listingsTab,
      setListingsTab,
      listingsPage,
      setListingsPage,
      listingRows,
      listingCounts,
      reservations,
      listingsTotal,
      listingsTotalPages,
      listingsLoading,
      listingsRefreshing,
      refreshMyListings,
      adminPage,
      setAdminPage,
      adminApprovals,
      adminTotal,
      adminTotalPages,
      adminLoading,
      adminRefreshing,
      refreshAdmin,
      driverDetails,
      driverDetailLoading,
      loadDriverDetail,
      invalidateViews
    }),
    [
      appLoading,
      badges,
      visibleNotifications,
      dismissAllNotifications,
      dismissNotification,
      refreshNotifications,
      dashboardPeriod,
      dashboard,
      dashboardLoading,
      refreshDashboard,
      marketplaceHotOnly,
      applyFindDriversFilters,
      trendingListingIds,
      marketplaceFilters,
      marketplacePage,
      resetMarketplaceFilters,
      marketplaceDrivers,
      marketplaceTotal,
      marketplaceTotalPages,
      marketplaceStates,
      marketplaceLoading,
      marketplaceRefreshing,
      marketplaceLoadedAt,
      refreshMarketplace,
      purchasedPage,
      purchasedRows,
      purchasedTotal,
      purchasedTotalPages,
      purchasedLoading,
      purchasedRefreshing,
      refreshPurchased,
      dealsPage,
      deals,
      dealsTotal,
      dealsTotalPages,
      dealsStats,
      dealsLoading,
      dealsRefreshing,
      refreshDeals,
      disputesPage,
      disputes,
      disputesTotal,
      disputesTotalPages,
      disputesLoading,
      disputesRefreshing,
      refreshDisputes,
      messagesPage,
      conversations,
      conversationsTotal,
      conversationsTotalPages,
      conversationsLoading,
      conversationsRefreshing,
      activeConversationId,
      selectConversation,
      cdlScoreVerified,
      refreshCdlScoreStatus,
      conversationMessages,
      messagesLoading,
      refreshConversations,
      refreshConversationMessages,
      sendConversationMessage,
      listingsTab,
      listingsPage,
      listingRows,
      listingCounts,
      reservations,
      listingsTotal,
      listingsTotalPages,
      listingsLoading,
      listingsRefreshing,
      refreshMyListings,
      adminPage,
      adminApprovals,
      adminTotal,
      adminTotalPages,
      adminLoading,
      adminRefreshing,
      refreshAdmin,
      driverDetails,
      driverDetailLoading,
      loadDriverDetail,
      invalidateViews
    ]
  );

  return <ExchangeDataContext.Provider value={value}>{children}</ExchangeDataContext.Provider>;
}

export function useExchangeData(): ExchangeDataValue {
  const ctx = useContext(ExchangeDataContext);
  if (!ctx) {
    throw new Error("useExchangeData must be used inside ExchangeDataProvider");
  }
  return ctx;
}
