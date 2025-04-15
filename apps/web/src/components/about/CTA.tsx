import { Button } from "@deco/ui/components/button.tsx";

export interface Props {
  /**
   * @description The CTA title
   */
  title?: string;
  /**
   * @description The button text
   */
  buttonText?: string;
  /**
   * @description The button link
   */
  buttonLink?: string;
  /**
   * @description The background pattern image
   */
  backgroundImage?: string;
}

export default function CTA({
  title = "Finally, your team leveraging AI productivity without the risks",
  buttonText = "Try now",
  buttonLink = "#",
  backgroundImage,
}: Props) {
  return (
    <div className="w-full relative z-10 px-4 md:px-20 -mb-16 md:-mb-32">
      <div className="max-w-[1500px] mx-auto">
        <div className="w-full bg-primary-light rounded-2xl md:rounded-3xl px-4 md:px-6 py-16 md:py-32 flex flex-col items-center justify-center gap-6 md:gap-8 relative overflow-hidden">
          {/* Background pattern */}
          {backgroundImage && (
            <div
              className="absolute inset-0 z-0 opacity-50"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                mixBlendMode: "multiply",
              }}
            />
          )}

          <div className="max-w-3xl mx-auto text-center relative z-10 md:px-4">
            <h2 className="text-primary-dark text-2xl md:text-5xl font-medium leading-tight mb-6 md:mb-8">
              {title}
            </h2>
            <Button
              variant="default"
              asChild
              className="inline-flex items-center justify-center font-medium rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 bg-primary-dark text-primary-light hover:bg-primary-dark/90 focus:ring-primary-dark px-4 py-2 text-base"
            >
              <a href={buttonLink}>{buttonText}</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
