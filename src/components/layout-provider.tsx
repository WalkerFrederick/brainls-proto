"use client";

import { createContext, useContext, useState, useCallback } from "react";

type LayoutPrefs = {
  constrained: boolean;
  setConstrained: (v: boolean) => void;
  aiPaneOpen: boolean;
  setAiPaneOpen: (v: boolean) => void;
};

const LayoutContext = createContext<LayoutPrefs>({
  constrained: true,
  setConstrained: () => {},
  aiPaneOpen: false,
  setAiPaneOpen: () => {},
});

export function useLayoutPrefs() {
  return useContext(LayoutContext);
}

export function LayoutProvider({
  initialConstrained,
  children,
}: {
  initialConstrained: boolean;
  children: React.ReactNode;
}) {
  const [constrained, setRaw] = useState(initialConstrained);
  const [aiPaneOpen, setAiPaneOpen] = useState(false);

  const setConstrained = useCallback((v: boolean) => {
    setRaw(v);
    document.cookie = `layout_constrained=${v ? "1" : "0"};path=/;max-age=31536000`;
  }, []);

  return (
    <LayoutContext value={{ constrained, setConstrained, aiPaneOpen, setAiPaneOpen }}>
      {children}
    </LayoutContext>
  );
}
