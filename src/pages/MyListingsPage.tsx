import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../lib/badges";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import {
  DEFAULT_PAGE_SIZE,
  expireListing,
  updateListingPrice,
  updateListingStatus,
  type SellerListingRow
} from "../services/marketplace";
import { maxRecruiterPrice, validateRecruiterListPrice } from "../lib/listing-pricing";
import { fmtPrice } from "../lib/format";
import { invalidateDataViews } from "../lib/dataInvalidation";

function maskDriver(first: string, last: string) {
  return `${first} ${last.charAt(0)}.`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "badge-green",
    pending: "badge-yellow",
    paused: "badge-gray",
    hiring: "badge-purple",
    reserved: "badge-yellow",
    sold: "badge-blue",
    expired: "badge-red"
  };
  const label = status === "hiring" ? "Hiring in progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`badge ${map[status] ?? "badge-gray"}`}>{label}</span>;
}

export default function MyListingsPage() {
  const { openModal, closeModal, showToast } = useApp();
  const {
    listingsTab: tab,
    setListingsTab: setTab,
    listingsPage: page,
    setListingsPage: setPage,
    listingRows: rows,
    listingCounts: counts,
    listingsTotal: total,
    listingsTotalPages: totalPages,
    listingsLoading: loading,
    listingsRefreshing: refreshing,
    refreshMyListings
  } = useExchangeData();

  const editPrice = (row: SellerListingRow) => {
    const cap = maxRecruiterPrice(row.driver_type ?? "Owner Operator");
    let nextPrice = row.price;
    openModal(
      "Edit Listing Price",
      <div className="form-group">
        <label>New price (max {fmtPrice(cap)})</label>
        <input type="number" min={50} max={cap} defaultValue={row.price} onChange={(e) => { nextPrice = Number(e.target.value || row.price); }} />
      </div>,
      <>
        <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
        <button className="btn btn-primary" onClick={() => {
          const err = validateRecruiterListPrice(nextPrice, row.driver_type ?? "Owner Operator");
          if (err) {
            showToast(err, "error");
            return;
          }
          void updateListingPrice(row.id, nextPrice)
            .then(() => {
              closeModal();
              showToast("Price updated — pending admin re-approval", "success");
              invalidateDataViews(["my-listings", "marketplace", "dashboard", "admin"]);
              refreshMyListings(true);
            })
            .catch((e) => showToast(e instanceof Error ? e.message : "Failed to update price", "error"));
        }}>Save</button>
      </>
    );
  };

  const togglePause = (row: SellerListingRow) => {
    if (row.status === "hiring" || row.status === "sold") {
      showToast("Cannot pause a listing in this status", "error");
      return;
    }
    const target = row.status === "paused" ? "active" : "paused";
    void updateListingStatus(row.id, target)
      .then(() => {
        showToast(target === "paused" ? "Listing paused" : "Listing resumed", "success");
        invalidateDataViews(["my-listings", "marketplace", "dashboard"]);
        refreshMyListings(true);
      })
      .catch(() => showToast("Failed to update listing", "error"));
  };

  const expire = (row: SellerListingRow) => {
    void expireListing(row.id)
      .then(() => {
        showToast("Listing expired", "success");
        invalidateDataViews(["my-listings", "marketplace", "dashboard"]);
        refreshMyListings(true);
      })
      .catch(() => showToast("Failed to expire listing", "error"));
  };

  const renderActions = (row: SellerListingRow) => {
    if (tab === "sold" || tab === "expired" || row.status === "hiring") return null;
    return (
      <>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => editPrice(row)}>Edit Price</button>
        {row.status !== "pending" && row.status !== "sold" ? (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => togglePause(row)}>
            {row.status === "paused" ? "Resume" : "Pause"}
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => expire(row)}>Expire</button>
      </>
    );
  };

  const renderTable = (showActions: boolean) => (
    <>
      <div className="card"><div className="table-wrap"><table>
        <thead>
          <tr>
            <th>Driver</th><th>State</th><th>Equipment</th><th>Price</th><th>Views</th><th>Status</th>
            {showActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr><td colSpan={showActions ? 7 : 6} className="t-secondary">Loading listings...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={showActions ? 7 : 6} className="t-secondary">No listings in this tab</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id}>
              <td>{maskDriver(r.first_name, r.last_name)}</td>
              <td>{r.state}</td>
              <td>{r.equipment}</td>
              <td className="price-cell">{fmtPrice(r.price)}</td>
              <td>{r.views}</td>
              <td>{statusBadge(r.status)}</td>
              {showActions ? <td>{renderActions(r)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table></div></div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
    </>
  );

  return (
    <div className="page active">
      <PageHeader title="My Listings" desc="Manage your active, reserved, sold, and expired driver listings." />
      {refreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
      <div className="tabs" id="listingTabs">
        <button type="button" className={`tab ${tab === "active" ? "active" : ""}`} onClick={() => { setTab("active"); setPage(1); }}>Active ({counts.active})</button>
        <button type="button" className={`tab ${tab === "reserved" ? "active" : ""}`} onClick={() => { setTab("reserved"); setPage(1); }}>In Hiring ({counts.reserved})</button>
        <button type="button" className={`tab ${tab === "sold" ? "active" : ""}`} onClick={() => { setTab("sold"); setPage(1); }}>Sold ({counts.sold})</button>
        <button type="button" className={`tab ${tab === "expired" ? "active" : ""}`} onClick={() => { setTab("expired"); setPage(1); }}>Expired ({counts.expired})</button>
      </div>
      <div className={`tab-panel ${tab === "active" ? "active" : ""}`}>{renderTable(true)}</div>
      <div className={`tab-panel ${tab === "reserved" ? "active" : ""}`}>{renderTable(false)}</div>
      <div className={`tab-panel ${tab === "sold" ? "active" : ""}`}>{renderTable(false)}</div>
      <div className={`tab-panel ${tab === "expired" ? "active" : ""}`}>{renderTable(false)}</div>
    </div>
  );
}
