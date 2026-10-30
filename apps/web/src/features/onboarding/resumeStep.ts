/**
 * Kurulumun CV adımındaki metin. Kayıtsız analizdeki CV kayıtta kütüphaneye
 * giriyor (DOG-166); kayıtlıysa aynı CV yeniden istenmiyor, başka bir CV
 * eklemek isteğe bağlı kalıyor.
 */
export function resumeStepCopy(saved: { label: string | null; fileName: string | null } | null): {
  title: string
  description: string
  skipLabel: string
} {
  if (!saved) {
    return {
      title: "CV'ni bir kez yükle",
      description: "Her ilanda yeniden yüklemek yerine kayıtlı CV'ni seçersin. İsteğe bağlı.",
      skipLabel: "Sonra eklerim",
    }
  }
  return {
    title: "CV'n kayıtlı",
    description: `Analiz ettiğin CV (${saved.label || saved.fileName || "CV"}) CV'lerim'de. Başka bir CV eklemek istersen yükleyebilirsin.`,
    skipLabel: "Atla",
  }
}
