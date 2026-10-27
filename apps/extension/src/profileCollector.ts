import type { ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"

/**
 * Kullanıcının açtığı LinkedIn profil sayfasında çalışır ve yalnızca görünen
 * satırları toplar (DOG-157, spec §5.2). Kendi kendine yeterli olmalı: Chrome bu
 * fonksiyonun kaynağını sayfaya kopyalıyor, kapanış ve içe aktarma taşınmıyor.
 *
 * Ekim 2026'daki sayfa ("sdui" kartları): sınıf adları karışık, `li` ve
 * `aria-hidden` satırlar yok. Dile bağlı olmayan işaretler kullanılıyor:
 *   - Kartlar: `id` "com.linkedin.sdui.profile.card…" ile başlayıp türüyle
 *     bitiyor (Topcard, About, ExperienceTopLevelSection, …).
 *   - Öğeler: içinde satır (`p`) olan en dıştaki `componentkey` blokları.
 *   - Kendi profili: düzenleme bağlantıları (`/edit/intro/`, `/edit/forms/`).
 * Gerçek sayfadan anonim örnek: src/fixtures/linkedin-own-profile.html.
 */
export function collectProfileSnapshot(): ProfileSnapshot {
  const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim()
  // Görünen metin: "… daha fazla" düğmesi aria-hidden, atlanıyor; <br> satır sonu.
  const textOf = (el: Element): string => {
    let out = ""
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) out += node.textContent ?? ""
      else if (node.nodeType === 1) {
        const child = node as Element
        if (child.tagName === "BR") out += "\n"
        else if (child.getAttribute("aria-hidden") !== "true") out += textOf(child)
      }
    }
    return out
  }
  const linesOf = (el: Element) => textOf(el).split("\n").map(clean).filter(Boolean)
  const main = document.querySelector("main") ?? document.body
  const card = (kind: string) => main.querySelector(`[id^="com.linkedin.sdui.profile.card"][id$="${kind}"]`)
  const own = !!main.querySelector('a[href*="/edit/intro/"], a[href*="/edit/forms/"]')
  const DATE = /\b(19|20)\d{2}\b/

  // İçinde satır olan en dıştaki componentkey blokları; bölüm başlığını (h2) taşıyan sarmalayıcı öğe değil.
  const blocks = (root: Element): Element[] => {
    const isBlock = (el: Element) => el !== root && el.hasAttribute("componentkey") && !!el.querySelector("p") && !el.querySelector("h2")
    return Array.from(root.querySelectorAll("[componentkey]")).filter((el) => {
      if (!isBlock(el)) return false
      for (let up = el.parentElement; up && up !== root; up = up.parentElement) if (isBlock(up)) return false
      return true
    })
  }
  const pLines = (el: Element) => Array.from(el.querySelectorAll("p")).flatMap(linesOf)

  const items = (kind: string) => {
    const root = card(kind)
    const heading = root?.querySelector("h2")
    if (!root || !heading) return undefined
    const out: string[][] = []
    for (const block of blocks(root)) {
      // Aynı şirkette birden çok rol: iç bloklar, her birinin ilk satırlarında tarih varsa.
      const inner = blocks(block)
      if (inner.length > 1 && inner.every((b) => pLines(b).slice(0, 4).some((l) => DATE.test(l)))) {
        const company = linesOf(block.querySelector("p")!)[0] ?? ""
        for (const role of inner) {
          const lines = pLines(role)
          out.push([lines[0] ?? "", company, ...lines.slice(1)])
        }
      } else {
        const lines = pLines(block)
        if (lines.length > 0) out.push(lines)
      }
    }
    // Toplam: başlıkta ("Yetenekler (25)") ya da bölümün "tamamını göster" bağlantısında
    // (/details/<bölüm>/); öğelerin kendi bağlantıları daha derin ve satırlarındaki yıl sayı sanılmasın.
    const showAll = Array.from(root.querySelectorAll('a[href*="/details/"]')).filter((a) => /\/details\/[^/]+\/?$/.test((a.getAttribute("href") ?? "").split("?")[0]!))
    const counted = [clean(heading.textContent), ...showAll.map((a) => clean(a.textContent))]
    return { items: out, showAllText: counted.find((t) => /\d/.test(t)) ?? null }
  }

  const top = card("Topcard")
  const nameHeading = top?.querySelector("h2") ?? null
  const headline = nameHeading ? Array.from(top!.querySelectorAll("p")).find((p) => nameHeading.compareDocumentPosition(p) & 4) : undefined
  const aboutCard = card("About")
  const aboutBox = aboutCard?.querySelector('[data-testid="expandable-text-box"]') ?? null
  return {
    url: location.href,
    own,
    name: clean(nameHeading?.textContent) || null,
    headline: headline ? clean(textOf(headline)) || null : null,
    about: aboutBox ? linesOf(aboutBox).join("\n") || null : null,
    sections: {
      experience: items("ExperienceTopLevelSection"),
      education: items("EducationTopLevelSection"),
      certifications: items("CertificationTopLevel"),
      skills: items("Skills"),
      languages: items("LanguageTopLevel"),
    },
  }
}
