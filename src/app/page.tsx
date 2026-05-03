import { SupportDashboard } from "@/modules/support/components/SupportDashboard";
import { LoginForm } from "@/shared/auth/LoginForm";
import { getCurrentUser } from "@/shared/auth/service";

export default async function Home() {
  const user = await getCurrentUser();

  return user ? <SupportDashboard currentUser={user} /> : <LoginForm />;
}
