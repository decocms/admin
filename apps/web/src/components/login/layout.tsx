export function SplitScreenLayout({ children, hideBackgroundPanel = false }: { children: React.ReactNode; hideBackgroundPanel?: boolean }) {
  const bgImage = "url('https://assets.decocache.com/decocms/cbef38cc-a1fe-4616-bbb6-e928bfe334ef/capybara.png')";
  
  return (
    <div className="relative w-screen h-screen flex items-center justify-center p-4 sm:p-6 md:p-12 lg:p-18 overflow-hidden">
      {/* Background image - covers entire viewport */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: bgImage,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />
      
      {/* Blur and darken overlay - covers everything */}
      <div className="absolute inset-0 bg-brand-green-dark/50 backdrop-blur-[2px] pointer-events-none" />
      
      {/* Modal container */}
      <div className={`relative w-full h-full border border-white/25 rounded-2xl overflow-hidden shadow-lg z-10 ${hideBackgroundPanel ? 'max-w-full md:max-w-[900px]' : 'max-w-[1280px]'}`}>
        <div className="flex flex-col md:flex-row h-full">
          {/* Left panel - window to background (same image, fixed attachment) - Hidden on mobile or when hideBackgroundPanel is true */}
          {!hideBackgroundPanel && (
            <div 
              className="hidden md:block relative md:w-1/2"
              style={{
                backgroundImage: bgImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
              }}
            >
              {/* Semi-transparent overlay */}
              <div className="absolute inset-0 bg-white/5" />
              {/* Inset shadow effect */}
              <div className="absolute inset-0 shadow-[0px_0px_75px_-15px_inset_rgba(255,255,255,0.25)]" />
            </div>
          )}
          
          {/* Right panel - form content */}
          <div className={`w-full h-full bg-background overflow-y-auto ${!hideBackgroundPanel ? 'md:w-1/2' : ''}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
