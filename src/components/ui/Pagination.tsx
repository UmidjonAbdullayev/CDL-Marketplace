type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, total, pageSize, loading, onPageChange }: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination-bar">
      <span className="pagination-meta t-secondary">
        {loading ? "Loading..." : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="pagination-page t-secondary">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
