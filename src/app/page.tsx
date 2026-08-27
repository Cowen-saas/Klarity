import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <main>
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <LandingFooter />
    </main>
  );
}
