export const supportUserRoles = ["admin", "supervisor", "atendente"] as const;

export type SupportUserRole = (typeof supportUserRoles)[number];

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: SupportUserRole;
};

export type SupportUserSummary = CurrentUser & {
  whatsappPhone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
