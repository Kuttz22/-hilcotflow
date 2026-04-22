import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CheckSquare, Eye, EyeOff, ArrowRight, Loader2, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
        disabled={disabled}
        className="pr-10 h-10"
        autoComplete={id === "password" ? "current-password" : "new-password"}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

// ─── Sign In Form ─────────────────────────────────────────────────────────────

function SignInForm() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const emailLogin = trpc.auth.emailLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Welcome back!");
      setLocation("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message ?? "Sign in failed. Please try again.");
    },
  });

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    emailLogin.mutate({ email: email.trim(), password });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="signin-email" className="text-sm font-medium flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
        </Label>
        <Input
          id="signin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={emailLogin.isPending}
          className="h-10"
          autoComplete="email"
        />
        <FieldError message={errors.email} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signin-password" className="text-sm font-medium flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
        </Label>
        <PasswordInput
          id="signin-password"
          value={password}
          onChange={setPassword}
          disabled={emailLogin.isPending}
        />
        <FieldError message={errors.password} />
      </div>

      <Button
        type="submit"
        className="w-full h-10 gap-2"
        disabled={emailLogin.isPending}
      >
        {emailLogin.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign In <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Register Form ────────────────────────────────────────────────────────────

function RegisterForm() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});

  const register = trpc.auth.register.useMutation({
    onSuccess: async (_data) => {
      // Auto-login after registration
      toast.success("Account created! Signing you in…");
      emailLogin.mutate({ email: email.trim(), password });
    },
    onError: (err) => {
      toast.error(err.message ?? "Registration failed. Please try again.");
    },
  });

  const emailLogin = trpc.auth.emailLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/dashboard");
    },
    onError: () => {
      // Registration succeeded but auto-login failed — send to sign-in tab
      toast.info("Account created. Please sign in.");
      setLocation("/login");
    },
  });

  function validate(): boolean {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Full name is required.";
    else if (name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    if (!confirm) next.confirm = "Please confirm your password.";
    else if (confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const isPending = register.isPending || emailLogin.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    register.mutate({ name: name.trim(), email: email.trim(), password });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reg-name" className="text-sm font-medium flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name
        </Label>
        <Input
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          disabled={isPending}
          className="h-10"
          autoComplete="name"
        />
        <FieldError message={errors.name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-email" className="text-sm font-medium flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
        </Label>
        <Input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={isPending}
          className="h-10"
          autoComplete="email"
        />
        <FieldError message={errors.email} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-password" className="text-sm font-medium flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
        </Label>
        <PasswordInput
          id="reg-password"
          value={password}
          onChange={setPassword}
          placeholder="Minimum 8 characters"
          disabled={isPending}
        />
        <FieldError message={errors.password} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-confirm" className="text-sm font-medium flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Confirm Password
        </Label>
        <PasswordInput
          id="reg-confirm"
          value={confirm}
          onChange={setConfirm}
          placeholder="Re-enter your password"
          disabled={isPending}
        />
        <FieldError message={errors.confirm} />
      </div>

      <Button
        type="submit"
        className="w-full h-10 gap-2"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {register.isPending ? "Creating account…" : "Signing in…"}
          </>
        ) : (
          <>
            Create Account <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect already-authenticated users straight to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <CheckSquare className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span
              className="font-semibold text-base text-foreground tracking-tight"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Hilcot TaskFlow
            </span>
          </a>
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <CheckSquare className="w-6 h-6 text-primary" />
            </div>
            <h1
              className="text-2xl font-bold text-foreground mb-1.5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Welcome to Hilcot TaskFlow
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your account or create a new one to get started.
            </p>
          </div>

          <Card className="shadow-sm border-border">
            <CardContent className="pt-6">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 h-9">
                  <TabsTrigger value="signin" className="text-sm">Sign In</TabsTrigger>
                  <TabsTrigger value="register" className="text-sm">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-0">
                  <SignInForm />
                </TabsContent>

                <TabsContent value="register" className="mt-0">
                  <RegisterForm />
                </TabsContent>
              </Tabs>

              {/* Divider */}
              <div className="relative my-5">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                  or continue with
                </span>
              </div>

              {/* Manus OAuth — secondary option */}
              <Button
                variant="outline"
                className="w-full h-10 gap-2 text-sm"
                asChild
              >
                <a href={getLoginUrl()}>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                  Sign in with Manus
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Footer links */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            By signing in you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground transition-colors">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
