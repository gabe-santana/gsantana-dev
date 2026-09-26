import { NotFoundScreen } from "@/components/not-found-screen";

// Inside [lang], <html lang> is already set by the layout, so the shared
// screen's bilingual copy resolves to the right language by itself.
export default function NotFound() {
  return <NotFoundScreen />;
}
