import React, { useState, useRef, useEffect } from "react";
import { Icon } from "../atoms/Icon.tsx";
import { AIChat } from "./AIChat.tsx";

interface SearchResult {
  title: string;
  content: string;
  url: string;
  section: string;
}

interface AISearchProps {
  locale: string;
}

export function AISearch({ locale }: AISearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showChatMode, setShowChatMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Handle search
  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&locale=${locale}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce search to avoid too many API calls
    debounceRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  // Handle "Ask AI" mode
  const handleAskAI = () => {
    setShowChatMode(true);
    setShowResults(false);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setShowChatMode(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      
      // Escape to close
      if (event.key === 'Escape') {
        setShowResults(false);
        setShowChatMode(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div ref={searchContainerRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Icon 
            name={isSearching ? "Loader2" : "Search"} 
            size={16} 
            className={`text-muted-foreground ${isSearching ? "animate-spin" : ""}`}
          />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query && setShowResults(true)}
          placeholder="Search for anything..."
          className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
        
        {/* Keyboard shortcut hint */}
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-app-background border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center">
              <Icon name="Loader2" size={20} className="animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Searching documentation...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {/* Search Results */}
              {results.map((result, index) => (
                <a
                  key={index}
                  href={result.url}
                  className="block px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                  onClick={() => setShowResults(false)}
                >
                  <div className="flex items-start gap-3">
                    <Icon name="FileText" size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">{result.title}</h4>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                          {result.section}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{result.content}</p>
                    </div>
                  </div>
                </a>
              ))}
              
              {/* Ask AI Option */}
              {query && (
                <div className="border-t border-border">
                  <button
                    onClick={handleAskAI}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <Icon name="Sparkles" size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Ask AI about "{query}"</p>
                      <p className="text-xs text-muted-foreground">Start a conversation with AI using docs context</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : query ? (
            <div className="p-4 text-center">
              <Icon name="Search" size={20} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">No results found for "{query}"</p>
              {query && (
                <button
                  onClick={handleAskAI}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
                >
                  <Icon name="Sparkles" size={14} />
                  Ask AI instead
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* AI Chat Modal */}
      {showChatMode && (
        <AIChat 
          initialQuery={query}
          onClose={() => setShowChatMode(false)}
          locale={locale}
        />
      )}
    </div>
  );
}
