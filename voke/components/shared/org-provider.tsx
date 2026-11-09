"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { ORGANIZATIONS } from "@/lib/api";
import type { Organization } from "@/types";

interface OrgContextValue {
  org: Organization;
  organizations: readonly Organization[];
  setOrgId: (id: string) => void;
}

const OrgContext = createContext<OrgContextValue | null>(null);

function firstOrg(): Organization {
  const org = ORGANIZATIONS[0];
  if (!org) throw new Error("No organizations configured");
  return org;
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgId, setOrgId] = useState(firstOrg().id);
  const org = ORGANIZATIONS.find((item) => item.id === orgId) ?? firstOrg();
  const value = useMemo(() => ({ org, organizations: ORGANIZATIONS, setOrgId }), [org]);
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const value = useContext(OrgContext);
  if (!value) throw new Error("useOrg must be used within OrgProvider");
  return value;
}
