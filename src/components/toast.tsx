import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastData {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

const Ctx = createContext<(text: string, action?: ToastData['action']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((text: string, action?: ToastData['action']) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, text, action });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), action ? 5000 : 2500);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span className="grow">{toast.text}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
