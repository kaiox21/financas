"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMonthShort } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { MonthPoint } from "@/lib/monthly-series";

/**
 * Verde/vermelho é a convenção de finanças e, nestes tons, passa nos testes de
 * daltonismo: pior par a ΔE 8.6 em deuteranopia e 32.0 em visão normal.
 */
const INCOME = "#059669";
const EXPENSE = "#dc2626";

/**
 * Rótulo do eixo em uma linha só. Com "R$" e duas casas ele quebrava em duas
 * linhas e era cortado na borda; a unidade já está no título e no tooltip.
 */
function axisTick(value: number): string {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    const label = Number.isInteger(thousands)
      ? String(thousands)
      : thousands.toFixed(1).replace(".", ",");
    return `${label} mil`;
  }
  return String(Math.round(value));
}

export function IncomeExpenseChart({ data }: { data: MonthPoint[] }) {
  const rows = data.map((point) => ({
    month: formatMonthShort(point.month),
    Entrou: point.incomeCents / 100,
    Saiu: point.expenseCents / 100,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          {/* Grade só horizontal e sólida: linha tracejada lê como projeção. */}
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={axisTick}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
            formatter={(value) => formatBRL(Number(value) * 100)}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-popover)",
              color: "var(--color-popover-foreground)",
              fontSize: 12,
            }}
          />
          {/* O texto da legenda usa tinta de texto; quem carrega a identidade
              é o ponto colorido ao lado. */}
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
            formatter={(value: string) => (
              <span className="text-muted-foreground">{value}</span>
            )}
          />
          {/* Topo arredondado em 4px, ancorado na base. */}
          <Bar dataKey="Entrou" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Saiu" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
