import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellOff,
  BellRing,
  Moon,
  Clock,
  Shield,
  Trash2,
  AlertTriangle,
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  requestNotificationPermission,
  getFCMToken,
  onForegroundMessage,
} from "@/lib/firebaseMessaging";

type PushStatus = "unknown" | "checking" | "unsupported" | "denied" | "granted" | "registered" | "error";

interface PushDiagnostics {
  secureContext: boolean;
  notificationApi: boolean;
  serviceWorkerApi: boolean;
  pushManager: boolean;
  serviceWorkerRegistered: boolean;
  permissionState: NotificationPermission | "N/A";
  fcmTokenPresent: boolean;
  isIOS: boolean;
  isIOSBrowserTab: boolean;
  unsupportedReason: string | null;
}

function detectPushSupport(): Omit<PushDiagnostics, "serviceWorkerRegistered" | "fcmTokenPresent"> {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  // iOS browser tab (not PWA home screen) cannot use Web Push
  const isIOSBrowserTab = isIOS && !("standalone" in navigator && (navigator as any).standalone);

  const secureContext = window.isSecureContext === true;
  const notificationApi = "Notification" in window;
  const serviceWorkerApi = "serviceWorker" in navigator;
  const pushManager = "PushManager" in window;

  let unsupportedReason: string | null = null;
  if (isIOSBrowserTab) {
    unsupportedReason = "iOS browser tab — add to Home Screen to use push notifications";
  } else if (!secureContext) {
    unsupportedReason = "Page is not served over HTTPS (insecure context)";
  } else if (!notificationApi) {
    unsupportedReason = "Notification API not available in this browser";
  } else if (!serviceWorkerApi) {
    unsupportedReason = "Service Worker API not available in this browser";
  } else if (!pushManager) {
    unsupportedReason = "PushManager not available in this browser";
  }

  return {
    secureContext,
    notificationApi,
    serviceWorkerApi,
    pushManager,
    permissionState: notificationApi ? Notification.permission : "N/A",
    isIOS,
    isIOSBrowserTab,
    unsupportedReason,
  };
}

function DiagnosticRow({
  label,
  value,
  pass,
}: {
  label: string;
  value: string;
  pass: boolean | null;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground font-mono">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{value}</span>
        {pass === null ? (
          <span className="w-4 h-4" />
        ) : pass ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        )}
      </div>
    </div>
  );
}

