import CTA from "./CTA.tsx";
import Features from "./Features.tsx";
import Footer from "./Footer.tsx";
import { Hero } from "./Hero.tsx";
import Integrations from "./Integrations.tsx";
import { DECO_CHAT_PAGE_CONTENT } from "./content.ts";

export function About() {
  const {
    hero,
    features,
    integrations,
    cta,
    footer,
  } = DECO_CHAT_PAGE_CONTENT;

  return (
    <div className="bg-dc-50">
      <Hero {...hero} />
      <Features {...features} />
      <Integrations {...integrations} />
      <CTA {...cta} />
      <Footer {...footer} />
    </div>
  );
}
