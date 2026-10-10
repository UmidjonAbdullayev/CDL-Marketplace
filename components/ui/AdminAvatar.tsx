type AdminAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<AdminAvatarProps["size"]>, string> = {
  sm: "admin-avatar admin-avatar--sm",
  md: "admin-avatar admin-avatar--md",
  lg: "admin-avatar admin-avatar--lg"
};

export function AdminAvatar({
  name,
  avatarUrl,
  initials,
  size = "md",
  className = ""
}: AdminAvatarProps) {
  return (
    <div className={`${SIZE_CLASS[size]} ${className}`.trim()} title={name}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
