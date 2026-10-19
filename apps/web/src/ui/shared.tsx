import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import "./shared.css";
export function FlowDropLoader({
  variant = "button",
}: {
  variant?: "button" | "modal" | "section" | "page";
}) {
  return (
    <svg
      className={`flowdrop-loader loader-${variant}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path
        className="loader-drop"
        d="M20 3C16 10 7 17 7 25a13 13 0 0026 0C33 17 24 10 20 3Z"
      />
      <path className="loader-arrow" d="M20 15v16m-6-6 6 6 6-6" />
    </svg>
  );
}
export function LoadingButton({
  pending,
  loadingText,
  children,
  disabled,
  onClick,
  loaderVariant = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  loadingText?: string;
  loaderVariant?: "button" | "modal";
}) {
  const [automatic, setAutomatic] = useState(false);
  const [failure, setFailure] = useState("");
  const guard = useRef(false);
  const waiting = pending || automatic;
  return (
    <>
      <button
        {...props}
        disabled={disabled || waiting}
        aria-busy={waiting || undefined}
        onClick={(event) => {
          if (guard.current || waiting || disabled) return;
          guard.current = true;
          setFailure("");
          try {
            const outcome: unknown = onClick?.(event);
            if (outcome instanceof Promise) {
              setAutomatic(true);
              void outcome
                .catch((error) =>
                  setFailure(
                    error instanceof Error
                      ? error.message
                      : "Action failed. Please retry.",
                  ),
                )
                .finally(() => {
                  guard.current = false;
                  setAutomatic(false);
                });
            } else guard.current = false;
          } catch (error) {
            guard.current = false;
            setFailure(
              error instanceof Error
                ? error.message
                : "Action failed. Please retry.",
            );
          }
        }}
      >
        {waiting && <FlowDropLoader variant={loaderVariant} />}
        {waiting ? loadingText || children : children}
      </button>
      {failure && <span role="alert">{failure}</span>}
    </>
  );
}
export function SectionLoader({
  children,
  variant = "section",
}: {
  children: ReactNode;
  variant?: "section" | "page";
}) {
  return (
    <div className="shared-loading" role="status">
      <FlowDropLoader variant={variant} />
      <span>{children}</span>
    </div>
  );
}
export function BackNavigation({
  onBack,
  label = "Back to Home",
}: {
  onBack: () => void;
  label?: string;
}) {
  return (
    <button
      className="quiet workspace-back"
      aria-label={label}
      onClick={onBack}
    >
      ← {label === "Back to Home" ? "Back" : label}
    </button>
  );
}
export function InformationalModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    if (open) dialog.showModal();
    else dialog.close();
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="invitation-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={id}>{title}</h2>
      {children}
      <button onClick={onClose} autoFocus>
        Close
      </button>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  loadingText,
  pending,
  error,
  onCancel,
  onConfirm,
  icon,
  destructive,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  loadingText: string;
  pending?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
  icon?: ReactNode;
  destructive?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const focus = document.activeElement;
    if (open) dialog.showModal();
    else dialog.close();
    return () => {
      dialog.close();
      if (focus instanceof HTMLElement && focus.isConnected) focus.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="invitation-dialog shared-confirm"
      aria-labelledby={id}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      {icon && <div className="dialog-symbol">{icon}</div>}
      <h2 id={id}>{title}</h2>
      <p id={`${id}-description`}>{description}</p>
      {error && (
        <p role="alert" className="dialog-error">
          {error}
        </p>
      )}
      <div className="room-actions">
        <button
          className="secondary"
          autoFocus
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
        <LoadingButton
          loaderVariant="modal"
          className={destructive ? "destructive" : undefined}
          pending={pending}
          loadingText={loadingText}
          onClick={onConfirm}
        >
          {confirmText}
        </LoadingButton>
      </div>
    </dialog>
  );
}
