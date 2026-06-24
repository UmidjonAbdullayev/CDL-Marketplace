import { Star } from "lucide-react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
};

export function StarRatingInput({ value, onChange, label, disabled = false }: Props) {
  return (
    <div className="star-rating-input">
      <span className="star-rating-input-label">{label}</span>
      <div className="star-rating-input-stars" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star-rating-input-btn ${star <= value ? "filled" : ""}`}
            disabled={disabled}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-pressed={star === value}
            onClick={() => onChange(star)}
          >
            <Star className="icon-md" />
          </button>
        ))}
      </div>
    </div>
  );
}