export default function NotificationPreferencesPage() {
  const { data: prefs, isLoading } = trpc.notifications.getPreferences.useQuery();
  const updatePrefs = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => toast.success("Preferences saved"),
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const deleteAccount = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted");
      setLocation("/");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const registerDevice = trpc.notifications.registerDevice.useMutation({
    onSuccess: () => {
      setPushStatus("registered");
      toast.success("Push notifications enabled for this browser");
    },
    onError: (e: { message: string }) => {
      setPushStatus("error");
      toast.error("Failed to register device: " + e.message);
    },
  });
  const unregisterDevice = trpc.notifications.removeDevice.useMutation({
    onSuccess: () => {
      setPushStatus("granted");
      setCurrentToken(null);
      toast.success("Push notifications disabled for this browser");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [maxReminders, setMaxReminders] = useState("10");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Push notification state
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics | null>(null);

  useEffect(() => {
    if (prefs) {
      setQuietHoursEnabled(!!(prefs.quietHoursStart && prefs.quietHoursEnd));
      setQuietStart(prefs.quietHoursStart ?? "22:00");
      setQuietEnd(prefs.quietHoursEnd ?? "07:00");
      setMaxReminders(String(prefs.maxRemindersPerDay ?? 10));
    }
  }, [prefs]);

  // Check current push notification status on mount
  useEffect(() => {
    const checkPushStatus = async () => {
      const base = detectPushSupport();

      // Check if service worker is already registered
      let serviceWorkerRegistered = false;
      if (base.serviceWorkerApi) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          serviceWorkerRegistered = registrations.some((r) =>
            r.active?.scriptURL?.includes("firebase-messaging-sw.js")
          );
        } catch {
          serviceWorkerRegistered = false;
        }
      }

      // Check stored token
      const storedToken = sessionStorage.getItem("fcm_token");
      const fcmTokenPresent = !!storedToken;

      const fullDiagnostics: PushDiagnostics = {
        ...base,
        serviceWorkerRegistered,
        fcmTokenPresent,
      };
      setDiagnostics(fullDiagnostics);

      // Determine push status
      if (base.unsupportedReason) {
        setPushStatus("unsupported");
        return;
      }

      const permission = base.permissionState;
      if (permission === "denied") {
        setPushStatus("denied");
      } else if (permission === "granted") {
        if (storedToken) {
          setCurrentToken(storedToken);
          setPushStatus("registered");
        } else {
          setPushStatus("granted");
        }
      } else {
        setPushStatus("unknown");
      }
    };

    checkPushStatus();
  }, []);

  // Listen for foreground messages and show toast
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || "Task Reminder";
      const body = payload.notification?.body || "You have a pending task.";
      toast(title, {
        description: body,
        duration: 8000,
        icon: <BellRing className="h-4 w-4 text-primary" />,
      });
    });
    return unsubscribe;
  }, []);

  const handleEnablePush = useCallback(async () => {
    setIsEnablingPush(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        setPushStatus("denied");
        setDiagnostics((d) => d ? { ...d, permissionState: permission } : d);
        toast.error(
          permission === "denied"
            ? "Notifications blocked. Please enable them in your browser settings."
            : "Notification permission was not granted."
        );
        return;
      }

      setDiagnostics((d) => d ? { ...d, permissionState: "granted" } : d);
      setPushStatus("granted");

      const token = await getFCMToken();
      if (!token) {
        toast.error("Could not get push token. Check browser console for details.");
        setPushStatus("error");
        return;
      }

      setCurrentToken(token);
      sessionStorage.setItem("fcm_token", token);
      setDiagnostics((d) => d ? { ...d, fcmTokenPresent: true, serviceWorkerRegistered: true } : d);

      await registerDevice.mutateAsync({ token, platform: "web" });
    } catch (err) {
      console.error("[Push] Error enabling push notifications:", err);
      setPushStatus("error");
      toast.error("Failed to enable push notifications.");
    } finally {
      setIsEnablingPush(false);
    }
  }, [registerDevice]);

  const handleDisablePush = useCallback(async () => {
    if (!currentToken) return;
    await unregisterDevice.mutateAsync({ token: currentToken });
    sessionStorage.removeItem("fcm_token");
    setDiagnostics((d) => d ? { ...d, fcmTokenPresent: false } : d);
  }, [currentToken, unregisterDevice]);

  const handleSave = () => {
    updatePrefs.mutate({
      quietHoursStart: quietHoursEnabled ? quietStart : null,
      quietHoursEnd: quietHoursEnabled ? quietEnd : null,
      maxRemindersPerDay: parseInt(maxReminders) || 10,
    });
  };

  const pushStatusInfo = {
    unknown: {
      icon: <Bell className="h-4 w-4 text-muted-foreground" />,
      label: "Not enabled",
      color: "secondary" as const,
      description: "Enable push notifications to receive task reminders in this browser.",
    },
    checking: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
      label: "Checking...",
      color: "secondary" as const,
      description: "Checking notification status...",
    },
    unsupported: {
      icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
      label: "Unsupported",
      color: "secondary" as const,
      description: diagnostics?.unsupportedReason ?? "Push notifications are not supported in this browser.",
    },
    denied: {
      icon: <BellOff className="h-4 w-4 text-destructive" />,
      label: "Blocked",
      color: "destructive" as const,
      description: "Notifications are blocked. Open browser settings and allow notifications for this site.",
    },
    granted: {
      icon: <Bell className="h-4 w-4 text-amber-500" />,
      label: "Permission granted",
      color: "outline" as const,
      description: "Permission granted but not yet registered. Click Enable to start receiving notifications.",
    },
    registered: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      label: "Active",
      color: "default" as const,
      description: "Push notifications are active for this browser. You will receive task reminders.",
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-destructive" />,
      label: "Error",
      color: "destructive" as const,
      description: "An error occurred. Please try again or check the browser console.",
    },
  };

  const statusInfo = pushStatusInfo[pushStatus];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notification Preferences</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure how and when you receive task reminders and alerts.
          </p>
        </div>

        {/* Web Push Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Browser Push Notifications</CardTitle>
            </div>
            <CardDescription>
              Receive real-time task reminders directly in this browser, even when the app is in the background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusInfo.icon}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant={statusInfo.color} className="text-xs">
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{statusInfo.description}</p>
                </div>
              </div>
            </div>

            {/* iOS browser-tab notice */}
            {diagnostics?.isIOSBrowserTab && (
              <div className="rounded-md border border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Push notifications on iPhone
                  </p>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  iOS browser tabs (Safari, Chrome, Edge) do not support Web Push. To receive push
                  notifications on iPhone, you have two options:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-400 list-disc pl-4 space-y-0.5">
                  <li>
                    <strong>Add to Home Screen</strong> — tap the Share icon in Safari, choose "Add to
                    Home Screen", then open the app from your home screen and enable notifications.
                  </li>
                  <li>
                    <strong>Native app</strong> — install the Hilcot TaskFlow native iOS app (coming soon)
                    for full push notification support.
                  </li>
                </ul>
              </div>
            )}

            {/* Token display */}
            {pushStatus === "registered" && currentToken && (
              <div className="bg-muted/50 rounded-md p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Device Token (first 40 chars)</p>
                <p className="text-xs font-mono text-foreground break-all">
                  {currentToken.substring(0, 40)}...
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {(pushStatus === "unknown" || pushStatus === "granted" || pushStatus === "error") && (
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  disabled={isEnablingPush || registerDevice.isPending}
                  className="flex items-center gap-2"
                >
                  {isEnablingPush ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BellRing className="h-3.5 w-3.5" />
                  )}
                  {isEnablingPush ? "Enabling..." : "Enable Push Notifications"}
                </Button>
              )}
              {pushStatus === "registered" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisablePush}
                  disabled={unregisterDevice.isPending}
                  className="flex items-center gap-2"
                >
                  <BellOff className="h-3.5 w-3.5" />
                  {unregisterDevice.isPending ? "Disabling..." : "Disable for This Browser"}
                </Button>
              )}
              {pushStatus === "denied" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open("about:preferences#privacy", "_blank")}
                  className="flex items-center gap-2"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Open Browser Settings
                </Button>
              )}
            </div>

            {/* Diagnostics panel */}
            <div className="border border-border/60 rounded-md overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                onClick={() => setShowDiagnostics((v) => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Browser Push Diagnostics
                </span>
                {showDiagnostics ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {showDiagnostics && diagnostics && (
                <div className="px-3 pb-3 pt-1 bg-muted/20 space-y-0">
                  <DiagnosticRow
                    label="Secure context (HTTPS)"
                    value={diagnostics.secureContext ? "yes" : "no"}
                    pass={diagnostics.secureContext}
                  />
                  <DiagnosticRow
                    label="Notification API"
                    value={diagnostics.notificationApi ? "yes" : "no"}
                    pass={diagnostics.notificationApi}
                  />
                  <DiagnosticRow
                    label="Service Worker API"
                    value={diagnostics.serviceWorkerApi ? "yes" : "no"}
                    pass={diagnostics.serviceWorkerApi}
                  />
                  <DiagnosticRow
                    label="PushManager"
                    value={diagnostics.pushManager ? "yes" : "no"}
                    pass={diagnostics.pushManager}
                  />
                  <DiagnosticRow
                    label="Service worker registered"
                    value={diagnostics.serviceWorkerRegistered ? "yes" : "no"}
                    pass={diagnostics.serviceWorkerRegistered}
                  />
                  <DiagnosticRow
                    label="Current permission state"
                    value={diagnostics.permissionState}
                    pass={
                      diagnostics.permissionState === "granted"
                        ? true
                        : diagnostics.permissionState === "denied"
                        ? false
                        : null
                    }
                  />
                  <DiagnosticRow
                    label="FCM token present"
                    value={diagnostics.fcmTokenPresent ? "yes" : "no"}
                    pass={diagnostics.fcmTokenPresent}
                  />
                  {diagnostics.isIOS && (
                    <DiagnosticRow
                      label="iOS device"
                      value={diagnostics.isIOSBrowserTab ? "browser tab (limited)" : "Home Screen PWA"}
                      pass={!diagnostics.isIOSBrowserTab}
                    />
                  )}
                  {diagnostics.unsupportedReason && (
                    <div className="mt-2 rounded bg-destructive/10 px-2 py-1.5">
                      <p className="text-xs text-destructive font-medium">
                        Unsupported reason: {diagnostics.unsupportedReason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reminder Limits */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Reminder Limits</CardTitle>
            </div>
            <CardDescription>
              Control the maximum number of reminders you receive per day across all tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="maxReminders" className="text-sm font-medium">
                Maximum reminders per day
              </Label>
              <Input
                id="maxReminders"
                type="number"
                min="1"
                max="50"
                value={maxReminders}
                onChange={(e) => setMaxReminders(e.target.value)}
                className="w-32 h-9"
              />
              <p className="text-xs text-muted-foreground">
                Once this limit is reached, no further reminders will be delivered until the next day.
                Range: 1–50.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Quiet Hours</CardTitle>
            </div>
            <CardDescription>
              During quiet hours, no push notifications will be delivered regardless of task priority.
              All times are in UTC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable quiet hours</p>
                <p className="text-xs text-muted-foreground">
                  Suppress all notifications during the specified time window.
                </p>
              </div>
              <Switch
                checked={quietHoursEnabled}
                onCheckedChange={setQuietHoursEnabled}
              />
            </div>

            {quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Start time (UTC)
                  </Label>
                  <Input
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> End time (UTC)
                  </Label>
                  <Input
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Escalation Info */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-base text-amber-800 dark:text-amber-400">Escalation Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
              <p>The following escalation rules apply to all Priority and Critical tasks:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>After <strong>3 reminders</strong> without completion — task is escalated and marked with an escalation badge.</li>
                <li>After <strong>12 reminders</strong> — the task creator receives a direct escalation alert notification.</li>
                <li>Quiet hours are respected for standard reminders but <strong>escalation alerts at 12 reminders are always delivered</strong> to the creator.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updatePrefs.isPending}>
            {updatePrefs.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>

        <Separator />

        {/* Account Deletion */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" />
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Permanently delete your account and all associated data. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, all tasks you created, all activity logs,
              device tokens, and preferences. This action <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              To confirm, type <strong className="text-foreground">DELETE</strong> below:
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteConfirm(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
