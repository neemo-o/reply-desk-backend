import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CallToAction } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <LandingNavbar />
      <main>
        <Hero />
        <Benefits />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
