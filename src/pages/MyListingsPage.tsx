import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../lib/badges";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { DEFAULT_PAGE_SIZE, updateListingPrice, updateListingStatus, type SellerListingRow } from "../services/marketplace";
import { fmtPrice } from "../lib/format";
import { invalidateDataViews } from "../lib/dataInvalidation";

function maskDriver(first: string, last: string) {
  return `${first} ${last.charAt(0)}.`;
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
    reservations,
    listingsTotal: total,
    listingsTotalPages: totalPages,
    listingsLoading: loading,
    listingsRefreshing: refreshing,
    refreshMyListings
  } = useExchangeData();

  const editPrice = (id: number) => {
    const current = rows.find((r) => r.id === id)?.price ?? 0;
    let nextPrice = current;
    openModal(
      "Edit Price",
      <div className="form-group"><label>New Price</label><input type="number" defaultValue={current} onChange={(e) => { nextPrice = Number(e.target.value || current); }} /></div>,
      <>
        <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
        <button className="btn btn-primary" onClick={() => {
          void updateListingPrice(id, nextPrice)
            .then(() => {
              closeModal();
              showToast("Price updated", "success");
              invalidateDataViews(["my-listings", "marketplace", "dashboard"]);
              refreshMyListings(true);
            })
            .catch(() => showToast("Failed to update price", "error"));
        }}>Save</button>
      </>
    );
  };

  const togglePause = (row: SellerListingRow) => {
    const next = row.status === "active" ? "paused" : "active";
    void updateListingStatus(row.id, next)
      .then(() => {
        showToast(next === "paused" ? "Listing paused" : "Listing resumed", "success");
        invalidateDataViews(["my-listings", "marketplace", "dashboard"]);
        refreshMyListings(true);
      })
      .catch(() => showToast("Failed to update listing", "error"));
  };

  const statusBadge = (status: string) => {
    const cls = status === "active" ? "badge-green" : status === "paused" ? "badge-yellow" : "badge-red";
    return <span className={`badge ${cls}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  return (
    <div className="page active">
      <PageHeader title="My Listings" desc="Manage your active, reserved, sold, and expired driver listings." />
      {refreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
      <div className="tabs" id="listingTabs">
        <button className={`tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>Active ({counts.active})</button>
        <button className={`tab ${tab === "reserved" ? "active" : ""}`} onClick={() => setTab("reserved")}>Reserved ({counts.reserved})</button>
        <button className={`tab ${tab === "sold" ? "active" : ""}`} onClick={() => setTab("sold")}>Sold ({counts.sold})</button>
        <button className={`tab ${tab === "expired" ? "active" : ""}`} onClick={() => setTab("expired")}>Expired ({counts.expired})</button>
      </div>
      <div className={`tab-panel ${tab === "active" ? "active" : ""}`}>
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Driver</th><th>State</th><th>Equipment</th><th>Price</th><th>Views</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="t-secondary">Loading listings...</td></tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{maskDriver(r.first_name, r.last_name)}</td><td>{r.state}</td><td>{r.equipment}</td>
                <td className="price-cell">{fmtPrice(r.price)}</td><td>{r.views}</td><td>{statusBadge(r.status)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => editPrice(r.id)}>Edit Price</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => togglePause(r)}>{r.status === "active" ? "Pause" : "Resume"}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => showToast("Listing duplicated - edit and publish", "success")}>Duplicate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
      </div>
      <div className={`tab-panel ${tab === "reserved" ? "active" : ""}`}>
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Driver</th><th>Reserved By</th><th>Expires</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="t-secondary">Loading reservations...</td></tr>
            ) : reservations.map((r, i) => {
              const listing = r.driver_listings;
              const buyer = r.companies;
              return (
                <tr key={i}>
                  <td>{listing ? maskDriver(listing.first_name, listing.last_name) : "—"}</td>
                  <td>{buyer?.name ?? "—"}</td>
                  <td>{new Date(r.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td>{listing ? fmtPrice(listing.price) : "—"}</td>
                  <td><span className="badge badge-yellow">Reserved</span></td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      </div>
      <div className={`tab-panel ${tab === "sold" ? "active" : ""}`}>
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Driver</th><th>State</th><th>Equipment</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={5} className="t-secondary">Loading sold listings...</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>{maskDriver(r.first_name, r.last_name)}</td><td>{r.state}</td><td>{r.equipment}</td>
                <td>{fmtPrice(r.price)}</td><td><span className="badge badge-gray">Sold</span></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
      </div>
      <div className={`tab-panel ${tab === "expired" ? "active" : ""}`}>
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Driver</th><th>State</th><th>Equipment</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={5} className="t-secondary">Loading expired listings...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="t-secondary">No expired listings</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>{maskDriver(r.first_name, r.last_name)}</td><td>{r.state}</td><td>{r.equipment}</td>
                <td>{fmtPrice(r.price)}</td><td><span className="badge badge-red">Expired</span></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
      </div>
    </div>
  );
}
