"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/payment-methods";
import type { PaymentMethod } from "@/types/database";

export default function PreviewPage() {
  const [method, setMethod] = useState<PaymentMethod>("pix");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8">
      <p className="text-sm">valor no estado: {method}</p>
      <Select
        items={PAYMENT_METHOD_LABELS}
        value={method}
        onValueChange={(v) => setMethod(v as PaymentMethod)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_METHODS.map((option) => (
            <SelectItem key={option} value={option}>
              {PAYMENT_METHOD_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </main>
  );
}
