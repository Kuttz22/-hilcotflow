import { useAuth } from "@/_core/hooks/useAuth";
// getLoginUrl kept for Manus OAuth fallback on the /login page
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckSquare, Users, Bell, BarChart3, ArrowRight, Shield, Clock, Zap } from "lucide-react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Hilcot TaskFlow
            </span>
          </div>
          <Button asChild size="sm" className="gap-2">
            <a href="/login">
              Sign In <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6 border border-border">
              <Zap className="w-3 h-3" />
              Executive Task Management
            </div>
            <h1 className="text-5xl font-bold text-foreground leading-tight mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Tasks that demand
              <span className="text-primary block">accountability.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Hilcot TaskFlow ensures critical work never falls through the cracks. Tasks persist daily until completed, with intelligent reminders that escalate until action is taken.
            </p>
            <div className="flex gap-3">
              <Button asChild size="lg" className="gap-2 px-6">
              <a href="/login">
              Get Started <ArrowRight className="w-4 h-4" />
            </a>
              </Button>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                icon: CheckSquare,
                title: "Daily Rollover",
                desc: "Incomplete tasks automatically carry forward — nothing is forgotten.",
                color: "text-primary",
                bg: "bg-accent",
              },
              {
                icon: Bell,
                title: "Priority Reminders",
                desc: "Critical tasks trigger repeated notifications until completed.",
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                icon: Users,
                title: "Team Collaboration",
                desc: "Assign and share tasks with full accountability tracking.",
                color: "text-emerald-600",
                bg: "bg-emerald-50",
              },
              {
                icon: BarChart3,
                title: "Executive Dashboard",
                desc: "Real-time overview of all tasks, priorities, and team activity.",
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
                <h3 className="font-semibold text-sm text-foreground mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { icon: Shield, label: "Zero tasks lost", desc: "Daily rollover guarantees persistence" },
              { icon: Clock, label: "Real-time alerts", desc: "Configurable reminder intervals" },
              { icon: Users, label: "Full accountability", desc: "Who completed what and when" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <Icon className="w-6 h-6 text-primary mb-1" />
                <div className="font-semibold text-foreground">{label}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Hilcot TaskFlow. Professional task management for executive teams.
      </footer>
    </div>
  );
}
