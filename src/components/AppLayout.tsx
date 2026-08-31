import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Outlet } from "react-router-dom";
import { AenderungswunschKnopf } from "@/components/aenderungswunsch/AenderungswunschKnopf";

export function AppLayout() {
  const isMobile = useIsMobile();

  // Mobile: no sidebar, render pages directly as before
  if (isMobile) {
    return (
      <>
        <Outlet />
        {/* Für Seiten ohne eigene Kopfzeile — blendet sich selbst aus,
            sobald ein [data-seitenkopf] auf der Seite steht. */}
        <AenderungswunschKnopf gestalt="schwebend" />
      </>
    );
  }

  // Desktop: sidebar + content area
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
        <AenderungswunschKnopf gestalt="schwebend" />
      </SidebarInset>
    </SidebarProvider>
  );
}
