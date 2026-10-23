import type { ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"

/**
 * Kullanıcının açtığı LinkedIn profil sayfasında çalışır ve yalnızca görünen
 * satırları toplar (DOG-157, spec §5.2). Kendi kendine yeterli olmalı: Chrome bu
 * fonksiyonun kaynağını sayfaya kopyalıyor, kapanış ve içe aktarma taşınmıyor.
 *
 * LinkedIn görünen metni `span[aria-hidden="true"]` içinde, ekran okuyucu
 * kopyasını ayrı bir gizli span'da tutuyor; ikincisi atlanıyor. Bölümler
 * `id`'li bir işaretin bulunduğu `<section>`'lar: about, experience, education,
 * licenses_and_certifications, skills, languages.
 */
export function collectProfileSnapshot(): ProfileSnapshot {
  const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim()
  const visible = (root: Element) =>
    Array.from(root.querySelectorAll('span[aria-hidden="true"]'))
      .map((s) => clean(s.textContent))
      .filter(Boolean)
  const section = (id: string) => document.getElementById(id)?.closest("section") ?? null
  const own = Array.from(document.querySelectorAll("main button, main a")).some((el) => /^(Profil bölümü ekle|Add profile section)$/i.test(clean(el.textContent)))

  const items = (id: string) => {
    const root = section(id)
    if (!root) return undefined
    const list = root.querySelector("ul")
    const out: string[][] = []
    for (const li of Array.from(list?.children ?? [])) {
      const nested = li.querySelector("ul")
      const nestedItems = nested ? Array.from(nested.children).filter((c) => c.tagName === "LI" && visible(c).length > 0) : []
      if (nestedItems.length > 1) {
        // Aynı şirkette birden çok rol: şirket adı her rolün ikinci satırı.
        const company = visible(li)[0] ?? ""
        for (const role of nestedItems) {
          const lines = visible(role)
          out.push([lines[0] ?? "", company, ...lines.slice(1)])
        }
      } else {
        const lines = visible(li)
        if (lines.length > 0) out.push(lines)
      }
    }
    const showAll =
      Array.from(root.querySelectorAll('a[href*="/details/"]'))
        .map((a) => clean(a.textContent))
        .find(Boolean) ?? null
    return { items: out, showAllText: showAll }
  }

  const about = section("about")
  return {
    url: location.href,
    own,
    name: clean(document.querySelector("main h1")?.textContent) || null,
    headline: clean(document.querySelector("main .text-body-medium")?.textContent) || null,
    // İlk görünen satır bölüm başlığı ("Hakkında" / "About").
    about: about ? visible(about).slice(1).join("\n") || null : null,
    sections: {
      experience: items("experience"),
      education: items("education"),
      certifications: items("licenses_and_certifications"),
      skills: items("skills"),
      languages: items("languages"),
    },
  }
}
