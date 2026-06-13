let activeCompanyId: string | null = null;

export function setActiveCompanyId(id: string | null): void {
  activeCompanyId = id;
}

export function getActiveCompanyId(): string {
  if (!activeCompanyId) {
    throw new Error("No active company session");
  }
  return activeCompanyId;
}

export function getActiveCompanyIdOrNull(): string | null {
  return activeCompanyId;
}
