import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset="calc(env(safe-area-inset-top, 0px) + 16px)"
      mobileOffset="calc(env(safe-area-inset-top, 0px) + 16px)"
      toastOptions={{
        classNames: {
          toast: "bg-card border border-border rounded-2xl shadow-[var(--shadow-card-lg)] text-foreground",
          title: "text-[14px] font-semibold text-foreground",
          description: "text-[13px] text-muted-foreground",
          success: "border-emerald-200 dark:border-emerald-800",
          error: "border-destructive/30",
          actionButton: "bg-primary text-primary-foreground text-xs font-semibold rounded-lg px-3 py-1",
          cancelButton: "bg-muted text-muted-foreground text-xs rounded-lg px-3 py-1",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
