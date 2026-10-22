import {
  FileSearch,
  FileText,
  IdCard,
  LayoutDashboard,
  SquareKanban,
  MessagesSquare,
  Search,
  type LucideIcon,
} from "lucide-react"

/**
 * Uygulama kabuğunun gezinmesi (DOG-144). Her özellik kendi sayfasında,
 * kenar çubuğundan tek tıkla. Saf modül: etkin öge ve konum yolu testli.
 */
export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Kayıt gerektiriyor; anonim kullanıcıda kilitli görünüyor. */
  registered: boolean
}

export const NEW_ANALYSIS: NavItem = { href: "/analyze", label: "Yeni analiz", icon: FileSearch, registered: false }

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Çalışma alanı",
    items: [
      { href: "/dashboard", label: "Genel bakış", icon: LayoutDashboard, registered: true },
      { href: "/applications", label: "Başvurular", icon: SquareKanban, registered: true },
    ],
  },
  {
    label: "Araçlar",
    items: [
      { href: "/cvs", label: "CV'lerim", icon: FileText, registered: true },
      { href: "/jobs", label: "İş ara", icon: Search, registered: true },
      { href: "/linkedin", label: "LinkedIn", icon: IdCard, registered: true },
      { href: "/interviews", label: "Mülakatlar", icon: MessagesSquare, registered: true },
    ],
  },
]

/** Öge etkin mi: kendi sayfası ya da alt sayfası. Mülakat hazırlığı Mülakatlar'a ait. */
export function isActive(path: string, href: string): boolean {
  if (href === "/interviews" && /^\/applications\/[^/]+\/interview/.test(path)) return true
  if (href === "/applications" && /^\/applications\/[^/]+\/interview/.test(path)) return false
  return path === href || path.startsWith(`${href}/`)
}

export interface Crumb {
  label: string
  href?: string
}

const TOP: Record<string, string> = {
  "/dashboard": "Genel bakış",
  "/analyze": "Yeni analiz",
  "/applications": "Başvurular",
  "/cvs": "CV'lerim",
  "/jobs": "İş ara",
  "/linkedin": "LinkedIn",
  "/interviews": "Mülakatlar",
  "/account": "Hesabım",
  "/plans": "Paketler",
  "/admin": "Yönetim",
  "/sample-report": "Örnek rapor",
  "/get-started": "Nereden başlamalıyım?",
}

/** Üst çubuktaki konum yolu; son öge bağlantısız. */
export function breadcrumbs(path: string, search: URLSearchParams | null = null): Crumb[] {
  // Sonucun kalıcı adresi `/analyze?analiz=<id>` (K3).
  if (path === "/analyze" && search?.has("analiz")) return [{ label: "Analiz sonucu" }]
  if (/^\/applications\/[^/]+\/interview/.test(path)) {
    return [{ label: "Mülakatlar", href: "/interviews" }, { label: "Hazırlık" }]
  }
  if (/^\/applications\/[^/]+/.test(path)) return [{ label: "Başvurular", href: "/applications" }, { label: "Başvuru" }]
  if (/^\/adapt\/[^/]+/.test(path)) return [{ label: "Uyarlama" }]
  if (path.startsWith("/plans/thanks")) return [{ label: "Paketler", href: "/plans" }, { label: "Teşekkürler" }]
  const top = TOP[path]
  return top ? [{ label: top }] : []
}
