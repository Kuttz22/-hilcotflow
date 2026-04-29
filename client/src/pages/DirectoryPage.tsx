/**
 * DirectoryPage — Production-grade collaboration layer
 *
 * Tabs:
 *  1. Contacts   — personal contacts (family, friends, assistants, etc.)
 *  2. Workspace  — members of the selected workspace
 *  3. Invites    — sent/received invitations with status
 *  4. Categories — derived from contact data
 *
 * All data is sourced from the existing tRPC backend (MySQL/TiDB).
 * Firestore is used by the native iOS app; the web app uses tRPC exclusively.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useWorkspace, type WorkspaceSummary } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Mail,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Send,
  Copy,
  Check,
  FolderOpen,
  UserMinus,
  Building2,
  Search,
  Shield,
  Eye,
  UserCheck,
  ClipboardList,
  Tag,
  ChevronDown,
  CheckCircle2,
  Clock,
  XCircle,
  Briefcase,
  Heart,
  Star,
  UserCog,
} from "lucide-react";
import { getInitials } from "@/lib/taskUtils";
import { ProfileDrawer, type ProfileContact } from "@/components/ProfileDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

type Contact = {
  id: number;
  contactId: number;
  name: string | null;
  email: string | null;
  nickname: string | null;
  source: string;
  groups: string[];
  addedAt: Date;
};

type Group = {
  id: number;
  name: string;
  type: string;
  isDefault: boolean;
};

type WorkspaceMember = {
  userId: number;
  name: string | null;
  email: string | null;
  role: string;
  joinedAt: Date;
};

type Invitation = {
  id: number;
  inviterId: number;
  email: string | null;
  phone: string | null;
  groupId: number | null;
  token: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ["Family", "Friends", "Business", "Assistants"];
const CREATE_NEW_WS_SENTINEL = "__create_new_ws__";

const ROLE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  admin: {
    label: "Admin",
    icon: <Shield className="h-3 w-3" />,
    color: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400",
  },
  member: {
    label: "Member",
    icon: <UserCheck className="h-3 w-3" />,
    color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  },
  viewer: {
    label: "Viewer",
    icon: <Eye className="h-3 w-3" />,
    color: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  },
  owner: {
    label: "Owner",
    icon: <Star className="h-3 w-3" />,
    color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    color: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  accepted: {
    label: "Accepted",
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  },
  declined: {
    label: "Declined",
    icon: <XCircle className="h-3 w-3" />,
    color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  },
  expired: {
    label: "Expired",
    icon: <XCircle className="h-3 w-3" />,
    color: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  },
};

// ─── Shared: Person Row ───────────────────────────────────────────────────────

function PersonRow({
  name,
  email,
  subtitle,
  badge,
  badgeColor,
  actions,
  isCurrentUser,
  onClick,
}: {
  name: string;
  email?: string | null;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  actions?: React.ReactNode;
  isCurrentUser?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer" onClick={onClick}>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{name}</p>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs h-4 px-1.5 shrink-0">You</Badge>
          )}
          {badge && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full border ${badgeColor ?? ""}`}>
              {badge}
            </span>
          )}
        </div>
        {(email || subtitle) && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{email ?? subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── Shared: Empty State ──────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground opacity-60" />
      </div>
      <p className="text-base font-semibold mb-1">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}

// ─── Shared: Loading Skeleton ─────────────────────────────────────────────────

function RowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[60px] rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}

// ─── Add Contact Modal ────────────────────────────────────────────────────────

function AddContactModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("Friends");

  const { data: allUsers = [] } = trpc.users.list.useQuery();

  // Try to find an existing user by email to link
  const matchedUser = email.trim()
    ? allUsers.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase())
    : undefined;

  const addContact = trpc.directory.addContact.useMutation({
    onSuccess: () => {
      utils.directory.listContacts.invalidate();
      toast.success("Contact added", { description: `${name} has been added to your directory.` });
      handleClose();
    },
    onError: (err) => toast.error("Failed to add contact", { description: err.message }),
  });

  const handleClose = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCategory("Friends");
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (!matchedUser) {
      toast.error("User not found", {
        description: "The email you entered does not match any registered Hilcot user. Ask them to sign up first, then add them as a contact.",
      });
      return;
    }
    addContact.mutate({ contactId: matchedUser.id, nickname: name.trim() !== matchedUser.name ? name.trim() : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Contact
          </DialogTitle>
          <DialogDescription>
            Add a Hilcot user to your personal directory. They must already have an account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email address <span className="text-destructive">*</span></label>
            <Input
              type="email"
              placeholder="their@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {email.trim() && !matchedUser && (
              <p className="text-xs text-muted-foreground">No Hilcot account found for this email yet.</p>
            )}
            {matchedUser && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Found: {matchedUser.name}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Phone (optional)</label>
            <Input
              type="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category <span className="text-destructive">*</span></label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !email.trim() || !matchedUser || addContact.isPending}
          >
            {addContact.isPending ? "Adding…" : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Workspace Modal ───────────────────────────────────────────────────

const WORKSPACE_TYPES = ["Personal", "Organization", "Hospital", "Family", "Team"];

function CreateWorkspaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { refetch } = useWorkspace();
  const [name, setName] = useState("");
  const [type, setType] = useState("Team");
  const [description, setDescription] = useState("");

  const createWorkspace = trpc.workspaces.create.useMutation({
    onSuccess: () => {
      utils.workspaces.list.invalidate();
      refetch();
      toast.success("Workspace created", { description: `"${name}" is ready.` });
      handleClose();
    },
    onError: (err) => toast.error("Failed to create workspace", { description: err.message }),
  });

  const handleClose = () => {
    setName("");
    setType("Team");
    setDescription("");
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createWorkspace.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Create Workspace
          </DialogTitle>
          <DialogDescription>
            A workspace brings your team together for shared task management.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Workspace Name <span className="text-destructive">*</span></label>
            <Input
              placeholder="e.g. Acme Corp, My Family, ICU Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Workspace Type <span className="text-destructive">*</span></label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKSPACE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              placeholder="What is this workspace for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createWorkspace.isPending}
          >
            {createWorkspace.isPending ? "Creating…" : "Create Workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  open,
  onClose,
  groups,
  activeWorkspace,
}: {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  activeWorkspace: WorkspaceSummary | null;
}) {
  const utils = trpc.useUtils();
  const { workspaces, refetch: refetchWorkspaces } = useWorkspace();
  const [email, setEmail] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>(
    activeWorkspace ? String(activeWorkspace.id) : "personal"
  );
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Inline create-workspace state
  const [showNewWsInput, setShowNewWsInput] = useState(false);
  const [newWsName, setNewWsName] = useState("");

  const isWorkspaceInvite = workspaceId !== "personal" && workspaceId !== CREATE_NEW_WS_SENTINEL;
  const selectedWorkspace = workspaces.find((w) => String(w.id) === workspaceId);

  // Inline workspace creation
  const createWorkspaceInline = trpc.workspaces.create.useMutation({
    onSuccess: (newWs) => {
      utils.workspaces.list.invalidate();
      refetchWorkspaces();
      setWorkspaceId(String(newWs.id));
      setShowNewWsInput(false);
      // capture the name before clearing state
      const createdName = newWsName.trim();
      setNewWsName("");
      toast.success("Workspace created", { description: `"${createdName}" is ready and selected.` });
    },
    onError: (err) => toast.error("Failed to create workspace", { description: err.message }),
  });

  const handleWorkspaceChange = (value: string) => {
    if (value === CREATE_NEW_WS_SENTINEL) {
      setShowNewWsInput(true);
    } else {
      setWorkspaceId(value);
      setShowNewWsInput(false);
      setNewWsName("");
    }
  };

  const handleSaveNewWs = () => {
    const trimmed = newWsName.trim();
    if (!trimmed) return;
    createWorkspaceInline.mutate({ name: trimmed });
  };

  // Personal invite
  const sendPersonalInvite = trpc.invitations.send.useMutation({
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl);
      utils.invitations.list.invalidate();
      toast.success("Invitation sent", { description: `Invitation email sent to ${email}` });
    },
    onError: (err) => toast.error("Failed to send invitation", { description: err.message }),
  });

  // Workspace invite
  const sendWorkspaceInvite = trpc.workspaces.invitations.send.useMutation({
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl);
      toast.success("Workspace invitation sent", { description: `${email} has been invited to ${selectedWorkspace?.name}.` });
    },
    onError: (err) => toast.error("Failed to send invitation", { description: err.message }),
  });

  const isPending = sendPersonalInvite.isPending || sendWorkspaceInvite.isPending;

  const handleSend = () => {
    if (!email.trim()) return;
    if (isWorkspaceInvite && selectedWorkspace) {
      sendWorkspaceInvite.mutate({
        workspaceId: selectedWorkspace.id,
        email: email.trim(),
        role,
        origin: window.location.origin,
      });
    } else {
      sendPersonalInvite.mutate({
        email: email.trim(),
        origin: window.location.origin,
      });
    }
  };

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setEmail("");
    setWorkspaceId(activeWorkspace ? String(activeWorkspace.id) : "personal");
    setRole("member");
    setInviteUrl(null);
    setCopied(false);
    setShowNewWsInput(false);
    setNewWsName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Invite Someone
          </DialogTitle>
          <DialogDescription>
            Send an invitation by email. They'll receive a link to join.
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email address <span className="text-destructive">*</span></label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Invite to workspace</label>
              <Select
                value={showNewWsInput ? CREATE_NEW_WS_SENTINEL : workspaceId}
                onValueChange={handleWorkspaceChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal (app invite only)</SelectItem>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                  <Separator className="my-1" />
                  <SelectItem value={CREATE_NEW_WS_SENTINEL} className="text-primary font-medium">
                    + Create new workspace
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Inline new-workspace input */}
              {showNewWsInput && (
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder="Workspace name"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveNewWs()}
                    autoFocus
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 shrink-0"
                    onClick={handleSaveNewWs}
                    disabled={!newWsName.trim() || createWorkspaceInline.isPending}
                  >
                    {createWorkspaceInline.isPending ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 shrink-0"
                    onClick={() => { setShowNewWsInput(false); setNewWsName(""); }}
                    disabled={createWorkspaceInline.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {isWorkspaceInvite && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Role</label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                Invitation sent to {email}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Share the link below if they didn't receive the email.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Invite link</label>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!inviteUrl ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSend} disabled={!email.trim() || isPending}>
                {isPending ? "Sending…" : "Send Invitation"}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({
  contacts,
  isLoading,
  search,
  onAddContact,
  onOpenProfile,
}: {
  contacts: Contact[];
  isLoading: boolean;
  search: string;
  onAddContact: () => void;
  onOpenProfile?: (c: Contact) => void;
}) {
  const utils = trpc.useUtils();
  const { data: groups = [] } = trpc.groups.list.useQuery();

  const removeContact = trpc.directory.removeContact.useMutation({
    onSuccess: () => {
      utils.directory.listContacts.invalidate();
      toast.success("Contact removed");
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.nickname ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  if (isLoading) return <RowSkeleton />;

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Your directory is empty"
        description="Add family, friends, colleagues, and assistants to quickly assign tasks to the right people."
        action={
          <Button onClick={onAddContact}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add your first contact
          </Button>
        }
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No contacts match"
        description="Try a different name or email address."
      />
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((contact) => {
        const displayName = contact.nickname ?? contact.name ?? "Unknown";
        const category = contact.groups[0];
        const roleMeta = category ? undefined : undefined;

        return (
          <PersonRow
            key={contact.id}
            name={displayName}
            email={contact.email}
            badge={category}
            badgeColor="bg-primary/10 text-primary border-primary/20"
            onClick={() => onOpenProfile?.(contact)}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => toast.info("Task assignment coming soon")}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Assign Task
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => removeContact.mutate({ contactId: contact.contactId })}
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Remove contact
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        );
      })}
    </div>
  );
}

// ─── Workspace Tab ────────────────────────────────────────────────────────────

function WorkspaceTab({
  activeWorkspace,
  search,
  onCreateWorkspace,
  onInvite,
  onOpenProfile,
}: {
  activeWorkspace: WorkspaceSummary | null;
  search: string;
  onCreateWorkspace: () => void;
  onInvite: () => void;
  onOpenProfile?: (m: WorkspaceMember) => void;
}) {
  const { user } = useAuth();
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: members = [], isLoading } = trpc.workspaces.members.list.useQuery(
    { workspaceId: activeWorkspace!.id },
    { enabled: !!activeWorkspace }
  );

  const filtered = useMemo(() => {
    let result = members as WorkspaceMember[];
    if (roleFilter !== "all") result = result.filter((m) => m.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.name ?? "").toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [members, roleFilter, search]);

  if (!activeWorkspace) {
    return (
      <EmptyState
        icon={Building2}
        title="No workspace selected"
        description="Create a workspace to collaborate with your team, hospital staff, or family members."
        action={
          <Button onClick={onCreateWorkspace}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workspace
          </Button>
        }
      />
    );
  }

  const isAdmin = activeWorkspace.role === "admin";

  return (
    <div className="space-y-4">
      {/* Workspace info bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{activeWorkspace.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{activeWorkspace.role}</p>
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={onInvite}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Invite member
          </Button>
        )}
      </div>

      {/* Role filter */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", "admin", "member", "viewer"].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              roleFilter === r
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {r === "all" ? "All" : ROLE_META[r]?.label ?? r}
          </button>
        ))}
      </div>

      {isLoading ? (
        <RowSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description={
            (members as WorkspaceMember[]).length === 0
              ? "Invite your team to start collaborating."
              : "No members match your current filter."
          }
          action={
            isAdmin && (members as WorkspaceMember[]).length === 0 ? (
              <Button onClick={onInvite}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite your team
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((member) => {
            const meta = ROLE_META[member.role] ?? ROLE_META.member;
            return (
              <PersonRow
                key={member.userId}
                name={member.name ?? "Unknown"}
                email={member.email}
                badge={meta.label}
                badgeColor={meta.color}
                isCurrentUser={member.userId === user?.id}
                onClick={() => onOpenProfile?.(member)}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toast.info("Task assignment coming soon")}
                  >
                    <ClipboardList className="h-3.5 w-3.5 mr-1" />
                    Assign Task
                  </Button>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Invites Tab ──────────────────────────────────────────────────────────────

function InvitesTab({
  search,
  onInvite,
}: {
  search: string;
  onInvite: () => void;
}) {
  const { data: rawInvitations = [], isLoading } = trpc.invitations.list.useQuery();
  const invitations = rawInvitations as unknown as Invitation[];

  const filtered = useMemo(() => {
    if (!search) return invitations;
    const q = search.toLowerCase();
    return invitations.filter(
      (inv) => (inv.email ?? "").toLowerCase().includes(q)
    );
  }, [invitations, search]);

  const pending = filtered.filter((i) => i.status === "pending");
  const others = filtered.filter((i) => i.status !== "pending");

  if (isLoading) return <RowSkeleton count={3} />;

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No invitations yet"
        description="Invite colleagues, family, or friends to join you on Hilcot TaskFlow."
        action={
          <Button onClick={onInvite}>
            <Send className="h-4 w-4 mr-2" />
            Send an invitation
          </Button>
        }
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No invitations match"
        description="Try a different email address."
      />
    );
  }

  const InviteRow = ({ inv }: { inv: Invitation }) => {
    const meta = STATUS_META[inv.status] ?? STATUS_META.pending;
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{inv.email ?? inv.phone ?? "Unknown"}</p>
          <p className="text-xs text-muted-foreground">
            Sent {new Date(inv.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending</p>
          {pending.map((inv) => <InviteRow key={inv.id} inv={inv} />)}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Responded</p>
          {others.map((inv) => <InviteRow key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({
  contacts,
  isLoading,
}: {
  contacts: Contact[];
  isLoading: boolean;
}) {
  const { data: groups = [] } = trpc.groups.list.useQuery();
  const utils = trpc.useUtils();

  const [showCreate, setShowCreate] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | undefined>();

  // Derive category counts from contacts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // From groups
    (groups as Group[]).forEach((g) => { counts[g.name] = 0; });
    // From contact group memberships
    contacts.forEach((c) => {
      c.groups.forEach((g) => {
        counts[g] = (counts[g] ?? 0) + 1;
      });
    });
    return counts;
  }, [contacts, groups]);

  const deleteGroup = trpc.groups.delete.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      utils.directory.listContacts.invalidate();
      toast.success("Category deleted");
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    Family: <Heart className="h-4 w-4 text-rose-500" />,
    Friends: <Star className="h-4 w-4 text-amber-500" />,
    Business: <Briefcase className="h-4 w-4 text-blue-500" />,
    Assistants: <UserCog className="h-4 w-4 text-violet-500" />,
  };

  const allCategories = Object.keys(categoryCounts);

  if (isLoading) return <RowSkeleton count={4} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allCategories.length} categor{allCategories.length !== 1 ? "ies" : "y"}
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Category
        </Button>
      </div>

      {allCategories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No categories yet"
          description="Categories help you organise contacts into groups like Family, Business, or Assistants."
          action={
            <Button variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create a category
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allCategories.map((cat) => {
            const group = (groups as Group[]).find((g) => g.name === cat);
            const count = categoryCounts[cat] ?? 0;
            return (
              <div
                key={cat}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
              >
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {CATEGORY_ICONS[cat] ?? <Tag className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cat}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} contact{count !== 1 ? "s" : ""}
                  </p>
                </div>
                {group && !group.isDefault && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditGroup(group)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteGroup.mutate({ groupId: group.id })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Rename group modal */}
      <GroupModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editGroup && (
        <GroupModal open={true} onClose={() => setEditGroup(undefined)} existing={editGroup} />
      )}
    </div>
  );
}

// ─── Group Modal (used by Categories tab) ────────────────────────────────────

function GroupModal({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Group;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(existing?.name ?? "");

  const createGroup = trpc.groups.create.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      toast.success("Category created");
      onClose();
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const updateGroup = trpc.groups.update.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      utils.directory.listContacts.invalidate();
      toast.success("Category renamed");
      onClose();
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const handleSave = () => {
    if (!name.trim()) return;
    if (existing) {
      updateGroup.mutate({ groupId: existing.id, name: name.trim() });
    } else {
      createGroup.mutate({ name: name.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Rename Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || createGroup.isPending || updateGroup.isPending}
          >
            {existing ? "Rename" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Workspace Switcher ───────────────────────────────────────────────────────

function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSelect,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  onSelect: (ws: WorkspaceSummary | null) => void;
}) {
  if (workspaces.length === 0) return null;

  return (
    <Select
      value={activeWorkspace ? String(activeWorkspace.id) : "personal"}
      onValueChange={(v) => {
        if (v === "personal") {
          onSelect(null);
        } else {
          const ws = workspaces.find((w) => String(w.id) === v);
          if (ws) onSelect(ws);
        }
      }}
    >
      <SelectTrigger className="w-48 h-8 text-sm">
        <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="personal">Personal</SelectItem>
        <Separator className="my-1" />
        {workspaces.map((w) => (
          <SelectItem key={w.id} value={String(w.id)}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [showAddContact, setShowAddContact] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [search, setSearch] = useState("");
  const [profileContact, setProfileContact] = useState<ProfileContact | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const openProfile = (contact: ProfileContact) => {
    setProfileContact(contact);
    setProfileOpen(true);
  };

  const { data: contacts = [], isLoading: contactsLoading } = trpc.directory.listContacts.useQuery();
  const { data: groups = [] } = trpc.groups.list.useQuery();

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Directory</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your contacts, teams, and workspace members.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setShowAddContact(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Add Contact
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Invite
              </Button>
              <Button size="sm" onClick={() => setShowCreateWorkspace(true)}>
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Create Workspace
              </Button>
            </div>
          </div>

          {/* Search + workspace switcher row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onSelect={setActiveWorkspace}
            />
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="contacts" className="flex-1 flex flex-col">
          <TabsList className="mb-4 w-fit">
            <TabsTrigger value="contacts">
              Contacts
              {(contacts as Contact[]).length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">
                  {(contacts as Contact[]).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="invites">Invites</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="flex-1 mt-0">
            <ContactsTab
              contacts={contacts as Contact[]}
              isLoading={contactsLoading}
              search={search}
              onAddContact={() => setShowAddContact(true)}
              onOpenProfile={(c: Contact) => openProfile({
                userId: c.contactId,
                name: c.name,
                email: c.email,
                nickname: c.nickname,
                isInDirectory: true,
              })}
            />
          </TabsContent>

          <TabsContent value="workspace" className="flex-1 mt-0">
            <WorkspaceTab
              activeWorkspace={activeWorkspace}
              search={search}
              onCreateWorkspace={() => setShowCreateWorkspace(true)}
              onInvite={() => setShowInvite(true)}
              onOpenProfile={(m: WorkspaceMember) => openProfile({
                userId: m.userId,
                name: m.name,
                email: m.email,
                workspaceRole: m.role,
              })}
            />
          </TabsContent>

          <TabsContent value="invites" className="flex-1 mt-0">
            <InvitesTab
              search={search}
              onInvite={() => setShowInvite(true)}
            />
          </TabsContent>

          <TabsContent value="categories" className="flex-1 mt-0">
            <CategoriesTab
              contacts={contacts as Contact[]}
              isLoading={contactsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modals ── */}
      <AddContactModal open={showAddContact} onClose={() => setShowAddContact(false)} />
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        groups={groups as Group[]}
        activeWorkspace={activeWorkspace}
      />
      <CreateWorkspaceModal
        open={showCreateWorkspace}
        onClose={() => setShowCreateWorkspace(false)}
      />
      <ProfileDrawer
        contact={profileContact}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onRemoveContact={() => {
          // Invalidation handled inside ContactsTab via its own mutation
        }}
      />
    </DashboardLayout>
  );
}
