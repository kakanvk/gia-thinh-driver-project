"use client"

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  enrollmentFunnel,
  monthlyRevenue,
  passRateByClass,
  revenueByClass,
  studentSources,
  weeklyRegistrations,
} from "@/lib/admin-data"

const numberFormatter = new Intl.NumberFormat("vi-VN")

const revenueClassColors: Record<string, string> = {
  "hang-b": "var(--chart-1)",
  "hang-c1": "var(--chart-3)",
  "hang-a": "var(--chart-2)",
  "hang-a1": "var(--chart-4)",
}

const revenueTrendConfig = {
  actual: { label: "Doanh thu", color: "var(--chart-1)" },
  target: { label: "Mục tiêu", color: "var(--chart-3)" },
} satisfies ChartConfig

const revenueByClassConfig = {
  revenue: { label: "Doanh thu" },
  "hang-b": { label: "Hạng B", color: revenueClassColors["hang-b"] },
  "hang-c1": { label: "Hạng C1", color: revenueClassColors["hang-c1"] },
  "hang-a": { label: "Hạng A", color: revenueClassColors["hang-a"] },
  "hang-a1": { label: "Hạng A1", color: revenueClassColors["hang-a1"] },
} satisfies ChartConfig

const funnelConfig = {
  count: { label: "Hồ sơ", color: "var(--chart-1)" },
} satisfies ChartConfig

const sourceConfig = {
  count: { label: "Học viên", color: "var(--chart-1)" },
} satisfies ChartConfig

const passRateConfig = {
  rate: { label: "Tỷ lệ đỗ", color: "var(--chart-1)" },
} satisfies ChartConfig

const weeklyConfig = {
  value: { label: "Hồ sơ", color: "var(--chart-1)" },
} satisfies ChartConfig

export function RevenueTrendChart() {
  return (
    <ChartContainer
      config={revenueTrendConfig}
      className="aspect-auto min-h-64 w-full flex-1"
    >
      <ComposedChart
        data={monthlyRevenue}
        margin={{ left: 0, right: 8, top: 8 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          width={48}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tickFormatter={(value) => numberFormatter.format(Number(value))}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="actual"
          type="monotone"
          fill="var(--color-actual)"
          fillOpacity={0.18}
          stroke="var(--color-actual)"
          strokeWidth={2}
        />
        <Line
          dataKey="target"
          type="monotone"
          stroke="var(--color-target)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

export function RevenueByClassChart() {
  const slices = revenueByClass.map((item) => ({
    ...item,
    fill: revenueClassColors[item.key],
  }))
  const totalRevenue = revenueByClass.reduce(
    (total, item) => total + item.revenue,
    0
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <ChartContainer
          config={revenueByClassConfig}
          className="mx-auto h-44 w-full"
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="key" hideLabel />}
            />
            <Pie
              data={slices}
              dataKey="revenue"
              nameKey="key"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              strokeWidth={2}
            >
              {slices.map((item) => (
                <Cell key={item.key} fill={item.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-lg font-bold tracking-tight text-navy">
              {numberFormatter.format(Math.round(totalRevenue / 100) / 10)} tỷ
            </p>
            <p className="text-[11px] text-muted-foreground">12 tháng</p>
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {slices.map((item) => (
          <li key={item.key} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.fill }}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
              {item.label}
            </span>
            <span className="text-[13px] font-semibold text-navy tabular-nums">
              {numberFormatter.format(item.revenue)}
            </span>
            <span className="w-11 text-right text-[11px] text-muted-foreground tabular-nums">
              {item.share.toString().replace(".", ",")}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EnrollmentFunnelChart() {
  return (
    <ChartContainer config={funnelConfig} className="h-60 w-full">
      <BarChart
        layout="vertical"
        data={enrollmentFunnel}
        margin={{ left: 0, right: 44, top: 4 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="stage"
          type="category"
          width={112}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          interval={0}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={18}>
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground"
            fontSize={11}
            formatter={(value: unknown) =>
              numberFormatter.format(Number(value))
            }
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function StudentSourceChart() {
  return (
    <ChartContainer config={sourceConfig} className="h-60 w-full">
      <BarChart
        layout="vertical"
        data={studentSources}
        margin={{ left: 0, right: 40, top: 4 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="source"
          type="category"
          width={116}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          interval={0}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={18}>
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground"
            fontSize={11}
            formatter={(value: unknown) =>
              numberFormatter.format(Number(value))
            }
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function PassRateChart() {
  return (
    <ChartContainer
      config={passRateConfig}
      className="aspect-auto min-h-60 w-full flex-1"
    >
      <BarChart data={passRateByClass} margin={{ left: 0, right: 8, top: 20 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="licenseClass"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          domain={[80, 100]}
          width={40}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <ReferenceLine y={96} stroke="var(--chart-3)" strokeDasharray="4 4" />
        <Bar dataKey="rate" fill="var(--color-rate)" radius={4} barSize={44}>
          <LabelList
            dataKey="rate"
            position="top"
            className="fill-foreground"
            fontSize={11}
            formatter={(value: unknown) => `${Number(value)}%`}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function WeeklyRegistrationChart() {
  return (
    <ChartContainer
      config={weeklyConfig}
      className="aspect-auto min-h-56 w-full flex-1"
    >
      <BarChart
        data={weeklyRegistrations}
        margin={{ left: 0, right: 8, top: 8 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis width={32} tickLine={false} axisLine={false} tickMargin={4} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={4}
          barSize={40}
        />
      </BarChart>
    </ChartContainer>
  )
}
