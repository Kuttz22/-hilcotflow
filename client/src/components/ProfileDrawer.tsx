import React from "react";

export type ProfileContact = {
  id?: number | string | null;
  name?: string | null;
  email?: string | null;
};

type ProfileDrawerProps = {
  contact?: ProfileContact | null;
  open?: boolean;
  onClose?: () => void;
  onRemoveContact?: () => void;
};

export function ProfileDrawer({ open }: ProfileDrawerProps) {
  if (!open) return null;
  return null;
}

export default ProfileDrawer;
