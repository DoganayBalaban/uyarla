/**
 * Simge menüsünün ne göstereceği (DOG-169). Saf: menü açık sekmeyi okuyup
 * bu fonksiyona veriyor. Simgeye basmak önceden doğrudan gönderiyordu;
 * kullanıcı ne olacağını görmüyordu.
 */
export interface PopupState {
  /** Sekmede betik çalışabiliyor mu (chrome://, Web Mağazası çalışmaz). */
  scriptable: boolean
  posting: { position: string | null; company: string | null } | null
  /** LinkedIn profil sayfasıysa kendi profili mi. */
  profile: { own: boolean } | null
}

export interface PopupView {
  title: string
  detail: string | null
  action: "posting" | "profile" | null
  actionLabel: string | null
  hint: string | null
}

export const SHORTCUTS = [
  { label: "Yeni analiz", path: "/analyze" },
  { label: "Başvurularım", path: "/applications" },
  { label: "CV'lerim", path: "/cvs" },
  { label: "LinkedIn denetimi", path: "/linkedin" },
] as const

const SELECT_HINT = "İlan metnini seçip sağ tıkla, \"Seçili metni uyarla ile ölç\" de."

export function popupView(state: PopupState): PopupView {
  if (!state.scriptable) {
    return { title: "Bu sayfada çalışamıyoruz", detail: null, action: null, actionLabel: null, hint: "Eklenti bu sayfada çalışmıyor (tarayıcının kendi sayfaları gibi). Bir ilan sayfası aç." }
  }
  if (state.posting) {
    const detail = [state.posting.position, state.posting.company].filter(Boolean).join(" · ") || null
    return { title: "Bu ilanı ölç", detail, action: "posting", actionLabel: "CV'mi bu ilana uyarla", hint: "uyarla yeni sekmede açılır; ilan metni hazır gelir." }
  }
  if (state.profile?.own) {
    return { title: "LinkedIn profilin", detail: null, action: "profile", actionLabel: "Profilimi denetle", hint: "Başlık, hakkında, deneyim ve becerilerin bölüm bölüm denetlenir." }
  }
  if (state.profile) {
    return { title: "LinkedIn profili", detail: null, action: null, actionLabel: null, hint: "Yalnızca kendi profilini denetleyebilirsin; kendi profil sayfanı aç." }
  }
  return { title: "Bu sayfada ilan bulamadık", detail: null, action: null, actionLabel: null, hint: SELECT_HINT }
}
