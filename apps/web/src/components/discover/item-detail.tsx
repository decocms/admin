import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link, useParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { marketplaceData, type MarketplaceItem } from "../../data/marketplace.ts";

function ReviewCard({ rating, author, timeAgo, content }: {
  rating: number;
  author: string;
  timeAgo: string;
  content: string;
}) {
  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {author[0].toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-sm">{author}</div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={12}
                    className={i < rating ? "text-yellow-500" : "text-gray-300"}
                  />
                ))}
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <p className="text-sm text-muted-foreground">{content}</p>
      </CardContent>
    </Card>
  );
}

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const workspaceLink = useWorkspaceLink();
  
  const item = marketplaceData.find(i => i.id === itemId);
  
  if (!item) {
    return (
      <div className="container mx-auto px-6 py-8 text-center">
        <Icon name="error" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The item you're looking for doesn't exist or has been removed.
        </p>
        <Link to={workspaceLink("/discover")}>
          <Button>
            <Icon name="arrow_back" size={16} className="mr-2" />
            Back to Discover
          </Button>
        </Link>
      </div>
    );
  }

  const handleInstall = () => {
    trackEvent("marketplace_install_detail_click", {
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

  const handleTryInChat = () => {
    trackEvent("marketplace_try_in_chat_click", {
      itemId: item.id,
      itemName: item.name,
      itemCategory: item.category
    });
    
    // TODO: Navigate to chat with pre-populated message
    console.log("Trying in chat:", item.name);
    alert(`Opening chat with ${item.name}... This will be implemented in the next step!`);
  };

  // Mock reviews
  const mockReviews = [
    {
      rating: 5,
      author: "Sarah Johnson",
      timeAgo: "2 days ago",
      content: "This tool has completely transformed how we handle our workflow. The interface is intuitive and the results are consistently excellent."
    },
    {
      rating: 4,
      author: "Mike Chen",
      timeAgo: "1 week ago",
      content: "Great functionality overall. Had some minor setup issues initially but the support team was very helpful."
    },
    {
      rating: 5,
      author: "Emma Rodriguez",
      timeAgo: "2 weeks ago",
      content: "Exactly what we needed for our team. The automation features have saved us hours every week."
    }
  ];

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link to={workspaceLink("/discover")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Icon name="arrow_back" size={16} />
          Back to Discover
        </Link>
      </div>

      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4 mb-4">
            <div className="text-4xl">{item.icon}</div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold">{item.name}</h1>
                <div className="flex gap-2">
                  {item.featured && (
                    <Badge variant="outline" className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                      ⭐ Featured
                    </Badge>
                  )}
                  {item.trending && (
                    <Badge variant="outline" className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                      🔥 Trending
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-lg text-muted-foreground mb-4">{item.description}</p>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Icon name="star" size={16} className="text-yellow-500" />
                  <span className="font-medium">{item.rating}</span>
                  <span>({item.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="download" size={16} />
                  <span>{item.downloads.toLocaleString()} downloads</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="update" size={16} />
                  <span>Updated {item.lastUpdated}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="text-2xl font-bold mb-1">
                  {item.price === 0 ? (
                    <span className="text-green-600">Free</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Icon name="bolt" size={20} className="text-yellow-500" />
                      <span>{item.price} credits</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.type === 'built-in' ? 'Built-in tool' : 'Community contribution'}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleInstall}
                  disabled={item.isInstalled}
                >
                  {item.isInstalled ? (
                    <>
                      <Icon name="check" size={16} className="mr-2" />
                      Installed
                    </>
                  ) : (
                    <>
                      <Icon name="download" size={16} className="mr-2" />
                      Install {item.name}
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleTryInChat}
                >
                  <Icon name="chat" size={16} className="mr-2" />
                  Try in Chat
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {item.category}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>{item.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span>~2.3 MB</span>
                </div>
                {item.author && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Developer</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.authorAvatar}</span>
                      <span>{item.author}</span>
                    </div>
                  </div>
                )}
              </div>

              {item.integrations && item.integrations.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-medium mb-2">Integrations</h4>
                    <div className="flex flex-wrap gap-1">
                      {item.integrations.map((integration) => (
                        <Badge key={integration} variant="outline" className="text-xs">
                          {integration}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({item.reviewCount})</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <div className="prose max-w-none">
            <h2 className="text-xl font-semibold mb-4">About {item.name}</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              {item.longDescription}
            </p>

            {item.permissions && item.permissions.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Permissions Required</h3>
                <div className="bg-muted/50 rounded-lg p-4">
                  <ul className="space-y-2">
                    {item.permissions.map((permission) => (
                      <li key={permission} className="flex items-center gap-2 text-sm">
                        <Icon name="security" size={16} className="text-muted-foreground" />
                        <span className="capitalize">{permission.replace('-', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {item.subItems && item.subItems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">What's Included</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {item.subItems.map((subItem) => (
                    <Card key={subItem.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-xl">{subItem.icon || '📦'}</div>
                          <div>
                            <h4 className="font-medium">{subItem.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {subItem.shortDescription}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="reviews" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-xl font-semibold mb-4">User Reviews</h2>
              <div className="space-y-4">
                {mockReviews.map((review, index) => (
                  <ReviewCard key={index} {...review} />
                ))}
              </div>
            </div>
            <div>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-medium mb-4">Rating Overview</h3>
                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold">{item.rating}</div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Icon
                          key={i}
                          name="star"
                          size={16}
                          className={i < Math.floor(item.rating) ? "text-yellow-500" : "text-gray-300"}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Based on {item.reviewCount} reviews
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => (
                      <div key={stars} className="flex items-center gap-2">
                        <span className="text-sm w-8">{stars}★</span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{ width: `${stars === 5 ? 70 : stars === 4 ? 20 : 5}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8">
                          {stars === 5 ? '70%' : stars === 4 ? '20%' : '5%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="changelog" className="mt-6">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold mb-4">Version History</h2>
            <div className="space-y-6">
              <div className="border-l-2 border-primary pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default">{item.version}</Badge>
                  <span className="text-sm text-muted-foreground">Latest • {item.lastUpdated}</span>
                </div>
                <h3 className="font-medium mb-2">Bug fixes and improvements</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Fixed issue with data synchronization</li>
                  <li>• Improved performance for large datasets</li>
                  <li>• Enhanced error handling and user feedback</li>
                  <li>• Updated dependencies for security</li>
                </ul>
              </div>
              
              <div className="border-l-2 border-muted pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">v1.1.0</Badge>
                  <span className="text-sm text-muted-foreground">2 weeks ago</span>
                </div>
                <h3 className="font-medium mb-2">New features and enhancements</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Added batch processing capabilities</li>
                  <li>• New integration with popular third-party services</li>
                  <li>• Improved user interface with better accessibility</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="support" className="mt-6">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold mb-4">Support & Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="help" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Documentation</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Complete guides and API reference
                      </p>
                      <Button size="sm" variant="outline">
                        View Docs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="support" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Get Help</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Contact our support team
                      </p>
                      <Button size="sm" variant="outline">
                        Contact Support
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="bug_report" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Report Issues</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Found a bug? Let us know
                      </p>
                      <Button size="sm" variant="outline">
                        Report Bug
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="forum" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Community</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Join the discussion
                      </p>
                      <Button size="sm" variant="outline">
                        Join Forum
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
