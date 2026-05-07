import { LoginForm } from "@/shared/auth/LoginForm";
import { getCurrentUser } from "@/shared/auth/service";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/atendimentos");
  }

  return <LoginForm />;
}
