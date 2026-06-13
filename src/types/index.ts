import type { DriverType } from "../lib/driver-types";

export type ScoreFlag = "green" | "yellow" | "red";

/** Minimal fields for marketplace / list card views */
export interface DriverCard {
  id: number;
  first: string;
  last: string;
  state: string;
  exp: number;
  cdl: string;
  equip: string;
  avail: string;
  score: ScoreFlag;
  verified: boolean;
  price: number;
  seller: string;
  sellerRating: number;
  hotScore?: number;
  isTrending?: boolean;
  driverType: DriverType;
  featured: boolean;
  createdAt: string;
  isNew?: boolean;
}

export interface Driver {
  id: number;
  first: string;
  last: string;
  state: string;
  exp: number;
  cdl: string;
  equip: string;
  endorse: string[];
  avail: string;
  score: ScoreFlag;
  verified: boolean;
  price: number;
  seller: string;
  sellerRating: number;
  phone: string;
  email: string;
  cdlNum: string;
  docs: string[];
  notes: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface HotListing {
  id: number;
  name: string;
  exp: string;
  state: string;
  route: string;
  trailer: string;
  score: number;
  price: number;
  hot?: boolean;
}
