import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState, useMemo } from "react";
import { Link } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useInstalledApps } from "../../hooks/use-installed-apps.ts";
import { 
  marketplaceData, 
  featuredItems, 
  trendingItems, 
  categories, 
  filterOptions,
  type MarketplaceItem 
} from "../../data/marketplace.ts";

function ItemCard({ item, onInstall }: { item: MarketplaceItem; onInstall: (item: MarketplaceItem) => void }) {
  const workspaceLink = useWorkspaceLink();
  
  const formatPrice = (item: MarketplaceItem) => {
    if (item.priceUnit === 'free') return 'Free';
    if (item.priceUnit === 'per-1m-tokens') return `$${item.price}/1M tokens`;
    if (item.priceUnit === 'monthly') return `$${item.price}/month`;
    if (item.priceUnit === 'one-time') return `$${item.price}`;
    return `$${item.price}`;
  };
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-200 p-4 cursor-pointer">
      <Link to={workspaceLink(`/discover/item/${item.id}`)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                <Icon name={item.iconName} size={20} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {item.shortDescription}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {item.featured && (
                <Badge variant="outline" className="text-xs bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                  <Icon name="star" size={12} className="mr-1" />
                  Featured
                </Badge>
              )}
              {item.trending && (
                <Badge variant="outline" className="text-xs bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                  <Icon name="trending_up" size={12} className="mr-1" />
                  Trending
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Link>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Icon name="download" size={14} />
            <span>{item.downloads.toLocaleString()} downloads</span>
          </div>
          <div className="flex items-center gap-1 font-medium">
            <span className={item.priceUnit === 'free' ? 'text-green-600' : 'text-foreground'}>
              {formatPrice(item)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-2 py-0">
                {tag}
              </Badge>
            ))}
            {item.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{item.tags.length - 3}</span>
            )}
          </div>
          
          <Button
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInstall(item);
            }}
            className="ml-2"
            disabled={item.isInstalled}
          >
            {item.isInstalled ? (
              <>
                <Icon name="check" size={14} className="mr-1" />
                Installed
              </>
            ) : (
              <>
                <Icon name="download" size={14} className="mr-1" />
                Install
              </>
            )}
          </Button>
        </div>
        
        {item.author && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <div className="text-lg">{item.authorAvatar}</div>
            <span className="text-sm text-muted-foreground">by {item.author}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeaturedSection({ items, onInstall }: { items: MarketplaceItem[]; onInstall: (item: MarketplaceItem) => void }) {
  if (items.length === 0) return null;
  
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold">⭐ Featured</h2>
        <Badge variant="secondary" className="text-xs">
          {items.length} items
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onInstall={onInstall} />
        ))}
      </div>
    </div>
  );
}

function TrendingSection({ items, onInstall }: { items: MarketplaceItem[]; onInstall: (item: MarketplaceItem) => void }) {
  if (items.length === 0) return null;
  
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold">🔥 Trending</h2>
        <Badge variant="secondary" className="text-xs">
          {items.length} items
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onInstall={onInstall} />
        ))}
      </div>
    </div>
  );
}

export function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedFilter, setSelectedFilter] = useState("all");
  
  const filteredItems = useMemo(() => {
    let items = marketplaceData;
    
    // Filter by search query
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Filter by category
    if (selectedCategory !== "all") {
      items = items.filter(item => item.category === selectedCategory);
    }
    
    // Filter by type/price
    if (selectedFilter !== "all") {
      switch (selectedFilter) {
        case 'built-in':
          items = items.filter(item => item.type === 'built-in');
          break;
        case 'community':
          items = items.filter(item => item.type === 'community');
          break;
        case 'free':
          items = items.filter(item => item.price === 0);
          break;
        case 'paid':
          items = items.filter(item => item.price > 0);
          break;
      }
    }
    
    return items;
  }, [searchQuery, selectedCategory, selectedFilter]);

  const handleInstall = (item: MarketplaceItem) => {
    trackEvent("marketplace_install_click", {
      itemId: item.id,
      itemName: item.name,
      itemCategory: item.category,
      itemType: item.type,
      itemPrice: item.price
    });
    
    // TODO: Implement actual installation logic
    console.log("Installing item:", item.name);
    
    // For now, just show a success message
    alert(`Installing ${item.name}... This will be implemented in the next step!`);
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Icon name="explore" size={32} className="text-primary" />
          <h1 className="text-3xl font-bold">Discover</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Explore our marketplace of AI tools, agents, workflows, and more to supercharge your productivity
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tools, agents, workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-4 py-2 border border-input rounded-md bg-background text-sm"
          >
            {filterOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
              <Icon name={category.iconName} size={16} />
              <span className="hidden sm:inline">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Results */}
      <div className="space-y-8">
        {/* Show featured and trending sections only when showing all categories and no search */}
        {selectedCategory === "all" && !searchQuery && (
          <>
            <FeaturedSection items={featuredItems} onInstall={handleInstall} />
            <Separator />
            <TrendingSection items={trendingItems} onInstall={handleInstall} />
            <Separator />
          </>
        )}

        {/* Main results */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {selectedCategory === "all" ? "All Items" : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{filteredItems.length} items</span>
              {searchQuery && (
                <Badge variant="outline" className="text-xs">
                  Search: "{searchQuery}"
                </Badge>
              )}
            </div>
          </div>
          
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <ItemCard key={item.id} item={item} onInstall={handleInstall} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon name="search_off" size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No items found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters to find what you're looking for
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
