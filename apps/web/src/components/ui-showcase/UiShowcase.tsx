"use client"

import { useTheme } from "next-themes"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { MoreHorizontal, Plus } from "lucide-react"
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const chartData = [
  { day: "1 Eki", analyses: 2, score: 28 },
  { day: "5 Eki", analyses: 4, score: 31 },
  { day: "9 Eki", analyses: 3, score: 35 },
  { day: "13 Eki", analyses: 6, score: 38 },
  { day: "17 Eki", analyses: 5, score: 41 },
  { day: "21 Eki", analyses: 8, score: 44 },
]
const chartConfig = {
  analyses: { label: "Analiz", color: "var(--chart-1)" },
  score: { label: "Ortalama skor", color: "var(--chart-2)" },
} satisfies ChartConfig

/** Vitrin (DOG-143): kabuk ve sayfalar bu parçalarla kurulacak. */
export function UiShowcase() {
  const { theme, setTheme } = useTheme()
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-3xl">Bileşenler</h1>
          <p className="m-0 mt-1 text-muted-foreground">shadcn/ui, marka temasıyla. Yalnızca yerelde.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Label htmlFor="dark">Koyu tema</Label>
          <Switch id="dark" checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
        </div>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Analiz", value: 34, note: "Son 30 günde 8 yeni" },
          { label: "Başvuru", value: 12, note: "3'ü bu hafta" },
          { label: "Mülakat", value: 3, note: "Biri yarın" },
          { label: "Ortalama skor", value: 41, note: "Geçen aya göre +6" },
        ].map((k) => (
          <StaggerItem key={k.label}>
            <Card>
              <CardHeader>
                <CardDescription>{k.label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  <CountUp value={k.value} />
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">+12%</Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="text-sm text-muted-foreground">{k.note}</CardFooter>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle>Analizler ve ortalama skor</CardTitle>
            <CardDescription>Son 3 hafta</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
              <AreaChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="analyses" type="monotone" fill="var(--color-analyses)" fillOpacity={0.2} stroke="var(--color-analyses)" />
                <Area dataKey="score" type="monotone" fill="var(--color-score)" fillOpacity={0.1} stroke="var(--color-score)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Düğmeler ve rozetler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button>
              <Plus /> Yeni analiz
            </Button>
            <Button variant="secondary">İkincil</Button>
            <Button variant="outline">Çerçeveli</Button>
            <Button variant="ghost">Hayalet</Button>
            <Button variant="destructive">Sil</Button>
            <Badge>Yüksek uyum</Badge>
            <Badge variant="secondary">Orta</Badge>
            <Badge variant="outline">Skora katılmıyor</Badge>
            <Badge variant="destructive">Eksik</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="role">Hedef rol</Label>
              <Input id="role" placeholder="Frontend geliştirici" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="news" />
              <Label htmlFor="news">Ürün haberlerini istiyorum</Label>
            </div>
            <Progress value={62} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sekmeler, menü, diyalog, tooltip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="report">
            <TabsList>
              <TabsTrigger value="report">Rapor</TabsTrigger>
              <TabsTrigger value="posting">İlan metni</TabsTrigger>
            </TabsList>
            <TabsContent value="report" className="text-sm text-muted-foreground">
              Rapor içeriği
            </TabsContent>
            <TabsContent value="posting" className="text-sm text-muted-foreground">
              İlan metni
            </TabsContent>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Madde işlemleri">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Madde</DropdownMenuLabel>
                <DropdownMenuItem>Yukarı taşı</DropdownMenuItem>
                <DropdownMenuItem>Başka işe taşı</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">Kaldır</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Bölüm ekle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bölüm ekle</DialogTitle>
                  <DialogDescription>Belgede diğer bölümlerin sonunda yer alır.</DialogDescription>
                </DialogHeader>
                <Input placeholder="Gönüllü çalışmalar" />
                <DialogFooter>
                  <Button>Ekle</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>Skoru belirler</TooltipContent>
            </Tooltip>
            <Button variant="secondary" onClick={() => toast.success("Kaydedildi")}>
              Bildirim
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tablo ve yükleniyor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pozisyon</TableHead>
                <TableHead>Şirket</TableHead>
                <TableHead className="text-right">Skor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Dijital Pazarlama Uzmanı</TableCell>
                <TableCell>Moda Sepeti</TableCell>
                <TableCell className="text-right tabular-nums">34</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">AI Engineer</TableCell>
                <TableCell>Hilbert</TableCell>
                <TableCell className="text-right tabular-nums">58</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
