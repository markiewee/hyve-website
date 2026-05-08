// Imperative confirm() backed by shadcn AlertDialog. Drop-in replacement
// for window.confirm() that returns a Promise<boolean>.
//
// Usage:
//   import { confirm } from '@/lib/confirm';
//   if (!await confirm({ title: 'Delete?', description: 'Cannot be undone.' })) return;
//
// Render <ConfirmHost /> once near app root.

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

let listener = null;
let counter = 0;

export function confirm({
  title = "Are you sure?",
  description = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
} = {}) {
  return new Promise((resolve) => {
    if (!listener) {
      // No host mounted — fall back to native confirm so callers never hang.
      console.warn("ConfirmHost not mounted; falling back to window.confirm");
      resolve(window.confirm(title));
      return;
    }
    listener({
      id: ++counter,
      title,
      description,
      confirmLabel,
      cancelLabel,
      destructive,
      resolve,
    });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    listener = setPending;
    return () => {
      listener = null;
    };
  }, []);

  const close = (result) => {
    pending?.resolve(result);
    setPending(null);
  };

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          {pending?.description && (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={
              pending?.destructive
                ? "bg-[#FF3B3B] hover:bg-[#FF3B3B]/90 text-white"
                : "bg-[#006b5f] hover:bg-[#006b5f]/90 text-white"
            }
          >
            {pending?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
