import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { ModelMatrix } from "@/components/marketing/model-matrix";
import { PricingCalculator } from "@/components/marketing/pricing-calculator";

export const metadata: Metadata = {
  title: "One endpoint for every model",
};

export default function MarketingPage() {
  return (
    <main>
      <Hero />
      <PricingCalculator />
      <ModelMatrix />
    </main>
  );
}
