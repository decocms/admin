export function SplitScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-dc-50 relative w-screen h-screen flex">
      <div className="hidden md:flex md:w-1/2 p-2">
        <div className="relative flex flex-col justify-between w-full h-full bg-primary-light rounded-3xl p-10 overflow-hidden">
          {/* Dotted pattern background */}
          <div className="absolute inset-0 opacity-60">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="var(--primary-dark)" opacity="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
          </div>
          
          {/* Gradient overlay for the pattern effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary-light/50 to-primary-light" />
          
          {/* Content */}
          <div className="relative z-10 text-primary-dark">
            <div className="text-[40px] font-normal">
              context is
            </div>
            <div className="text-[48px] italic font-serif tracking-[-1.44px]">
              everything
            </div>
          </div>
          
          {/* Logo at bottom */}
          <div className="relative z-10 flex justify-end">
            <img
              src="https://assets.decocache.com/decochatweb/97a59aaf-6925-4b29-9f1a-f279589e0545/deco.svg"
              className="h-[60px] w-auto"
              alt="deco logo"
            />
          </div>
        </div>
      </div>
      <div className="w-full md:w-1/2 h-full flex items-center justify-center">{children}</div>
    </div>
  );
}
