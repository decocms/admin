import { createContext, type ReactNode, useRef, useState } from "react";
import { ProfileSettings } from "./settings/profile.tsx";

// Context for profile modal
interface ProfileModalContextType {
  openProfileModal: (onPhoneSaved?: () => void) => void;
  closeProfileModal: () => void;
}

const ProfileModalContext = createContext<ProfileModalContextType | undefined>(
  undefined,
);

export function useProfileModal() {
  const [profileOpen, setProfileOpen] = useState(false);
  const pendingProfileAction = useRef<(() => void) | null>(null);

  function openProfileModal(onPhoneSaved?: () => void) {
    if (onPhoneSaved) pendingProfileAction.current = onPhoneSaved;
    setProfileOpen(true);
  }

  function closeProfileModal() {
    setProfileOpen(false);
    pendingProfileAction.current = null;
  }

  function handlePhoneSaved() {
    if (pendingProfileAction.current) {
      pendingProfileAction.current();
      pendingProfileAction.current = null;
    }
    setProfileOpen(false);
  }

  return {
    profileOpen,
    setProfileOpen,
    openProfileModal,
    closeProfileModal,
    handlePhoneSaved,
  };
}

export function ProfileModalProvider({
  children,
  profileOpen,
  setProfileOpen,
  openProfileModal,
  closeProfileModal,
  handlePhoneSaved,
}: {
  children: ReactNode;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  openProfileModal: (onPhoneSaved?: () => void) => void;
  closeProfileModal: () => void;
  handlePhoneSaved: () => void;
}) {
  return (
    <ProfileModalContext.Provider
      value={{ openProfileModal, closeProfileModal }}
    >
      {children}
      <ProfileSettings
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onPhoneSaved={handlePhoneSaved}
      />
    </ProfileModalContext.Provider>
  );
}
