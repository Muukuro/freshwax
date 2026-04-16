import { AuthCard } from "@/components/auth-card";
import { signIn } from "@/app/actions/auth";

const LOGIN_ERRORS: Record<string, string> = {
  credentials: "The email or password is incorrect.",
  invalid: "Enter a valid email address and a password with at least 8 characters.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-page">
      <div className="auth-grid">
        <section className="auth-promo hidden md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
              Private listening desk
            </p>
            <h1 className="font-display mt-4 max-w-lg text-6xl leading-[0.92] tracking-[-0.05em] text-white">
              Catch the records you care about before the algorithm buries them.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-blue-100/78">
              Follow artists, spot late discoveries, and pipe upcoming dates into your own calendar
              from a dashboard that feels like a tool, not a splash page.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[0.9rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">Sync</p>
              <p className="mt-2 text-lg font-semibold text-white">Worker-backed updates</p>
            </div>
            <div className="rounded-[0.9rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">Calendar</p>
              <p className="mt-2 text-lg font-semibold text-white">Private `.ics` feed</p>
            </div>
          </div>
        </section>

        <AuthCard
          action={signIn}
          ctaLabel="Sign in"
          emailAutoComplete="username"
          error={params.error ? LOGIN_ERRORS[params.error] : undefined}
          footerHref="/signup"
          footerLabel="Create an account"
          footerText="No account yet?"
          passwordAutoComplete="current-password"
          subtitle="Track release schedules with a private dashboard, background sync jobs, and a calendar feed that works in any calendar app."
          title="Welcome back"
        />
      </div>
    </main>
  );
}
