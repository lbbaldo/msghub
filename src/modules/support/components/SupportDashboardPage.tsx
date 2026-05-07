import { SupportDashboard } from "@/modules/support/components/SupportDashboard";
import type { AppView } from "@/modules/support/components/SupportDashboard.model";
import { LoginForm } from "@/shared/auth/LoginForm";
import { getCurrentUser } from "@/shared/auth/service";

type SupportDashboardPageProps = {
  initialView: AppView;
};

export async function SupportDashboardPage({
  initialView,
}: SupportDashboardPageProps) {
  const user = await getCurrentUser();

  return user ? (
    <SupportDashboard currentUser={user} initialView={initialView} />
  ) : (
    <LoginForm />
  );
}
