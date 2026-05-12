import { redirect } from "next/navigation";

import { SupportDashboard } from "@/modules/support/components/SupportDashboard";
import {
  canAccessAppView,
  type AppView,
} from "@/modules/support/components/SupportDashboard.model";
import { LoginForm } from "@/shared/auth/LoginForm";
import { getCurrentUser } from "@/shared/auth/service";

type SupportDashboardPageProps = {
  initialView: AppView;
};

export async function SupportDashboardPage({
  initialView,
}: SupportDashboardPageProps) {
  const user = await getCurrentUser();

  if (user && !canAccessAppView(user.role, initialView)) {
    redirect("/atendimentos");
  }

  return user ? (
    <SupportDashboard currentUser={user} initialView={initialView} />
  ) : (
    <LoginForm />
  );
}
