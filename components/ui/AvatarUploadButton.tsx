import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { AdminAvatar } from "./AdminAvatar";

type AvatarUploadButtonProps = {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  size?: "sm" | "md" | "lg";
};

export function AvatarUploadButton({
  name,
  initials,
  avatarUrl,
  onUpload,
  size = "lg"
}: AvatarUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const choose = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="avatar-upload">
      <AdminAvatar name={name} initials={initials} avatarUrl={avatarUrl} size={size} />
      <button
        type="button"
        className="avatar-upload-btn"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title="Upload photo"
      >
        <Camera className="icon-sm" />
      </button>
      <input
        ref={inputRef}
        type="file"
        className="file-input-hidden"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void choose(file);
        }}
      />
      {uploading ? <span className="t-caption t-secondary">Uploading…</span> : null}
    </div>
  );
}
